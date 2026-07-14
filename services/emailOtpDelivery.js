const nodemailer = require('nodemailer');

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

function getFromAddress() {
  return process.env.OTP_EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || 'Mr. Boss Realty <onboarding@resend.dev>';
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

async function sendViaResend(to, subject, html, text) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }

  return { delivered: true, provider: 'resend', devFallback: false };
}

async function sendViaSmtp(to, subject, html, text) {
  const transport = createTransport();
  if (!transport) {
    return null;
  }

  await transport.verify();
  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text,
  });

  return { delivered: true, provider: 'smtp', devFallback: false };
}

async function sendOtpEmail(to, code) {
  const email = String(to || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Email address is required.');
  }

  const { subject, text, html } = buildOtpEmailContent(code);

  if (isResendConfigured()) {
    return sendViaResend(email, subject, html, text);
  }

  if (isSmtpConfigured()) {
    const result = await sendViaSmtp(email, subject, html, text);
    if (result) {
      return result;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY or SMTP settings.');
  }

  console.info(`[AI OTP email] not configured — dev fallback to=${email} code=${code}`);
  return { delivered: false, provider: 'dev', devFallback: true };
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
  sendOtpEmail,
};
