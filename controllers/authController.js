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
    const phone = String(req.body.phone || '').trim() || null;
    const role = String(req.body.role || 'agent').trim().toLowerCase();

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    if (!['admin', 'agent', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin, agent, or user.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        full_name: fullName,
        email,
        password: hashed,
        phone,
        role,
        notify_email: false,
        notify_sms: false,
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
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
