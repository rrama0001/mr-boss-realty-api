const { PrismaClient } = require('@prisma/client');
const { createSoftDeleteExtension } = require('../services/softDelete');

const RETRYABLE_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024']);
const RETRY_DELAYS_MS = [1500, 3000, 5000];

function withConnectTimeout(databaseUrl) {
  if (!databaseUrl) return undefined;

  const extras = [];
  if (!/[?&]connect_timeout=/.test(databaseUrl)) extras.push('connect_timeout=15');
  if (!/[?&]pool_timeout=/.test(databaseUrl)) extras.push('pool_timeout=15');
  if (!extras.length) return databaseUrl;

  const joiner = databaseUrl.includes('?') ? '&' : '?';
  return `${databaseUrl}${joiner}${extras.join('&')}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createConnectionRetryExtension() {
  return {
    name: 'connectionRetry',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastError;

          for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              const retryable = RETRYABLE_CODES.has(error && error.code);
              if (!retryable || attempt === RETRY_DELAYS_MS.length) throw error;
              await wait(RETRY_DELAYS_MS[attempt]);
            }
          }

          throw lastError;
        },
      },
    },
  };
}

const databaseUrl = withConnectTimeout(process.env.DATABASE_URL);
const prisma = new PrismaClient(
  databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
)
  .$extends(createSoftDeleteExtension())
  .$extends(createConnectionRetryExtension());

module.exports = { prisma };
