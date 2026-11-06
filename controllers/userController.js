const bcrypt = require('bcryptjs');
const { prisma } = require('../prisma/prismaClient');

const PUBLIC_USER_SELECT = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  facebook_psid: true,
  role: true,
  can_login: true,
  email_verified: true,
  notify_email: true,
  notify_sms: true,
  notify_facebook: true,
  provider: true,
  provider_id: true,
  created_at: true,
  updated_at: true,
};

function normalizeOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function normalizeRequiredString(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function normalizeBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function normalizeRole(value, fallback = 'agent') {
  if (value === undefined || value === null || value === '') return fallback;
  const role = String(value).trim().toLowerCase();
  if (!['admin', 'agent', 'user'].includes(role)) {
    const error = new Error('Role must be admin, agent, or user.');
    error.statusCode = 400;
    throw error;
  }
  return role;
}

async function buildUserWriteData(body = {}, { isCreate = false } = {}) {
  const data = {};

  if (isCreate || body.full_name !== undefined) {
    data.full_name = normalizeRequiredString(body.full_name, 'Full name');
  }
  if (isCreate || body.email !== undefined) {
    data.email = normalizeRequiredString(body.email, 'Email').toLowerCase();
  }
  if (body.phone !== undefined) {
    data.phone = normalizeOptionalString(body.phone);
  }
  if (body.facebook_psid !== undefined) {
    data.facebook_psid = normalizeOptionalString(body.facebook_psid);
  }
  if (isCreate || body.role !== undefined) {
    data.role = normalizeRole(body.role, isCreate ? 'agent' : undefined);
  }
  if (body.can_login !== undefined) {
    data.can_login = normalizeBoolean(body.can_login, true);
  }
  if (body.email_verified !== undefined) {
    data.email_verified = normalizeBoolean(body.email_verified, false);
  }
  if (body.notify_email !== undefined) {
    data.notify_email = normalizeBoolean(body.notify_email, false);
  }
  if (body.notify_sms !== undefined) {
    data.notify_sms = normalizeBoolean(body.notify_sms, false);
  }
  if (body.notify_facebook !== undefined) {
    data.notify_facebook = normalizeBoolean(body.notify_facebook, false);
  }
  if (body.provider !== undefined) {
    data.provider = normalizeOptionalString(body.provider);
  }
  if (body.provider_id !== undefined) {
    data.provider_id = normalizeOptionalString(body.provider_id);
  }

  if (body.password !== undefined && body.password !== null && String(body.password).trim() !== '') {
    data.password = await bcrypt.hash(String(body.password), 10);
  } else if (isCreate && !body.provider) {
    const error = new Error('Password is required.');
    error.statusCode = 400;
    throw error;
  }

  return data;
}

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: PUBLIC_USER_SELECT,
      orderBy: { id: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const data = await buildUserWriteData(req.body, { isCreate: true });
    const newUser = await prisma.users.create({
      data,
      select: PUBLIC_USER_SELECT,
    });
    res.json(newUser);
  } catch (err) {
    console.error('❌ Error creating user:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await buildUserWriteData(req.body, { isCreate: false });
    const updatedUser = await prisma.users.update({
      where: { id: parseInt(id, 10) },
      data,
      select: PUBLIC_USER_SELECT,
    });
    res.json(updatedUser);
  } catch (err) {
    console.error('❌ Error updating user:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.users.delete({ where: { id: parseInt(id, 10) } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
