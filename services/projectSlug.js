const { PUBLIC_PRIVATE_PROPERTY_LABEL } = require('./projectPublicDisplay');

function slugifyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProjectSlugName(projectName, isPrivateOnWebsite = false) {
  if (isPrivateOnWebsite) {
    return PUBLIC_PRIVATE_PROPERTY_LABEL;
  }

  return projectName;
}

function buildProjectSlug(projectName, city, isPrivateOnWebsite = false) {
  const parts = [
    slugifyPart(getProjectSlugName(projectName, isPrivateOnWebsite)),
    slugifyPart(city),
  ].filter(Boolean);
  return parts.join('-') || 'property';
}

async function ensureUniqueProjectSlug(prisma, baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.projects.findFirst({
      where: {
        slug,
        ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function resolveProjectSlug(prisma, projectName, city, excludeId = null, isPrivateOnWebsite = false) {
  const baseSlug = buildProjectSlug(projectName, city, isPrivateOnWebsite);
  return ensureUniqueProjectSlug(prisma, baseSlug, excludeId);
}

async function backfillProjectSlugs(prisma) {
  const projects = await prisma.projects.findMany({
    select: {
      id: true,
      project_name: true,
      city: true,
      slug: true,
      is_private_on_website: true,
    },
    orderBy: { id: 'asc' },
  });

  for (const project of projects) {
    const nextSlug = await resolveProjectSlug(
      prisma,
      project.project_name,
      project.city,
      project.id,
      project.is_private_on_website,
    );

    if (project.slug !== nextSlug) {
      await prisma.projects.update({
        where: { id: project.id },
        data: { slug: nextSlug },
      });
    }
  }
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || '').trim());
}

module.exports = {
  slugifyPart,
  getProjectSlugName,
  buildProjectSlug,
  ensureUniqueProjectSlug,
  resolveProjectSlug,
  backfillProjectSlugs,
  isNumericId,
};
