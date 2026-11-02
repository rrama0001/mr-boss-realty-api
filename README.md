# Mr. Boss Realty API

Express + Prisma backend for the Mr. Boss Realty admin and public website.

## Tech stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| HTTP framework | Express |
| ORM / migrations | Prisma |
| Database | PostgreSQL (local or [Neon](https://neon.tech)) |
| Auth | Passport (local + Google OAuth 2.0), express-session, bcryptjs |
| AI chat | OpenAI API |
| File uploads | Multer; Cloudflare R2 via AWS S3 SDK (local `./uploads` fallback) |
| Email | Nodemailer |
| SMS OTP | Twilio or Semaphore (optional) |
| HTTP client | Axios |
| Config | dotenv |
| Dev reload | Nodemon |

## Requirements

- **Node.js** 18+ (LTS recommended)
- **npm**
- **PostgreSQL** 14+ running locally (default port `5432`)
- Database named `mr_boss_realty` (create it in pgAdmin or via `psql`)

Optional for full features:

- OpenAI API key (AI chat)
- Cloudflare R2 credentials (cloud image uploads; otherwise uses local `./uploads`)
- Twilio or Semaphore (SMS OTP; without these, OTP codes appear in the API/dev preview only)

## Setup

```bash
cd mr-boss-realty-api
npm install
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | Example / notes |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@localhost:5432/mr_boss_realty` |
| `PORT` | `3000` |
| `API_URL` | `http://localhost:3000` |
| `ADMIN_URL` | `http://localhost:5173` |
| `WEBSITE_URL` | `http://localhost:5174` |
| `SESSION_SECRET` | Any long random string |

Generate Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Seed demo data (projects, buildings, units, admin user):

```bash
npm run seed
```

## Start the API (development)

```bash
npm run dev
```

Server runs at **http://localhost:3000**.

Stop a stuck/orphan dev process:

```bash
npm run stop
```

## Start the API (production-style)

```bash
npm start
```

Runs `node server.js` without nodemon file watching.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API with nodemon |
| `npm run stop` | Stop local API dev processes |
| `npm start` | Start API once (no reload) |
| `npm run seed` | Seed database |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:migrate` | Create/apply a new migration (dev) |
| `npx prisma migrate deploy` | Apply existing migrations (CI/local setup) |

## Local checklist

1. PostgreSQL service is running and reachable on the port in `DATABASE_URL`
2. Database `mr_boss_realty` exists
3. Migrations applied (`npx prisma migrate deploy`)
4. `.env` points at that database
5. `npm run dev` shows `Backend running at http://localhost:3000`

If the website or admin loads but listings are empty, confirm the API can reach Postgres and that tables have data (`npm run seed` or create inventory in the admin app).
