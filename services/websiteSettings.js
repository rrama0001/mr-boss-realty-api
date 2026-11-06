const DEFAULT_WEBSITE_SETTINGS = {
  property_page_records_per_page: 15,
  otp_trigger_question_count: null,
  chat_idle_ttl_hours: null,
  chat_session_retention_days: 60,
  mail_from_name: null,
  mail_from_email: null,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PROPERTY_PAGE_SIZE = 1;
const MAX_PROPERTY_PAGE_SIZE = 100;
const MIN_OTP_TRIGGER_QUESTIONS = 1;
const MAX_OTP_TRIGGER_QUESTIONS = 100;
const MIN_CHAT_IDLE_TTL_HOURS = 1;
const MAX_CHAT_IDLE_TTL_HOURS = 720;
const MIN_CHAT_SESSION_RETENTION_DAYS = 1;
const MAX_CHAT_SESSION_RETENTION_DAYS = 730;

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

/**
 * Empty / null / blank = DB session purge disabled.
 * Otherwise a whole number between 1 and 730 days.
 */
function parseChatSessionRetentionDays(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_CHAT_SESSION_RETENTION_DAYS
    || parsed > MAX_CHAT_SESSION_RETENTION_DAYS
  ) {
    return undefined;
  }

  return parsed;
}

function parseOptionalText(value, { maxLength = 200 } = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) return undefined;
  return text;
}

function parseMailFromEmail(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const email = String(value).trim().toLowerCase();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return undefined;
  }
  return email;
}

function formatMailFromAddress(name, email) {
  const fromEmail = String(email || '').trim();
  if (!fromEmail) return null;
  const fromName = String(name || '').trim();
  if (!fromName) return fromEmail;
  return `${fromName} <${fromEmail}>`;
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

  const chatRetention = parseChatSessionRetentionDays(body.chat_session_retention_days);
  if (chatRetention === undefined) {
    const error = new Error(
      `Days to keep AI chat sessions must be empty or a whole number between ${MIN_CHAT_SESSION_RETENTION_DAYS} and ${MAX_CHAT_SESSION_RETENTION_DAYS}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const mailFromName = parseOptionalText(body.mail_from_name, { maxLength: 120 });
  if (mailFromName === undefined) {
    const error = new Error('Mail from name must be 120 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }

  const mailFromEmail = parseMailFromEmail(body.mail_from_email);
  if (mailFromEmail === undefined) {
    const error = new Error('Mail from email must be a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  if (mailFromName && !mailFromEmail) {
    const error = new Error('Mail from email is required when a from name is set.');
    error.statusCode = 400;
    throw error;
  }

  return {
    property_page_records_per_page: pageSize,
    otp_trigger_question_count: otpTrigger,
    chat_idle_ttl_hours: chatIdleTtl,
    chat_session_retention_days: chatRetention,
    mail_from_name: mailFromName,
    mail_from_email: mailFromEmail,
  };
}

function toPublicWebsiteSettings(row = null) {
  const pageSize = parsePropertyPageSize(row?.property_page_records_per_page);
  const otpTrigger = parseOtpTriggerQuestionCount(row?.otp_trigger_question_count);
  const chatIdleTtl = parseChatIdleTtlHours(row?.chat_idle_ttl_hours);
  const chatRetention = parseChatSessionRetentionDays(row?.chat_session_retention_days);
  const mailFromName = parseOptionalText(row?.mail_from_name, { maxLength: 120 });
  const mailFromEmail = parseMailFromEmail(row?.mail_from_email);

  return {
    property_page_records_per_page:
      pageSize ?? DEFAULT_WEBSITE_SETTINGS.property_page_records_per_page,
    otp_trigger_question_count: otpTrigger === undefined
      ? DEFAULT_WEBSITE_SETTINGS.otp_trigger_question_count
      : otpTrigger,
    chat_idle_ttl_hours: chatIdleTtl === undefined
      ? DEFAULT_WEBSITE_SETTINGS.chat_idle_ttl_hours
      : chatIdleTtl,
    chat_session_retention_days: chatRetention === undefined
      ? DEFAULT_WEBSITE_SETTINGS.chat_session_retention_days
      : chatRetention,
    mail_from_name: mailFromName === undefined
      ? DEFAULT_WEBSITE_SETTINGS.mail_from_name
      : mailFromName,
    mail_from_email: mailFromEmail === undefined
      ? DEFAULT_WEBSITE_SETTINGS.mail_from_email
      : mailFromEmail,
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
      chat_session_retention_days: DEFAULT_WEBSITE_SETTINGS.chat_session_retention_days,
      mail_from_name: DEFAULT_WEBSITE_SETTINGS.mail_from_name,
      mail_from_email: DEFAULT_WEBSITE_SETTINGS.mail_from_email,
    },
  });
}

async function getChatSessionRetentionDays(prisma) {
  const settings = await getOrCreateWebsiteSettings(prisma);
  const parsed = parseChatSessionRetentionDays(settings.chat_session_retention_days);
  if (parsed === undefined) {
    return DEFAULT_WEBSITE_SETTINGS.chat_session_retention_days;
  }
  return parsed;
}

async function getMailFromAddress(prisma) {
  const settings = await getOrCreateWebsiteSettings(prisma);
  return formatMailFromAddress(settings.mail_from_name, settings.mail_from_email);
}

module.exports = {
  DEFAULT_WEBSITE_SETTINGS,
  MAX_CHAT_IDLE_TTL_HOURS,
  MAX_CHAT_SESSION_RETENTION_DAYS,
  MAX_OTP_TRIGGER_QUESTIONS,
  MIN_CHAT_IDLE_TTL_HOURS,
  MIN_CHAT_SESSION_RETENTION_DAYS,
  MIN_OTP_TRIGGER_QUESTIONS,
  formatMailFromAddress,
  getChatSessionRetentionDays,
  getMailFromAddress,
  getOrCreateWebsiteSettings,
  parseChatIdleTtlHours,
  parseChatSessionRetentionDays,
  parseMailFromEmail,
  parseOtpTriggerQuestionCount,
  sanitizeWebsiteSettingsInput,
  toPublicWebsiteSettings,
};
