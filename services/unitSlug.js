const crypto = require('crypto');
const { isNumericId } = require('./projectSlug');

const UNIT_HASH_PATTERN = /^[a-f0-9]{8}$/i;
const LEGACY_UNIT_REF_PATTERN = /^u-(\d+)$/i;

function buildUnitRef(unitId) {
  return crypto
    .createHash('sha256')
    .update(`unit:${unitId}`)
    .digest('hex')
    .slice(0, 8);
}

function isUnitHashRef(ref) {
  return UNIT_HASH_PATTERN.test(String(ref || '').trim());
}

function parseLegacyUnitRef(ref) {
  const value = String(ref || '').trim();
  if (!value) return null;

  const legacyMatch = value.match(LEGACY_UNIT_REF_PATTERN);
  if (legacyMatch) {
    return parseInt(legacyMatch[1], 10);
  }

  if (isNumericId(value)) {
    return parseInt(value, 10);
  }

  return null;
}

async function findUnitIdByHashRef(prisma, hashRef) {
  const units = await prisma.units.findMany({
    select: { id: true },
  });

  const match = units.find((unit) => buildUnitRef(unit.id) === hashRef);
  return match?.id ?? null;
}

async function resolveUnitIdFromRef(prisma, ref) {
  const value = String(ref || '').trim();
  if (!value) return null;

  const legacyId = parseLegacyUnitRef(value);
  if (legacyId != null) {
    return legacyId;
  }

  const normalized = value.toLowerCase();

  if (isUnitHashRef(normalized)) {
    const byHash = await findUnitIdByHashRef(prisma, normalized);
    if (byHash != null) {
      return byHash;
    }
  }

  const bySlug = await prisma.units.findFirst({
    where: { slug: normalized },
    select: { id: true },
  });

  return bySlug?.id ?? null;
}

async function syncUnitSlug(prisma, unitId) {
  const slug = buildUnitRef(unitId);
  const unit = await prisma.units.findUnique({
    where: { id: unitId },
    select: { slug: true },
  });

  if (!unit) return null;

  if (unit.slug === slug) {
    return prisma.units.findUnique({ where: { id: unitId } });
  }

  return prisma.units.update({
    where: { id: unitId },
    data: { slug },
  });
}

async function backfillUnitSlugs(prisma) {
  const units = await prisma.units.findMany({
    select: { id: true, slug: true },
    orderBy: { id: 'asc' },
  });

  for (const unit of units) {
    const nextSlug = buildUnitRef(unit.id);

    if (unit.slug !== nextSlug) {
      await prisma.units.update({
        where: { id: unit.id },
        data: { slug: nextSlug },
      });
    }
  }
}

module.exports = {
  buildUnitRef,
  isUnitHashRef,
  parseLegacyUnitRef,
  findUnitIdByHashRef,
  resolveUnitIdFromRef,
  syncUnitSlug,
  backfillUnitSlugs,
};
