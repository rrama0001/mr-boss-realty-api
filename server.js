// server.js
require('dotenv').config();

const { logDeliveryStatusOnStartup } = require('./services/smsOtpDelivery');

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const path = require('path');
const {
    writeLockFile,
    clearLockFile,
} = require('./scripts/dev-process');

// ✅ Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

const { getCorsOrigins } = require('./config/appUrls');

// ✅ CORS setup (admin dashboard + public website)
const corsOrigins = getCorsOrigins();
const corsOptions = {
    origin(origin, callback) {
        // Allow non-browser clients (curl, server-to-server) with no Origin header
        if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true, // allow cookies (admin auth)
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ Middleware
app.use(express.json());
app.set('trust proxy', 1);

// ✅ Public SEO routes (sitemap + robots) — generated dynamically from the database
app.use('/', require('./routes/sitemap'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Session setup (for Passport)
// Works on both local development and production
// app.use(
//     session({
//         secret: process.env.SESSION_SECRET || 'keyboard cat',
//         resave: false,
//         saveUninitialized: false,
//         cookie: {
//             domain: process.env.NODE_ENV === 'production' ? '.mrbossrealty.com' : undefined,
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production' ? true : false, // HTTPS only in prod
//             sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // adjust for prod
//             maxAge: process.env.NODE_ENV === 'production' ? 1000 * 60 * 60 * 24 * 7 : undefined,
//         },
//     })
// );

// Temporary for production, enforce specific cookie settings
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'dev_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV == 'production' ? true : false,
            sameSite: process.env.NODE_ENV == 'production' ? 'none' : 'lax', // adjust for prod
            domain: process.env.NODE_ENV == 'production' ? '.mrbossrealty.com' : undefined,
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        },
    })
);

// ✅ Passport setup
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// ✅ Disable caching for all API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); // ensures API always returns fresh data
    next();
});

// ✅ API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/units', require('./routes/units'));
app.use('/api/unit-types', require('./routes/unitTypes'));
app.use('/api/building-types', require('./routes/buildingTypes'));
app.use('/api/building-statuses', require('./routes/buildingStatuses'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/buildings', require('./routes/buildings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai-settings', require('./routes/aiSettings'));
app.use('/api/company-profile', require('./routes/companyProfile'));
app.use('/api/messenger', require('./routes/messenger'));

// ✅ Temporary DB test route
const { prisma } = require('./prisma/prismaClient');
app.get('/api/db-test', async (req, res) => {
    try {
        const result = await prisma.users.findFirst(); // simple query
        res.json({ success: true, firstUser: result });
    } catch (err) {
        console.error("DB connection failed:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ Root route
app.get('/', (req, res) => {
    res.send('🚀 Mr. Boss Realty API is running.');
});

// ✅ Start server
const server = app.listen(PORT, () => {
    writeLockFile({
        serverPid: process.pid,
        nodemonPid: process.ppid,
        port: Number(PORT),
        startedAt: new Date().toISOString(),
    });

    console.log(`✅ Backend running at http://localhost:${PORT}`);
    logDeliveryStatusOnStartup();
    if (process.env.NODE_ENV === 'production') {
        console.log(`✅ Primary URL: ${process.env.API_URL || 'Not set'}`);
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('   Run: npm run stop');
        console.error('   Then start again: npm run dev');
        process.exit(1);
    }

    throw err;
});

let shuttingDown = false;

async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\nShutting down API server...');

    clearLockFile();

    server.close(async () => {
        try {
            await prisma.$disconnect();
        } catch (_) {
            // ignore disconnect errors during shutdown
        }
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
