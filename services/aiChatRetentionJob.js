const { prisma } = require('../prisma/prismaClient');
const { purgeExpiredChatSessions } = require('./aiConversationPersistence');
const { getChatSessionRetentionDays } = require('./websiteSettings');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let timer = null;
let running = false;

async function runAiChatRetentionPurge(reason = 'scheduled') {
  if (running) return null;
  running = true;

  try {
    const result = await purgeExpiredChatSessions(prisma);
    if (result.skipped) {
      console.log(`[ai-chat-purge:${reason}] Skipped (retention disabled in website settings).`);
      return result;
    }
    if (result.deletedSessions > 0) {
      console.log(
        `[ai-chat-purge:${reason}] Deleted ${result.deletedSessions} session(s) older than ${result.retentionDays} day(s).`,
      );
    }
    return result;
  } catch (error) {
    console.error(`[ai-chat-purge:${reason}] Failed:`, error?.message || error);
    return null;
  } finally {
    running = false;
  }
}

function startAiChatRetentionJob() {
  if (timer) return;

  // Run shortly after boot, then once per day.
  setTimeout(() => {
    runAiChatRetentionPurge('startup').catch(() => {});
  }, 15_000).unref?.();

  timer = setInterval(() => {
    runAiChatRetentionPurge('daily').catch(() => {});
  }, ONE_DAY_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  getChatSessionRetentionDays(prisma)
    .then((days) => {
      console.log(
        days == null
          ? '[ai-chat-purge] Retention job armed (disabled in website settings).'
          : `[ai-chat-purge] Retention job armed (${days} day(s) from website settings).`,
      );
    })
    .catch(() => {
      console.log('[ai-chat-purge] Retention job armed.');
    });
}

function stopAiChatRetentionJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  runAiChatRetentionPurge,
  startAiChatRetentionJob,
  stopAiChatRetentionJob,
};
