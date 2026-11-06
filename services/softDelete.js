const SOFT_DELETE_MODELS = new Set(['projects', 'buildings', 'units']);
const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

// Only these nested relations are to-many. Note: units.buildings / units.projects
// are to-one despite plural field names — never inject `where` there.
const TO_MANY_SOFT_DELETE_RELATIONS = {
  projects: new Set(['buildings', 'units']),
  buildings: new Set(['units']),
  units: new Set(),
};

// Soft-delete does not filter to-one parents automatically. Hide inventory whose
// project/building was deleted even if the child row was left active.
const ACTIVE_PARENT_WHERE = {
  units: {
    projects: { deleted_at: null },
    buildings: { deleted_at: null },
  },
  buildings: {
    projects: { deleted_at: null },
  },
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function mergeActiveParentWhere(where = {}, model) {
  const parents = ACTIVE_PARENT_WHERE[model];
  if (!parents) return where;

  const next = { ...where };

  for (const [relation, filter] of Object.entries(parents)) {
    if (!hasOwn(next, relation)) {
      next[relation] = { ...filter };
      continue;
    }

    const current = next[relation];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      continue;
    }

    // Keep intentional deleted_at overrides (e.g. admin orphan audits).
    if (hasOwn(current, 'deleted_at')) {
      continue;
    }

    next[relation] = { ...current, ...filter };
  }

  return next;
}

function withNotDeletedWhere(where = {}, model) {
  const base = hasOwn(where, 'deleted_at') ? { ...where } : { ...where, deleted_at: null };
  return mergeActiveParentWhere(base, model);
}

function applyRelationSoftDelete(relationArgs, relationModel) {
  if (relationArgs === true) {
    return { where: withNotDeletedWhere({}, relationModel) };
  }

  if (!relationArgs || typeof relationArgs !== 'object') {
    return relationArgs;
  }

  const next = { ...relationArgs };
  next.where = withNotDeletedWhere(next.where || {}, relationModel);

  if (next.include) {
    next.include = mapSoftDeleteRelations(next.include, relationModel);
  }

  if (next.select) {
    next.select = mapSoftDeleteRelations(next.select, relationModel);
  }

  return next;
}

function mapSoftDeleteRelations(obj, parentModel) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const toMany = TO_MANY_SOFT_DELETE_RELATIONS[parentModel] || new Set();
  const next = { ...obj };

  for (const [key, value] of Object.entries(next)) {
    if (!SOFT_DELETE_MODELS.has(key)) continue;

    if (toMany.has(key)) {
      next[key] = applyRelationSoftDelete(value, key);
      continue;
    }

    // To-one relation: do not add `where`, but still recurse into nested include/select.
    if (value && typeof value === 'object') {
      const nested = { ...value };
      if (nested.include) {
        nested.include = mapSoftDeleteRelations(nested.include, key);
      }
      if (nested.select) {
        nested.select = mapSoftDeleteRelations(nested.select, key);
      }
      next[key] = nested;
    }
  }

  return next;
}

function applySoftDeleteReadArgs(args = {}, model) {
  const next = { ...args };
  const includeDeleted = next.includeDeleted === true;
  delete next.includeDeleted;

  if (!includeDeleted) {
    next.where = withNotDeletedWhere(next.where || {}, model);

    if (next.include) {
      next.include = mapSoftDeleteRelations(next.include, model);
    }

    if (next.select) {
      next.select = mapSoftDeleteRelations(next.select, model);
    }
  }

  return next;
}

function createSoftDeleteExtension() {
  return {
    name: 'inventorySoftDelete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model) || !READ_OPERATIONS.has(operation)) {
            return query(args);
          }
          return query(applySoftDeleteReadArgs(args, model));
        },
      },
    },
  };
}

function deletedSlug(slug, id) {
  const base = String(slug || 'item').slice(0, 180);
  return `${base}__deleted_${id}`;
}

function originalSlugFromDeleted(slug) {
  const value = String(slug || '');
  const marker = '__deleted_';
  const index = value.lastIndexOf(marker);
  if (index <= 0) return null;
  return value.slice(0, index) || null;
}

async function findSlugCollision(prisma, model, slug, excludeId) {
  return prisma[model].findFirst({
    where: {
      slug,
      id: { not: excludeId },
    },
    includeDeleted: true,
    select: { id: true },
  });
}

async function resolveRestoredSlug(prisma, model, preferredSlug, excludeId) {
  let slug = preferredSlug || `${model}-${excludeId}`;
  let counter = 2;

  while (await findSlugCollision(prisma, model, slug, excludeId)) {
    slug = `${preferredSlug}-restored-${counter}`;
    counter += 1;
  }

  return slug;
}

