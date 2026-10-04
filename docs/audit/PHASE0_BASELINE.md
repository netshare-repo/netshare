# NetShare — Phase 0 Baseline Snapshot
> Recorded: 2026-09-26 | Pre-implementation state before Phase 0 security/production foundation

---

## 1. Git Status

**Not a git repository.** No `.git` directory exists. No version control history available.

---

## 2. Backend Model Files (14 models)

| # | File | Mongoose Model Name |
|---|---|---|
| 1 | `AdminLog.js` | AdminLog |
| 2 | `BandwidthUsage.js` | BandwidthUsage |
| 3 | `CreditTransaction.js` | CreditTransaction |
| 4 | `MarketplaceOrder.js` | MarketplaceOrder |
| 5 | `MarketplaceProduct.js` | MarketplaceProduct |
| 6 | `NodeDevice.js` | NodeDevice |
| 7 | `NodeHeartbeat.js` | NodeHeartbeat |
| 8 | `NodeTelemetry.js` | NodeTelemetry |
| 9 | `ParticipationSession.js` | ParticipationSession |
| 10 | `TaskResult.js` | TaskResult |
| 11 | `TaskSession.js` | TaskSession |
| 12 | `TestingTask.js` | TestingTask |
| 13 | `User.js` | User |
| 14 | `Wallet.js` | Wallet |

**Note:** Previous audit corrections claimed 15 models including TopUpRequest, WithdrawalRequest, Dispute, AnomalyAlert, Notification — these DO NOT EXIST. The actual count is 14.

---

## 3. Route Files (8)

authRoutes.js, userRoutes.js, nodeRoutes.js, walletRoutes.js, taskRoutes.js, sessionRoutes.js, adminRoutes.js, marketplaceRoutes.js

## 4. Controller Files (8)

authController.js, userController.js, nodeController.js, walletController.js, taskController.js, sessionController.js, adminController.js, marketplaceController.js

## 5. Service Files (5)

rewardService.js, socketService.js, taskAllocationService.js, taskQueueService.js, walletService.js

## 6. Middleware Files (4)

authMiddleware.js, errorMiddleware.js (EMPTY), roleMiddleware.js, securityMiddleware.js

## 7. Utility Files (3)

generateToken.js, generateSessionToken.js, validation.js

## 8. Worker Files (1)

taskWorker.js

## 9. Test Files (1)

tests/distributedSystemTest.js

## 10. Environment Variables (.env)

```
PORT=8000
MONGO_URI=mongodb://localhost:27017/netshare_db
JWT_SECRET=netshare_phase_one_secret
NODE_ENV=development
```

## 11. Security Findings (Pre-Phase 0)

| # | Finding | Severity |
|---|---|---|
| 1 | No .gitignore — .env committed if git initialized | CRITICAL |
| 2 | Admin role in public registration (backend + frontend) | CRITICAL |
| 3 | OTP returned in API response body only (no email) | CRITICAL |
| 4 | JWT_SECRET = `netshare_phase_one_secret` (predictable) | HIGH |
| 5 | CORS `origin: "*"` on Express and Socket.IO | HIGH |
| 6 | No Helmet / security headers | HIGH |
| 7 | No OTP brute-force protection | HIGH |
| 8 | Wallet operations non-atomic (race conditions) | HIGH |
| 9 | No structured logging | MEDIUM |
| 10 | No request correlation IDs | MEDIUM |
| 11 | Error middleware EMPTY — no centralized error handling | MEDIUM |
| 12 | No graceful shutdown | MEDIUM |
| 13 | No health/readiness endpoints (basic only) | MEDIUM |
| 14 | Simulated latency noise in getCurrentSession | LOW |
| 15 | Hardcoded secrets in docker-compose.yml | HIGH |
| 16 | SSRF protection minimal (only 4 hostnames blocked, only in production) | HIGH |
| 17 | No idempotency on task settlement / marketplace refund | HIGH |
| 18 | MongoDB standalone (no replica set for transactions) | MEDIUM |

## 12. Build/Test Status

- Backend: Not tested (no test runner configured, only manual integration test)
- Frontend: Not tested in this baseline
- Flutter: Not touched
- Docker: docker-compose.yml and docker-compose.dev.yml present
