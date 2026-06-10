# IntentHub Internal Runbook

## Environment Reference

See `.env.example` for all variables. Production requires:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection |
| `AUTH_SECRET` | Session encryption |
| `NEXT_PUBLIC_APP_URL` | OAuth callbacks, webhooks |
| `OPENAI_API_KEY` | Embeddings, chat, agents |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth |
| `TRIGGER_SECRET_KEY` | Background jobs (required in prod) |

Never set `DEMO_MODE=true` in production.

## Incident Playbook

### Database unavailable

**Symptoms**: `/api/health` returns 503, `db: disconnected`

**Actions**:
1. Check Neon dashboard status
2. Verify `DATABASE_URL` in Vercel env vars
3. Test connection: `npx prisma db execute --stdin <<< "SELECT 1"`
4. Enable Neon point-in-time recovery if data loss suspected

### Trigger.dev jobs failing

**Symptoms**: Sync/reindex/agent runs stuck, no progress in Trigger dashboard

**Actions**:
1. Check Trigger.dev project status
2. Verify `TRIGGER_SECRET_KEY` matches deployed worker
3. Re-deploy tasks: `npm run deploy:trigger`
4. Use manual **Sync** on repository page as fallback (limited, may timeout on Vercel)

### OpenAI rate limits / errors

**Symptoms**: Chat fails, agent runs fail, commit insights missing

**Actions**:
1. Check OpenAI usage dashboard
2. Review rate limits on chat and agent-execute endpoints
3. Temporarily reduce `GITHUB_SYNC_COMMIT_LIMIT`
4. Retry failed agent runs from objective page

### Webhook failures

**Symptoms**: Pushes don't sync, webhook status "Not registered"

**Actions**:
1. Verify `NEXT_PUBLIC_APP_URL` matches production domain
2. Reconnect repository or re-save settings to re-register webhook
3. Check GitHub repo webhook delivery logs
4. Confirm `webhookSecret` was not rotated without re-registration

## Backup Strategy

- Enable Neon PITR (point-in-time recovery) on production branch
- Export critical objectives/decisions periodically via Prisma if needed
- Git remains source of truth for code

## Secret Rotation

| Secret | Rotation procedure |
|--------|-------------------|
| `AUTH_SECRET` | Generate new value in Vercel, redeploy (invalidates all sessions) |
| `GITHUB_SECRET` | Update OAuth app + Vercel env, redeploy |
| Webhook secrets | Per-repo; disconnect and reconnect repository |
| `OPENAI_API_KEY` | Rotate in OpenAI dashboard, update Vercel env |
| `TRIGGER_SECRET_KEY` | Regenerate in Trigger.dev, redeploy app + workers |

## Cost Monitoring

- **OpenAI**: Monitor token usage from agent runs in OpenAI dashboard
- **Neon**: Set compute autoscaling limits; watch storage growth from `DocumentChunk`
- **Trigger.dev**: Review run minutes in Trigger dashboard
- **Upstash** (if used): Monitor Redis command volume for rate limiting

## Access Control

- Use a dedicated production GitHub OAuth app (separate from dev)
- Do not use seed account `demo@intenthub.dev` in production
- Team access via shared GitHub org repos (invite flow deferred)

## Operational Commands

```bash
npx prisma migrate deploy
npm run deploy:trigger
npm run verify:production
```
