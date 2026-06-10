# IntentHub Internal Runbook

## Environment Reference

See `.env.example` for all variables. Production requires:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection |
| `AUTH_SECRET` | Session encryption |
| `NEXT_PUBLIC_APP_URL` | OAuth callbacks, webhooks |
| `GOOGLE_AI_API_KEY` | Embeddings + chat when `AI_PROVIDER=google` |
| `OPENAI_API_KEY` | Embeddings + chat when `AI_PROVIDER=openai` |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth |
| `TRIGGER_SECRET_KEY` | Background jobs (required in prod) |
| `HEALTH_CHECK_TOKEN` | Detailed health checks and `verify:production` |
| `SENTRY_DSN` | Error tracking (optional) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limits (optional) |

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

### AI provider rate limits / errors

**Symptoms**: Chat fails, agent runs fail, commit insights missing

**Actions**:
1. Check Google AI Studio or OpenAI usage dashboard (whichever `AI_PROVIDER` is set)
2. Review rate limits on chat and agent-execute endpoints
3. Temporarily reduce `GITHUB_SYNC_COMMIT_LIMIT`
4. Retry failed agent runs from objective page
5. After switching embedding providers, run **Reindex search** on affected repositories

### Webhook failures

**Symptoms**: Pushes don't sync, pull requests stale, webhook status "Not registered"

**Actions**:
1. Verify `NEXT_PUBLIC_APP_URL` matches production domain
2. Reconnect repository or re-save settings to re-register webhook
3. Check GitHub repo webhook delivery logs
4. Confirm `webhookSecret` was not rotated without re-registration
5. Use manual **Sync** on the repository page to refresh commits, branches, and pull requests

### Agent runs stuck or missing PRs

**Symptoms**: Agent run `FAILED`, no pull request link on objective page

**Actions**:
1. Confirm the user who started the run has GitHub OAuth linked with `repo` scope
2. Check Trigger.dev run logs for `execute-agent-run`
3. Verify the repository default branch exists and the agent branch was created on GitHub
4. PRs are only opened when the agent applies at least one file edit

### CI evaluations not appearing

**Symptoms**: Agent branch merged but no evaluation from GitHub Actions

**Actions**:
1. Confirm webhook delivers `check_run` events
2. Branch name on the agent run must match `check_run.head_branch`
3. Only completed check runs create evaluations; re-deliver from GitHub webhook logs if needed

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
| `GOOGLE_AI_API_KEY` | Rotate in Google AI Studio, update Vercel env; reindex repos if embeddings changed |
| `OPENAI_API_KEY` | Rotate in OpenAI dashboard, update Vercel env |
| `TRIGGER_SECRET_KEY` | Regenerate in Trigger.dev, redeploy app + workers |

## Cost Monitoring

- **Google AI / OpenAI**: Monitor token usage from agent runs in the active provider dashboard
- **Neon**: Set compute autoscaling limits; watch storage growth from `DocumentChunk`
- **Trigger.dev**: Review run minutes in Trigger dashboard
- **Upstash** (if used): Monitor Redis command volume for rate limiting

## Access Control

- Use a dedicated production GitHub OAuth app (separate from dev)
- Do not use seed account `demo@intenthub.dev` in production
- Repository invites can be created via `POST /api/repositories/[id]/invites` (owners); email delivery and acceptance are not wired yet

## Operational Commands

```bash
npx prisma migrate deploy
npm run deploy:trigger
npm run verify:production
```
