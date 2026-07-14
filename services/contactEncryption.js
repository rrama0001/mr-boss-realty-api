const crypto = require('crypto');
const { normalizeMobileNumber } = require('./aiRestrictedInfo');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const INQUIRY_MAX_LENGTH = 500;

function getEncryptionKey() {
  const raw = String(process.env.LEADS_ENCRYPTION_KEY || '').trim();

  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('LEADS_ENCRYPTION_KEY must be 32 bytes encoded as base64.');
    }
    return key;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('LEADS_ENCRYPTION_KEY is required in production.');
  }

  return crypto.createHash('sha256').update('mr-boss-realty-dev-leads-key').digest();
}

function getHashKey() {
  const raw = String(process.env.LEADS_HASH_KEY || process.env.LEADS_ENCRYPTION_KEY || '').trim();

  if (raw) {
    return Buffer.from(raw, 'base64');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('LEADS_HASH_KEY (or LEADS_ENCRYPTION_KEY) is required in production.');
  }

  return crypto.createHash('sha256').update('mr-boss-realty-dev-leads-hash-key').digest();
}

function normalizeContactForStorage(value) {
  const mobile = normalizeMobileNumber(value);
  if (mobile) return mobile;

  const email = String(value || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email;
  }

  return String(value || '').trim();
}

function encryptContact(value) {
  const plaintext = normalizeContactForStorage(value);
  if (!plaintext) {
    throw new Error('Contact value is required for encryption.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptContact(contactEncrypted) {
  const payload = String(contactEncrypted || '').trim();
  if (!payload) return null;

  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('Invalid encrypted contact payload.');
  }

  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES + TAG_BYTES);
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

function hashContact(value) {
  const normalized = normalizeContactForStorage(value);
  if (!normalized) return null;

  return crypto.createHmac('sha256', getHashKey()).update(normalized).digest('hex');
}

function contactLast4(value) {
  const normalized = normalizeContactForStorage(value);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  return normalized.slice(-4);
}

function maskContactLast4(last4) {
  if (!last4) return 'Verified';
  return `····${last4}`;
}

function formatContactForDisplay(value) {
  const normalized = normalizeContactForStorage(value);
  if (!normalized) return null;

  if (normalized.startsWith('+63') && normalized.length === 13) {
    return `0${normalized.slice(3)}`;
  }

  return normalized;
}

function truncateInquiryMessage(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= INQUIRY_MAX_LENGTH) return text;
  return `${text.slice(0, INQUIRY_MAX_LENGTH - 1)}…`;
}

module.exports = {
  contactLast4,
  decryptContact,
  encryptContact,
  formatContactForDisplay,
  hashContact,
  maskContactLast4,
  normalizeContactForStorage,
  truncateInquiryMessage,
};
