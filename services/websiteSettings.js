const DEFAULT_WEBSITE_SETTINGS = {
  property_page_records_per_page: 15,
  otp_trigger_question_count: null,
  chat_idle_ttl_hours: null,
};

const MIN_PROPERTY_PAGE_SIZE = 1;
const MAX_PROPERTY_PAGE_SIZE = 100;
const MIN_OTP_TRIGGER_QUESTIONS = 1;
const MAX_OTP_TRIGGER_QUESTIONS = 100;
const MIN_CHAT_IDLE_TTL_HOURS = 1;
const MAX_CHAT_IDLE_TTL_HOURS = 720;

function parsePropertyPageSize(value) {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_PROPERTY_PAGE_SIZE
    || parsed > MAX_PROPERTY_PAGE_SIZE
  ) {
    return null;
  }
  return parsed;
}

/**
 * Empty / null / blank = OTP disabled.
 * Otherwise a whole number between 1 and 100.
 */
function parseOtpTriggerQuestionCount(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_OTP_TRIGGER_QUESTIONS
    || parsed > MAX_OTP_TRIGGER_QUESTIONS
  ) {
    return undefined;
  }

  return parsed;
}

/**
 * Empty / null / blank = idle auto-delete disabled.
 * Otherwise a whole number between 1 and 720 hours.
 */
function parseChatIdleTtlHours(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_CHAT_IDLE_TTL_HOURS
    || parsed > MAX_CHAT_IDLE_TTL_HOURS
  ) {
    return undefined;
  }

  return parsed;
}

function sanitizeWebsiteSettingsInput(body = {}) {
  const pageSize = parsePropertyPageSize(body.property_page_records_per_page);
  if (pageSize === null) {
    const error = new Error(
      `Property page records per page must be a whole number between ${MIN_PROPERTY_PAGE_SIZE} and ${MAX_PROPERTY_PAGE_SIZE}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const otpTrigger = parseOtpTriggerQuestionCount(body.otp_trigger_question_count);
  if (otpTrigger === undefined) {
    const error = new Error(
      `Number of questions to trigger OTP must be empty or a whole number between ${MIN_OTP_TRIGGER_QUESTIONS} and ${MAX_OTP_TRIGGER_QUESTIONS}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const chatIdleTtl = parseChatIdleTtlHours(body.chat_idle_ttl_hours);
  if (chatIdleTtl === undefined) {
    const error = new Error(
      `Hours to delete idle chats must be empty or a whole number between ${MIN_CHAT_IDLE_TTL_HOURS} and ${MAX_CHAT_IDLE_TTL_HOURS}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    property_page_records_per_page: pageSize,
    otp_trigger_question_count: otpTrigger,
    chat_idle_ttl_hours: chatIdleTtl,
  };
}

function toPublicWebsiteSettings(row = null) {
  const pageSize = parsePropertyPageSize(row?.property_page_records_per_page);
  const otpTrigger = parseOtpTriggerQuestionCount(row?.otp_trigger_question_count);
  const chatIdleTtl = parseChatIdleTtlHours(row?.chat_idle_ttl_hours);

  return {
    property_page_records_per_page:
      pageSize ?? DEFAULT_WEBSITE_SETTINGS.property_page_records_per_page,
    otp_trigger_question_count: otpTrigger === undefined
      ? DEFAULT_WEBSITE_SETTINGS.otp_trigger_question_count
      : otpTrigger,
    chat_idle_ttl_hours: chatIdleTtl === undefined
      ? DEFAULT_WEBSITE_SETTINGS.chat_idle_ttl_hours
      : chatIdleTtl,
    updated_at: row?.updated_at || null,
  };
}

async function getOrCreateWebsiteSettings(prisma) {
  const existing = await prisma.website_settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.website_settings.create({
    data: {
      id: 1,
      property_page_records_per_page: DEFAULT_WEBSITE_SETTINGS.property_page_records_per_page,
      otp_trigger_question_count: DEFAULT_WEBSITE_SETTINGS.otp_trigger_question_count,
      chat_idle_ttl_hours: DEFAULT_WEBSITE_SETTINGS.chat_idle_ttl_hours,
    },
  });
}

module.exports = {
  DEFAULT_WEBSITE_SETTINGS,
  MAX_CHAT_IDLE_TTL_HOURS,
  MAX_OTP_TRIGGER_QUESTIONS,
  MIN_CHAT_IDLE_TTL_HOURS,
  MIN_OTP_TRIGGER_QUESTIONS,
  getOrCreateWebsiteSettings,
  parseChatIdleTtlHours,
  parseOtpTriggerQuestionCount,
  sanitizeWebsiteSettingsInput,
  toPublicWebsiteSettings,
};
