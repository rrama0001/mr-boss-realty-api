const OTP_TTL_MINUTES = 10;

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_SMS_FROM,
  );
}

function isSemaphoreConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY);
}

function isSmsDeliveryConfigured() {
  return isTwilioConfigured() || isSemaphoreConfigured();
}

function buildOtpSmsBody(code) {
  return `Your Mr. Boss Realty verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
}

async function sendViaTwilio(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twilio API error (${response.status}): ${errorBody}`);
  }

  return { delivered: true, provider: 'twilio', devFallback: false };
}

async function sendViaSemaphore(to, body) {
  const params = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY,
    number: to.replace(/^\+/, ''),
    message: body,
    sendername: process.env.SEMAPHORE_SENDER_NAME || 'MRBOSS',
  });

  const response = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Semaphore API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  if (Array.isArray(result) && result[0]?.status === 'Failed') {
    throw new Error(result[0]?.message || 'Semaphore SMS delivery failed.');
  }

  return { delivered: true, provider: 'semaphore', devFallback: false };
}

async function sendOtpSms(to, code) {
  const mobile = String(to || '').trim();
  if (!mobile) {
    throw new Error('Mobile number is required.');
  }

  const body = buildOtpSmsBody(code);

  if (isTwilioConfigured()) {
    return sendViaTwilio(mobile, body);
  }

  if (isSemaphoreConfigured()) {
    return sendViaSemaphore(mobile, body);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMS delivery is not configured. Set TWILIO_* or SEMAPHORE_API_KEY.');
  }

  console.info(`[AI OTP SMS] not configured — dev fallback to=${mobile} code=${code}`);
  return { delivered: false, provider: 'dev', devFallback: true };
}

function logDeliveryStatusOnStartup() {
  if (isTwilioConfigured()) {
    console.info('[sms] OTP delivery: Twilio configured');
    return;
  }

  if (isSemaphoreConfigured()) {
    console.info('[sms] OTP delivery: Semaphore configured');
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[sms] OTP delivery is NOT configured. Set TWILIO_* or SEMAPHORE_API_KEY in production.');
    return;
  }

  console.warn('[sms] OTP delivery is NOT configured. OTP codes will only appear in dev preview until SMS provider env vars are set.');
}

module.exports = {
  isSmsDeliveryConfigured,
  logDeliveryStatusOnStartup,
  sendOtpSms,
};
