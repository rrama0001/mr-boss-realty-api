const nodemailer = require('nodemailer');
const { prisma } = require('../prisma/prismaClient');
const { getMailFromAddress } = require('./websiteSettings');

const OTP_TTL_MINUTES = 10;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS,
  );
}

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function isEmailDeliveryConfigured() {
  return isSmtpConfigured() || isResendConfigured();
}

function getEnvFromAddress() {
  return process.env.OTP_EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || 'Mr. Boss Realty <onboarding@resend.dev>';
}

async function resolveFromAddress() {
  try {
    const configured = await getMailFromAddress(prisma);
    if (configured) return configured;
  } catch (error) {
    console.warn('[email] Failed to load mailing settings:', error?.message || error);
  }
  return getEnvFromAddress();
}

function createTransport() {
  if (!isSmtpConfigured()) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildOtpEmailContent(code) {
  const subject = 'Your Mr. Boss Realty verification code';
  const text = [
    'Your one-time verification code is:',
    '',
    code,
    '',
    `This code expires in ${OTP_TTL_MINUTES} minutes.`,
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f2744;">
      <p>Your one-time verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0;">${code}</p>
      <p style="color:#64748b;font-size:14px;">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
      <p style="color:#64748b;font-size:14px;">If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function createEmailDeliveryError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function explainResendFailure(status, errorBody, from) {
  let parsed = null;
  try {
    parsed = JSON.parse(errorBody);
  } catch (_) {
    parsed = null;
  }

  const providerMessage = String(parsed?.message || errorBody || '').trim();
  const lower = providerMessage.toLowerCase();

  if (lower.includes('domain is not verified') || lower.includes('verify your domain')) {
    return createEmailDeliveryError(
      `The From email domain is not verified in Resend yet. Verify it at resend.com/domains, or temporarily clear Settings → Website → Mailing and use OTP_EMAIL_FROM=Mr. Boss Realty <onboarding@resend.dev> for local testing.`,
      400,
    );
  }

  if (lower.includes('only send testing emails to your own email')) {
    return createEmailDeliveryError(
      `Resend test mode can only send to your Resend account email until a domain is verified. Verify mrbossrealty.com at resend.com/domains, or request the reset using your Resend account email.`,
      400,
    );
  }

  return createEmailDeliveryError(
    `Email could not be sent${from ? ` (from ${from})` : ''}. ${providerMessage || `Resend returned ${status}.`}`,
    status >= 400 && status < 500 ? 400 : 502,
  );
}

async function sendViaResend(to, subject, html, text, from) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw explainResendFailure(response.status, errorBody, from);
  }

  return { delivered: true, provider: 'resend', devFallback: false };
}

async function sendViaSmtp(to, subject, html, text, from) {
  const transport = createTransport();
  if (!transport) {
    return null;
  }

  await transport.verify();
  await transport.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  return { delivered: true, provider: 'smtp', devFallback: false };
}

async function sendEmail(to, { subject, text, html }) {
  const email = String(to || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Email address is required.');
  }

  const from = await resolveFromAddress();

  if (isResendConfigured()) {
    return sendViaResend(email, subject, html, text, from);
  }

  if (isSmtpConfigured()) {
    const result = await sendViaSmtp(email, subject, html, text, from);
    if (result) {
      return result;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY or SMTP settings.');
  }

  console.info(`[email] not configured — dev fallback to=${email} subject=${subject}`);
  return { delivered: false, provider: 'dev', devFallback: true };
}

async function sendOtpEmail(to, code) {
  const { subject, text, html } = buildOtpEmailContent(code);
  const result = await sendEmail(to, { subject, text, html });
  if (result.devFallback) {
    console.info(`[AI OTP email] not configured — dev fallback to=${to} code=${code}`);
  }
  return result;
}

function buildPasswordResetEmailContent(resetUrl) {
  const subject = 'Reset your Mr. Boss Realty password';
  const text = [
    'We received a request to set or reset your Mr. Boss Realty account password.',
    '',
    'Open this link to choose a new password:',
    resetUrl,
    '',
    'This link expires in 1 hour. If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f2744;">
      <p>We received a request to set or reset your Mr. Boss Realty account password.</p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#0f2744;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">
          Choose a new password
        </a>
      </p>
      <p style="color:#64748b;font-size:14px;">Or copy this link:<br>${resetUrl}</p>
      <p style="color:#64748b;font-size:14px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

async function sendPasswordResetEmail(to, resetUrl) {
  const { subject, text, html } = buildPasswordResetEmailContent(resetUrl);
  return sendEmail(to, { subject, text, html });
}

function logDeliveryStatusOnStartup() {
  if (isResendConfigured()) {
    console.info('[email] OTP delivery: Resend API configured');
    return;
  }

  if (isSmtpConfigured()) {
    console.info('[email] OTP delivery: SMTP configured (%s)', process.env.SMTP_HOST);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[email] OTP delivery is NOT configured. Set RESEND_API_KEY or SMTP_* in production.');
    return;
  }

  console.warn('[email] OTP delivery is NOT configured. OTP codes will only appear in dev preview until RESEND_API_KEY or SMTP_* is set.');
}

module.exports = {
  isEmailDeliveryConfigured,
  isResendConfigured,
  isSmtpConfigured,
  logDeliveryStatusOnStartup,
  sendEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
};
