const TREND_DAYS = 30;

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDayKey(date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function emptyTokenTrend(days = TREND_DAYS) {
  const today = startOfUtcDay(new Date());
  const trend = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    trend.push({
      date: formatDayKey(day),
      tokens: 0,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
    });
  }

  return trend;
}

function normalizeUsage(usage = {}) {
  const promptTokens = Math.max(0, Number(usage.prompt_tokens) || 0);
  const completionTokens = Math.max(0, Number(usage.completion_tokens) || 0);
  const totalTokens = Math.max(
    0,
    Number(usage.total_tokens) || promptTokens + completionTokens,
  );

  return { promptTokens, completionTokens, totalTokens };
}

/**
 * Upsert today's token totals. Safe to fire-and-forget from request handlers.
 */
async function recordDailyTokenUsage(prisma, usage = {}) {
  const { promptTokens, completionTokens, totalTokens } = normalizeUsage(usage);
  if (totalTokens <= 0 && promptTokens <= 0 && completionTokens <= 0) {
    return null;
  }

  const usageDate = startOfUtcDay(new Date());

  return prisma.ai_token_usage_daily.upsert({
    where: { usage_date: usageDate },
    create: {
      usage_date: usageDate,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      request_count: 1,
    },
    update: {
      prompt_tokens: { increment: promptTokens },
      completion_tokens: { increment: completionTokens },
      total_tokens: { increment: totalTokens },
      request_count: { increment: 1 },
    },
  });
}

async function getAiTokenUsageStats(prisma, days = TREND_DAYS) {
  const byDay = emptyTokenTrend(days);
  const trendStart = startOfUtcDay(new Date());
  trendStart.setUTCDate(trendStart.getUTCDate() - (days - 1));

  const weekStart = startOfUtcDay(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const rows = await prisma.ai_token_usage_daily.findMany({
    where: { usage_date: { gte: trendStart } },
    orderBy: { usage_date: 'asc' },
  });

  const dayIndex = new Map(byDay.map((item, index) => [item.date, index]));

  for (const row of rows) {
    const key = formatDayKey(new Date(row.usage_date));
    const index = dayIndex.get(key);
    if (index == null) continue;

    byDay[index].tokens = Number(row.total_tokens) || 0;
    byDay[index].requests = Number(row.request_count) || 0;
    byDay[index].promptTokens = Number(row.prompt_tokens) || 0;
    byDay[index].completionTokens = Number(row.completion_tokens) || 0;
  }

  const totalTokens = byDay.reduce((sum, day) => sum + day.tokens, 0);
  const totalRequests = byDay.reduce((sum, day) => sum + day.requests, 0);
  const last7DaysTokens = byDay
    .filter((day) => day.date >= formatDayKey(weekStart))
    .reduce((sum, day) => sum + day.tokens, 0);

  return {
    totalTokens,
    totalRequests,
    last7DaysTokens,
    byDay,
  };
}

module.exports = {
  TREND_DAYS,
  getAiTokenUsageStats,
  recordDailyTokenUsage,
};
