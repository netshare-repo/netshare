# NetShare — Production Configuration

## Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | Server port | `8000` |
| `MONGO_URI` | MongoDB connection string (replica set) | `mongodb://user:pass@host:27017/netshare?replicaSet=rs0` |
| `JWT_SECRET` | Minimum 32 character random string | `openssl rand -hex 32` |
| `FRONTEND_URL` | Frontend origin for CORS | `https://netshare.example.com` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://netshare.example.com` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `noreply@netshare.io` |
| `SMTP_PASS` | SMTP password | (secret) |
| `SMTP_FROM` | From address for emails | `noreply@netshare.io` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |

## MongoDB Replica Set

MongoDB transactions require a replica set. For production, use MongoDB Atlas or a properly configured replica set.

For local Docker development with transactions:
```bash
# Use the docker-compose.dev.yml with replica set configuration
```

## Startup Validation

The application will FAIL FAST if required variables are missing in production.

## Health Endpoints

- `GET /health/live` — Process liveness
- `GET /health/ready` — Dependency readiness

## Security Notes

- Never set `CORS_ORIGINS` to `*` in production
- JWT_SECRET must be at least 32 characters
- SMTP credentials should use app-specific passwords
- All OTP delivery is via email only in production
