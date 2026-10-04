# NetShare — Secret Rotation Guide

## Previously Committed Secrets (MUST BE ROTATED)

The following secrets were committed to the repository and must be considered compromised:

| Secret | Location | Status |
|---|---|---|
| `netshare_phase_one_secret` | `.env` JWT_SECRET | COMPROMISED — rotate immediately |
| `netshare_production_super_secret_distributed_key_99` | `docker-compose.yml` JWT_SECRET | COMPROMISED — rotate immediately |
| `nsk_live_docker_demo_agent_key_01` | `docker-compose.yml` NODE_API_KEY | COMPROMISED — rotate immediately |

## How to Rotate JWT_SECRET

1. Generate new secret: `openssl rand -hex 32`
2. Update `.env` with new value
3. Restart backend
4. All existing user sessions will be invalidated (they must re-login)

## How to Rotate Node API Key

1. Login as the node owner
2. Call `POST /api/node/api-key/regenerate`
3. Update the agent configuration with the new key
4. Restart the agent

## Best Practices

- Never commit secrets to version control
- Use environment variables for all secrets
- Rotate secrets periodically (recommended: every 90 days)
- Use separate secrets for development and production
