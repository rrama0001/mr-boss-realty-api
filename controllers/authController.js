const bcrypt = require('bcryptjs');
const { prisma } = require('../prisma/prismaClient');
const {
  requestPasswordReset,
  resetPasswordWithToken,
} = require('../services/passwordReset');

exports.register = async (req, res) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const passwordConfirm = String(
      req.body.passwordConfirm || req.body.password_confirm || '',
    );
    const phone = String(req.body.phone || '').trim() || null;
    const notifyEmail = req.body.notify_email === true || req.body.notify_email === 'true';
    const notifySms = req.body.notify_sms === true || req.body.notify_sms === 'true';

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const existing = await prisma.users.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please log in instead.',
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        full_name: fullName,
        email,
        password: hashed,
        phone,
        // Public website signup is always a visitor account — never admin/agent.
        role: 'user',
        can_login: true,
        notify_email: notifyEmail,
        notify_sms: Boolean(phone) && notifySms,
        notify_facebook: false,
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        can_login: true,
        notify_email: true,
        notify_sms: true,
        notify_facebook: true,
        created_at: true,
      },
    });

    await new Promise((resolve, reject) => {
      req.login(user, (err) => (err ? reject(err) : resolve()));
    });

    return res.status(201).json({
      message: 'Account created',
      user,
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({
        error: 'An account with this email already exists. Please log in instead.',
      });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Unable to create your account right now.' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user?.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.can_login) {
      return res.status(403).json({
        error: 'Your account is pending admin approval. Please contact your administrator.',
      });
    }

    await new Promise((resolve, reject) => {
      req.login(user, (err) => (err ? reject(err) : resolve()));
    });

    return res.json({
      message: 'Logged in',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Password login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const result = await requestPasswordReset(prisma, req.body.email || req.body.account);
    return res.json(result);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to start password reset.',
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const result = await resetPasswordWithToken(prisma, {
      token: req.body.token,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm || req.body.password_confirm,
    });
    return res.json(result);
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to reset password.',
    });
  }
};

exports.logout = (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out' });
  });
};
