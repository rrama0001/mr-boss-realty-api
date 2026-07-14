const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TABLES = [
  'assets',
  'projects',
  'buildings',
  'units',
  'users',
  'leads',
  'deliverables',
];

async function main() {
  for (const table of TABLES) {
    try {
      const result = await prisma.$queryRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1),
          true
        ) AS last_value
      `);
      console.log(`${table}: sequence ->`, result?.[0]?.last_value);
    } catch (err) {
      console.warn(`${table}: skipped (${err.message.split('\\n')[0]})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
