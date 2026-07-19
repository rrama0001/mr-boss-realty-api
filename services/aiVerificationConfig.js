const { prisma } = require('../prisma/prismaClient');
const {
  getOrCreateWebsiteSettings,
  parseOtpTriggerQuestionCount,
} = require('./websiteSettings');

/**
 * OTP is controlled from Admin → Settings → Website:
 * `otp_trigger_question_count` empty/null = disabled; a number = require OTP after that many
 * client questions on the **website chat only** (not Facebook Messenger).
 */
async function getOtpTriggerQuestionCount() {
  const settings = await getOrCreateWebsiteSettings(prisma);
  const count = parseOtpTriggerQuestionCount(settings.otp_trigger_question_count);
  return count === undefined ? null : count;
}

async function isOtpVerificationEnabled() {
  const count = await getOtpTriggerQuestionCount();
  return count != null;
}

module.exports = {
  getOtpTriggerQuestionCount,
  isOtpVerificationEnabled,
};
