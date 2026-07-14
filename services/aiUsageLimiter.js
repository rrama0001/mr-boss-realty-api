const usageByUser = new Map();

function getMessageLimit() {
  const parsed = parseInt(process.env.AI_CHAT_MESSAGE_LIMIT || '12', 10);
  return Number.isNaN(parsed) ? 12 : Math.max(parsed, 1);
}

function getTokenLimit() {
  const parsed = parseInt(process.env.AI_CHAT_TOKEN_LIMIT || '12000', 10);
  return Number.isNaN(parsed) ? 12000 : Math.max(parsed, 1000);
}

function getUsage(userKey) {
  if (!usageByUser.has(userKey)) {
    usageByUser.set(userKey, { messageCount: 0, tokenCount: 0 });
  }
  return usageByUser.get(userKey);
}

function recordUserMessage(userKey) {
  const usage = getUsage(userKey);
  usage.messageCount += 1;
  return usage;
}

function recordTokenUsage(userKey, tokens = 0) {
  const usage = getUsage(userKey);
  usage.tokenCount += Math.max(0, Number(tokens) || 0);
  return usage;
}

function isQuotaExceeded(userKey) {
  const usage = getUsage(userKey);
  return usage.messageCount >= getMessageLimit() || usage.tokenCount >= getTokenLimit();
}

function getUsageSnapshot(userKey) {
  const usage = getUsage(userKey);
  return {
    messageCount: usage.messageCount,
    tokenCount: usage.tokenCount,
    messageLimit: getMessageLimit(),
    tokenLimit: getTokenLimit(),
    exceeded: isQuotaExceeded(userKey),
  };
}

function resetUsage(userKey) {
  usageByUser.set(userKey, { messageCount: 0, tokenCount: 0 });
}

function clearUsage(userKey) {
  usageByUser.delete(userKey);
}

module.exports = {
  clearUsage,
  getMessageLimit,
  getTokenLimit,
  getUsageSnapshot,
  isQuotaExceeded,
  recordTokenUsage,
  recordUserMessage,
  resetUsage,
};
