const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Manila';

function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * Calendar YYYY-MM-DD in the business timezone (default Asia/Manila).
 */
function formatBusinessDateKey(date = new Date(), timeZone = BUSINESS_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Convert a calendar date key to a Date suitable for Prisma @db.Date (UTC midnight).
 */
function dateKeyToUtcDate(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Normalize Prisma/Postgres DATE values to YYYY-MM-DD without timezone shifts.
 */
function dbDateToKey(value) {
  if (value == null) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
}

function shiftDateKey(dateKey, dayOffset) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return dbDateToKey(date);
}

function emptyDailyKeys(days, endDate = new Date()) {
  const endKey = formatBusinessDateKey(endDate);
  const keys = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(endKey, -i));
  }

  return keys;
}

module.exports = {
  BUSINESS_TIMEZONE,
  dateKeyToUtcDate,
  dbDateToKey,
  emptyDailyKeys,
  formatBusinessDateKey,
  shiftDateKey,
};
