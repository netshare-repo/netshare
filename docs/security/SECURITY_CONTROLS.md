# NetShare — Security Controls

## Authentication

- JWT-based authentication with 7-day expiry
- bcrypt password hashing (10 salt rounds)
- Blocked user middleware check on every request
- OTP-based email verification required before login

## Authorization

- Role-based access control: `node_participant`, `platform_client`, `both`, `admin`
- Admin role cannot be self-registered via public API
- Admin accounts created only via `scripts/createAdmin.js`

## OTP Security

- OTPs stored as SHA-256 hash (never plaintext)
- 10-minute expiry
- Max 5 failed attempts before 15-minute lockout
- 60-second cooldown between resend requests
- New OTP invalidates previous OTP
- OTP never included in production API responses
- OTP delivered via SMTP email in production

## Transport Security

- Helmet security headers enabled
- CORS restricted to configured origins (not wildcard)
- Socket.IO connections authenticated via JWT or API key

## Input Validation

- XSS sanitization on all string inputs
- URL validation for task targets
- SSRF protection: DNS resolution with private IP blocking
- Protocol restriction: HTTP/HTTPS only

## Financial Integrity

- MongoDB transactions for wallet operations (when replica set available)
- Idempotency keys prevent duplicate processing
- Append-only transaction records

## Observability

- Structured logging via Pino
- Request correlation IDs
- Sensitive data redacted from logs (passwords, OTPs, tokens, API keys)

## API Error Handling

- Stable error codes in responses
- Stack traces hidden in production
- Request ID included in all error responses
