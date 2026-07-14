// api/routes/auth.js
const express = require('express');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const { getAdminUrl } = require('../config/appUrls');
const prisma = new PrismaClient();

const router = express.Router();

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
            select: { id: true, username: true, email: true, role: true, can_login: true },
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
                username: freshUser.username,
                email: freshUser.email,
                role: freshUser.role
            },
        });
    } catch (err) {
        console.error('Auth status error:', err);
        res.status(500).json({ loggedIn: false });
    }
});

module.exports = router;
