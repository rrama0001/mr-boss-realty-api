const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { buildWebsitePath } = require('../config/siteUrls');
const { sendPasswordResetEmail } = require('./emailOtpDelivery');

const RESET_TTL_MS = 60 * 60 * 1000;
const GENERIC_SUCCESS_MESSAGE =
  'If an account matches that email, password reset instructions have been sent.';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requestPasswordReset(prisma, emailInput) {
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes('@')) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      full_name: true,
      can_login: true,
    },
  });

  // Always look successful to avoid account enumeration.
  if (!user) {
    return {
      message: GENERIC_SUCCESS_MESSAGE,
      emailed: false,
    };
  }

  const token = createResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: expiresAt,
    },
  });

  const resetUrl = buildWebsitePath(`/reset-password?token=${encodeURIComponent(token)}`);
  const delivery = await sendPasswordResetEmail(user.email, resetUrl);

  const payload = {
    message: GENERIC_SUCCESS_MESSAGE,
    emailed: Boolean(delivery?.delivered),
  };

  if (delivery?.devFallback) {
    payload.preview = {
      resetUrl,
      expiresAt: expiresAt.toISOString(),
    };
    console.info(`[password-reset] Dev preview link for ${user.email}: ${resetUrl}`);
  }

  return payload;
}

async function resetPasswordWithToken(prisma, {
  token,
  password,
  passwordConfirm,
}) {
  const rawToken = String(token || '').trim();
  const nextPassword = String(password || '');
  const confirm = String(passwordConfirm || '');

  if (!rawToken) {
    const error = new Error('This reset link is missing or invalid.');
    error.statusCode = 400;
    throw error;
  }

  if (nextPassword.length < 8) {
    const error = new Error('Password must be at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (nextPassword !== confirm) {
    const error = new Error('Passwords do not match.');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashResetToken(rawToken);
  const user = await prisma.users.findFirst({
    where: {
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: { gt: new Date() },
    },
    select: { id: true, email: true, full_name: true },
  });

  if (!user) {
    const error = new Error('This reset link is invalid or has expired. Request a new one.');
    error.statusCode = 400;
    throw error;
  }

  const hashed = await bcrypt.hash(nextPassword, 10);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      password: hashed,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
      email_verified: true,
    },
  });

  return {
    message: 'Your password has been updated. You can now log in with your email and password.',
    email: user.email,
  };
}

module.exports = {
  GENERIC_SUCCESS_MESSAGE,
  requestPasswordReset,
  resetPasswordWithToken,
};
