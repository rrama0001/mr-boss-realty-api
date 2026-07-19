const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;
const sessions = new Map();

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getSession(userKey) {
  return sessions.get(userKey) || null;
}

function setSession(userKey, data) {
  sessions.set(userKey, {
    ...data,
    updatedAt: Date.now(),
  });
}

function clearSession(userKey) {
  sessions.delete(userKey);
}

function beginVerification(userKey, { topic, pendingMessage, buildingRef = null, unitRef = null, projectSlug = null, pageUrl = null }) {
  setSession(userKey, {
    status: 'consent_pending',
    topic,
    pendingMessage,
    buildingRef,
    unitRef,
    projectSlug,
    pageUrl,
    contact: null,
    otpHash: null,
    otpExpiresAt: null,
    verified: false,
  });
}

function markConsentAgreed(userKey) {
  const session = getSession(userKey);
  if (!session) return null;

  setSession(userKey, {
    ...session,
    status: 'contact_pending',
    consentAt: Date.now(),
  });

  return getSession(userKey);
}

function markConsentDeclined(userKey) {
  clearSession(userKey);
}

function setContact(userKey, contact, code = null, channel = 'sms') {
  const session = getSession(userKey);
  if (!session) return null;

  const otpCode = code || generateOtpCode();
  const otpHash = hashOtp(otpCode);
  const otpExpiresAt = Date.now() + OTP_TTL_MS;

  setSession(userKey, {
    ...session,
    status: 'otp_pending',
    contact: String(contact || '').trim(),
    contactChannel: channel === 'email' ? 'email' : 'sms',
    otpHash,
    otpExpiresAt,
  });

  return { code: otpCode, otpExpiresAt };
}

function verifyOtp(userKey, code) {
  const session = getSession(userKey);
  if (!session || session.status !== 'otp_pending') {
    return { ok: false, reason: 'no_pending_otp' };
  }

  if (!session.otpExpiresAt || Date.now() > session.otpExpiresAt) {
    clearSession(userKey);
    return { ok: false, reason: 'expired' };
  }

  if (hashOtp(code) !== session.otpHash) {
    return { ok: false, reason: 'invalid' };
  }

  setSession(userKey, {
    ...session,
    status: 'verified',
    verified: true,
    otpHash: null,
    otpExpiresAt: null,
  });

  return { ok: true, session: getSession(userKey) };
}

function isVerified(userKey) {
  const session = getSession(userKey);
  return Boolean(session?.verified);
}

module.exports = {
  beginVerification,
  clearSession,
  generateOtpCode,
  getSession,
  isVerified,
  markConsentAgreed,
  markConsentDeclined,
  setContact,
  verifyOtp,
};
