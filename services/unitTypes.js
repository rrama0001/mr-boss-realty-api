const { prisma } = require('../prisma/prismaClient');
const UNIT_TYPE_NAMES = require('../constants/unitTypes');

async function seedUnitTypes() {
  for (let i = 0; i < UNIT_TYPE_NAMES.length; i += 1) {
    const name = UNIT_TYPE_NAMES[i];
    await prisma.unit_types.upsert({
      where: { name },
      update: { sort_order: i + 1, is_active: true },
      create: { name, sort_order: i + 1 },
    });
  }
}

async function isValidUnitType(unitType) {
  if (!unitType) return false;
  const found = await prisma.unit_types.findFirst({
    where: { name: unitType, is_active: true },
  });
  return !!found;
}

module.exports = {
  seedUnitTypes,
  isValidUnitType,
};
