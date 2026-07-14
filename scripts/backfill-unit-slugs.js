const { PrismaClient } = require('@prisma/client');
const { backfillUnitSlugs } = require('../services/unitSlug');

const prisma = new PrismaClient();

async function main() {
  await backfillUnitSlugs(prisma);
  console.log('Unit slugs backfilled.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to backfill unit slugs:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
