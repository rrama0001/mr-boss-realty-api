// api/routes/auth.js
const express = require('express');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const { getAdminUrl } = require('../config/appUrls');
const authController = require('../controllers/authController');
const prisma = new PrismaClient();

const router = express.Router();

router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// 🔹 Start Google login
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 🔹 Google login callback
router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${getAdminUrl()}/login?error=pending`,
        session: true,
    }),
    (req, res) => {
        // Check if user can login
        if (!req.user?.can_login) {
            req.logout(() => {
                req.session.destroy(() => { });
            });
            return res.redirect(`${getAdminUrl()}/login?error=pending`);
        }

        // ✅ Success
        res.redirect(`${getAdminUrl()}/dashboard`);
    }
);

// 🔹 Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });
});

// 🔹 Check login status
router.get('/status', async (req, res) => {
    try {
        if (!req.isAuthenticated() || !req.user) {
            return res.json({ loggedIn: false });
        }

        const freshUser = await prisma.users.findUnique({
            where: { id: req.user.id },
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
            },
        });

        if (!freshUser || freshUser.can_login === false) {
            req.logout(() => req.session.destroy(() => { }));
            return res.json({
                loggedIn: false,
                message: 'Your account is pending admin approval.',
            });
        }

        res.json({
            loggedIn: true,
            user: {
                id: freshUser.id,
                full_name: freshUser.full_name,
                email: freshUser.email,
                phone: freshUser.phone,
                role: freshUser.role,
                notify_email: freshUser.notify_email,
                notify_sms: freshUser.notify_sms,
                notify_facebook: freshUser.notify_facebook,
            },
        });
    } catch (err) {
        console.error('Auth status error:', err);
        res.status(500).json({ loggedIn: false });
    }
});

module.exports = router;