async function softDeleteUnit(prisma, unitId, deletedAt = new Date()) {
  const unit = await prisma.units.findFirst({
    where: { id: unitId, deleted_at: null },
    select: { id: true, slug: true },
  });

  if (!unit) return null;

  return prisma.units.update({
    where: { id: unit.id },
    data: {
      deleted_at: deletedAt,
      slug: deletedSlug(unit.slug || `unit-${unit.id}`, unit.id),
    },
  });
}

async function softDeleteBuildingCascade(prisma, buildingId, deletedAt = new Date()) {
  const building = await prisma.buildings.findFirst({
    where: { id: buildingId, deleted_at: null },
    select: { id: true, slug: true, project_id: true },
  });

  if (!building) return null;

  const units = await prisma.units.findMany({
    where: { building_id: building.id, deleted_at: null },
    select: { id: true, slug: true },
  });

  await prisma.$transaction([
    prisma.buildings.update({
      where: { id: building.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(building.slug || `building-${building.id}`, building.id),
      },
    }),
    ...units.map((unit) => prisma.units.update({
      where: { id: unit.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(unit.slug || `unit-${unit.id}`, unit.id),
      },
    })),
  ]);

  return { building, unitIds: units.map((unit) => unit.id), deletedAt };
}

async function softDeleteProjectCascade(prisma, projectId, deletedAt = new Date()) {
  const project = await prisma.projects.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { id: true, slug: true },
  });

  if (!project) return null;

  const buildings = await prisma.buildings.findMany({
    where: { project_id: project.id, deleted_at: null },
    select: { id: true, slug: true },
  });

  const units = await prisma.units.findMany({
    where: { project_id: project.id, deleted_at: null },
    select: { id: true, slug: true },
  });

  await prisma.$transaction([
    prisma.projects.update({
      where: { id: project.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(project.slug || `project-${project.id}`, project.id),
      },
    }),
    ...buildings.map((building) => prisma.buildings.update({
      where: { id: building.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(building.slug || `building-${building.id}`, building.id),
      },
    })),
    ...units.map((unit) => prisma.units.update({
      where: { id: unit.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(unit.slug || `unit-${unit.id}`, unit.id),
      },
    })),
  ]);

  return {
    project,
    buildingIds: buildings.map((building) => building.id),
    unitIds: units.map((unit) => unit.id),
    deletedAt,
  };
}

async function restoreUnit(prisma, unitId) {
  const unit = await prisma.units.findFirst({
    where: { id: unitId, deleted_at: { not: null } },
    select: {
      id: true,
      slug: true,
      building_id: true,
      project_id: true,
    },
  });

  if (!unit) return { ok: false, status: 404, error: 'Deleted unit not found' };

  const building = await prisma.buildings.findFirst({
    where: { id: unit.building_id, deleted_at: null },
    select: { id: true },
  });
  if (!building) {
    return { ok: false, status: 409, error: 'Restore the parent building first' };
  }

  const project = await prisma.projects.findFirst({
    where: { id: unit.project_id, deleted_at: null },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, status: 409, error: 'Restore the parent project first' };
  }

  const restoredSlug = await resolveRestoredSlug(
    prisma,
    'units',
    originalSlugFromDeleted(unit.slug) || `unit-${unit.id}`,
    unit.id,
  );

  const restored = await prisma.units.update({
    where: { id: unit.id },
    data: {
      deleted_at: null,
      slug: restoredSlug,
    },
  });

  return { ok: true, record: restored };
}

async function restoreBuilding(prisma, buildingId) {
  const building = await prisma.buildings.findFirst({
    where: { id: buildingId, deleted_at: { not: null } },
    select: {
      id: true,
      slug: true,
      deleted_at: true,
      project_id: true,
    },
  });

  if (!building) return { ok: false, status: 404, error: 'Deleted building not found' };

  const project = await prisma.projects.findFirst({
    where: { id: building.project_id, deleted_at: null },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, status: 409, error: 'Restore the parent project first' };
  }

  const restoredSlug = await resolveRestoredSlug(
    prisma,
    'buildings',
    originalSlugFromDeleted(building.slug) || `building-${building.id}`,
    building.id,
  );

  const cascadedUnits = await prisma.units.findMany({
    where: {
      building_id: building.id,
      deleted_at: building.deleted_at,
    },
    select: { id: true, slug: true },
  });

  await prisma.$transaction([
    prisma.buildings.update({
      where: { id: building.id },
      data: {
        deleted_at: null,
        slug: restoredSlug,
      },
    }),
    ...cascadedUnits.map((unit) => prisma.units.update({
      where: { id: unit.id },
      data: {
        deleted_at: null,
        slug: originalSlugFromDeleted(unit.slug) || `unit-${unit.id}`,
      },
    })),
  ]);

  for (const unit of cascadedUnits) {
    const nextSlug = await resolveRestoredSlug(
      prisma,
      'units',
      originalSlugFromDeleted(unit.slug) || `unit-${unit.id}`,
      unit.id,
    );
    await prisma.units.update({
      where: { id: unit.id },
      data: { slug: nextSlug },
    });
  }

  const restored = await prisma.buildings.findFirst({
    where: { id: building.id, deleted_at: null },
  });

  return { ok: true, record: restored };
}

