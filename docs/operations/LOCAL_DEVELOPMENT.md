# NetShare — Local Development Guide

## Prerequisites

- Node.js 18+ 
- Docker Desktop (for MongoDB and Redis)
- npm

## Quick Start

### 1. Start Infrastructure Services

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts MongoDB on port 27017 and Redis on port 6379.

### 2. Backend Setup

```bash
cd netshare-backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

Backend runs on http://localhost:8000

### 3. Frontend Setup

```bash
cd netshare-frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### 4. Create Admin Account

```bash
cd netshare-backend
node scripts/createAdmin.js --email admin@netshare.io --password Admin123! --name "Admin"
```

## Environment Variables

See `netshare-backend/.env.example` for all available configuration.

Required for local development:
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — Any string for dev (min 32 chars for production)

Optional:
- `SMTP_*` — Configure for real email delivery. Without SMTP, OTPs are logged to console in dev mode.
- `REDIS_*` — Without Redis, task queue uses in-memory fallback.

## Health Check

- Liveness: GET http://localhost:8000/health/live
- Readiness: GET http://localhost:8000/health/ready

## Useful Commands

```bash
# Run existing integration test
cd tests && node distributedSystemTest.js

# Check backend logs (structured JSON in production, pretty in dev)
npm run dev
```
