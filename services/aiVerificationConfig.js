function isOtpVerificationEnabled() {
  const raw = process.env.AI_OTP_VERIFICATION_ENABLED;
  if (raw === undefined || raw === '') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

module.exports = {
  isOtpVerificationEnabled,
};