async function restoreProject(prisma, projectId) {
  const project = await prisma.projects.findFirst({
    where: { id: projectId, deleted_at: { not: null } },
    select: { id: true, slug: true, deleted_at: true },
  });

  if (!project) return { ok: false, status: 404, error: 'Deleted project not found' };

  const restoredSlug = await resolveRestoredSlug(
    prisma,
    'projects',
    originalSlugFromDeleted(project.slug) || `project-${project.id}`,
    project.id,
  );

  const cascadedBuildings = await prisma.buildings.findMany({
    where: {
      project_id: project.id,
      deleted_at: project.deleted_at,
    },
    select: { id: true, slug: true },
  });

  const cascadedUnits = await prisma.units.findMany({
    where: {
      project_id: project.id,
      deleted_at: project.deleted_at,
    },
    select: { id: true, slug: true },
  });

  await prisma.$transaction([
    prisma.projects.update({
      where: { id: project.id },
      data: {
        deleted_at: null,
        slug: restoredSlug,
      },
    }),
    ...cascadedBuildings.map((building) => prisma.buildings.update({
      where: { id: building.id },
      data: {
        deleted_at: null,
        slug: originalSlugFromDeleted(building.slug) || `building-${building.id}`,
      },
    })),
    ...cascadedUnits.map((unit) => prisma.units.update({
      where: { id: unit.id },
      data: {
        deleted_at: null,
        slug: originalSlugFromDeleted(unit.slug) || `unit-${unit.id}`,
      },
    })),
  ]);

  for (const building of cascadedBuildings) {
    const nextSlug = await resolveRestoredSlug(
      prisma,
      'buildings',
      originalSlugFromDeleted(building.slug) || `building-${building.id}`,
      building.id,
    );
    await prisma.buildings.update({
      where: { id: building.id },
      data: { slug: nextSlug },
    });
  }

  for (const unit of cascadedUnits) {
    const nextSlug = await resolveRestoredSlug(
      prisma,
      'units',
      originalSlugFromDeleted(unit.slug) || `unit-${unit.id}`,
      unit.id,
    );
    await prisma.units.update({
      where: { id: unit.id },
      data: { slug: nextSlug },
    });
  }

  const restored = await prisma.projects.findFirst({
    where: { id: project.id, deleted_at: null },
  });

  return { ok: true, record: restored };
}

/**
 * Soft-delete child rows left active under deleted parents (legacy / partial deletes).
 * Safe to run repeatedly.
 */
async function repairSoftDeleteOrphans(prisma, deletedAt = new Date()) {
  const orphanBuildings = await prisma.$queryRaw`
    SELECT b.id, b.slug
    FROM buildings b
    JOIN projects p ON p.id = b.project_id
    WHERE b.deleted_at IS NULL AND p.deleted_at IS NOT NULL
  `;

  const orphanUnits = await prisma.$queryRaw`
    SELECT u.id, u.slug
    FROM units u
    JOIN projects p ON p.id = u.project_id
    JOIN buildings b ON b.id = u.building_id
    WHERE u.deleted_at IS NULL
      AND (p.deleted_at IS NOT NULL OR b.deleted_at IS NOT NULL)
  `;

  const updates = [];

  for (const building of orphanBuildings) {
    updates.push(prisma.buildings.update({
      where: { id: building.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(building.slug || `building-${building.id}`, building.id),
      },
    }));
  }

  for (const unit of orphanUnits) {
    updates.push(prisma.units.update({
      where: { id: unit.id },
      data: {
        deleted_at: deletedAt,
        slug: deletedSlug(unit.slug || `unit-${unit.id}`, unit.id),
      },
    }));
  }

  if (updates.length) {
    await prisma.$transaction(updates);
  }

  return {
    buildings: orphanBuildings.map((row) => row.id),
    units: orphanUnits.map((row) => row.id),
  };
}

module.exports = {
  SOFT_DELETE_MODELS,
  createSoftDeleteExtension,
  softDeleteUnit,
  softDeleteBuildingCascade,
  softDeleteProjectCascade,
  restoreUnit,
  restoreBuilding,
  restoreProject,
  repairSoftDeleteOrphans,
};
