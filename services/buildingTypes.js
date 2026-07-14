const { prisma } = require('../prisma/prismaClient');
const BUILDING_TYPE_NAMES = require('../constants/buildingTypes');

async function seedBuildingTypes() {
  const sortedNames = [...BUILDING_TYPE_NAMES].sort((a, b) => a.localeCompare(b));

  for (let i = 0; i < sortedNames.length; i += 1) {
    const name = sortedNames[i];
    await prisma.building_types.upsert({
      where: { name },
      update: { sort_order: i + 1, is_active: true },
      create: { name, sort_order: i + 1 },
    });
  }

  await prisma.building_types.updateMany({
    where: { name: { notIn: BUILDING_TYPE_NAMES } },
    data: { is_active: false },
  });
}

async function isValidBuildingType(buildingType) {
  if (!buildingType) return false;
  const found = await prisma.building_types.findFirst({
    where: { name: buildingType, is_active: true },
  });
  return !!found;
}

module.exports = {
  seedBuildingTypes,
  isValidBuildingType,
};
