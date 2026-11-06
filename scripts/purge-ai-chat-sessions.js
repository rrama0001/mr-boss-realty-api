require('dotenv').config();

const { prisma } = require('../prisma/prismaClient');
const { purgeExpiredChatSessions } = require('../services/aiConversationPersistence');

async function main() {
  const result = await purgeExpiredChatSessions(prisma);

  if (result.skipped) {
    console.log('[ai-chat-purge] Skipped — chat session retention is disabled in website settings.');
    return;
  }

  console.log(
    `[ai-chat-purge] Deleted ${result.deletedSessions} session(s) older than ${result.retentionDays} day(s) (before ${result.cutoff.toISOString()}).`,
  );
}

main()
  .catch((error) => {
    console.error('[ai-chat-purge] Failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
