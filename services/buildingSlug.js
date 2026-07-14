const crypto = require('crypto');
const { isNumericId } = require('./projectSlug');

const BUILDING_HASH_PATTERN = /^[a-f0-9]{8}$/i;

function buildBuildingRef(buildingId) {
  return crypto
    .createHash('sha256')
    .update(`building:${buildingId}`)
    .digest('hex')
    .slice(0, 8);
}

function isBuildingHashRef(ref) {
  return BUILDING_HASH_PATTERN.test(String(ref || '').trim());
}

async function resolveBuildingIdFromRef(prisma, ref) {
  const value = String(ref || '').trim();
  if (!value) return null;

  if (isNumericId(value)) {
    return parseInt(value, 10);
  }

  const normalized = value.toLowerCase();

  if (isBuildingHashRef(normalized)) {
    const byHash = await findBuildingIdByHashRef(prisma, normalized);
    if (byHash != null) {
      return byHash;
    }
  }

  try {
    const bySlug = await prisma.buildings.findFirst({
      where: { slug: normalized },
      select: { id: true },
    });

    return bySlug?.id ?? null;
  } catch (err) {
    if (!String(err.message || '').includes('Unknown argument `slug`')) {
      throw err;
    }

    return null;
  }
}

async function findBuildingIdByHashRef(prisma, hashRef) {
  const wholeBuildings = await prisma.buildings.findMany({
    where: { is_whole_property_listing: true },
    select: { id: true },
  });

  const match = wholeBuildings.find((building) => buildBuildingRef(building.id) === hashRef);
  return match?.id ?? null;
}

async function syncBuildingSlug(prisma, buildingId) {
  const slug = buildBuildingRef(buildingId);
  const building = await prisma.buildings.findUnique({
    where: { id: buildingId },
    select: { is_whole_property_listing: true },
  });

  if (!building) return null;

  if (!building.is_whole_property_listing) {
    try {
      return await prisma.buildings.update({
        where: { id: buildingId },
        data: { slug: null },
      });
    } catch (err) {
      if (String(err.message || '').includes('Unknown argument `slug`')) {
        return prisma.buildings.findUnique({ where: { id: buildingId } });
      }
      throw err;
    }
  }

  try {
    return await prisma.buildings.update({
      where: { id: buildingId },
      data: { slug },
    });
  } catch (err) {
    if (String(err.message || '').includes('Unknown argument `slug`')) {
      return prisma.buildings.findUnique({ where: { id: buildingId } });
    }
    throw err;
  }
}

async function backfillBuildingSlugs(prisma) {
  const buildings = await prisma.buildings.findMany({
    where: { is_whole_property_listing: true },
    select: { id: true, slug: true },
    orderBy: { id: 'asc' },
  });

  for (const building of buildings) {
    const nextSlug = buildBuildingRef(building.id);

    if (building.slug !== nextSlug) {
      await prisma.buildings.update({
        where: { id: building.id },
        data: { slug: nextSlug },
      });
    }
  }
}

module.exports = {
  buildBuildingRef,
  isBuildingHashRef,
  resolveBuildingIdFromRef,
  syncBuildingSlug,
  backfillBuildingSlugs,
};
