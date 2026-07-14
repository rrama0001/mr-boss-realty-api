const { PrismaClient } = require('@prisma/client');
const { backfillProjectSlugs } = require('../services/projectSlug');

const prisma = new PrismaClient();

async function main() {
  await backfillProjectSlugs(prisma);
  console.log('Project slugs backfilled.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to backfill project slugs:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
