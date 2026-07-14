require('dotenv').config(); // <-- Make sure env variables load before anything else

const { prisma } = require('../prisma/prismaClient');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');

// ✅ Validate required env vars
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    console.warn(`
[⚠️ Google OAuth WARNING]

Google OAuth environment variables are missing.

Please set these in your .env file:

GOOGLE_CLIENT_ID=xxxx
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

Google login will be disabled until these are provided.
`);
} else {
    // ✅ Only load Google Strategy if env vars exist
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: GOOGLE_CALLBACK_URL,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails[0].value;

                    let user = await prisma.users.findFirst({ where: { email } });

                    if (!user) {
                        user = await prisma.users.create({
                            data: {
                                email,
                                provider: "google",
                                provider_id: profile.id,
                                can_login: false, // 🚫 requires admin approval
                                username: profile.displayName.replace(/\s+/g, '').toLowerCase(), // generate one
                            },
                        });
                    }

                    if (!user.can_login) {
                        return done(null, false, { message: "not_allowed" });
                    }

                    return done(null, user);
                } catch (err) {
                    console.error("Google auth error:", err);
                    done(err, null);
                }
            }
        )
    );
}

// 🔹 Required Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.users.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
