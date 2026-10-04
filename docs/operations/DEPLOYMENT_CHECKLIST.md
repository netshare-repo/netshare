# NetShare — Deployment Checklist

## Pre-Deployment

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` is random, minimum 32 characters
- [ ] `MONGO_URI` points to replica set
- [ ] `SMTP_*` variables configured for email delivery
- [ ] `CORS_ORIGINS` set to actual frontend domain(s)
- [ ] `.env` file is NOT in version control
- [ ] Admin account created via `scripts/createAdmin.js`
- [ ] `npm audit` run and critical vulnerabilities addressed
- [ ] Frontend built with production API URL

## Post-Deployment

- [ ] `GET /health/ready` returns 200
- [ ] Registration works (OTP sent via email)
- [ ] Login works
- [ ] Admin login works
- [ ] Task submission works
- [ ] Node agent connects via Socket.IO
- [ ] Logs are being collected
