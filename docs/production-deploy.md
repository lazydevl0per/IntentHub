# Production Deployment Guide

Internal production target: Vercel + Neon Postgres + Trigger.dev.

## Architecture

- **App**: Vercel (Next.js 15)
- **Database**: Neon PostgreSQL with pgvector
- **Jobs**: Trigger.dev workers
- **Auth**: NextAuth (credentials + GitHub OAuth)
- **AI**: OpenAI (required), optional Anthropic for chat

## Provisioning Checklist

### 1. Neon Postgres

1. Create a Neon project
2. Enable pgvector in SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy connection string to `DATABASE_URL`
4. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Vercel

1. Import repository from GitHub
2. Set environment variables from `.env.example`
3. Required production variables:
   - `DATABASE_URL`
   - `AUTH_SECRET` (32+ random bytes)
   - `NEXT_PUBLIC_APP_URL` (production URL)
   - `OPENAI_API_KEY`
   - `GITHUB_ID` / `GITHUB_SECRET`
   - `TRIGGER_SECRET_KEY`
4. Ensure `DEMO_MODE` is **unset** or `false`
5. Optional:
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (distributed rate limiting)
   - `SENTRY_DSN` (error tracking)
   - `HEALTH_CHECK_TOKEN` (detailed health endpoint for monitoring)

### 3. GitHub OAuth App

1. Create a dedicated production OAuth app
2. Callback URL: `https://<your-domain>/api/auth/callback/github`
3. Scopes: `read:user`, `user:email`, `repo`

### 4. Trigger.dev

```bash
npx trigger.dev@latest login
npm run deploy:trigger
```

Verify `GET /api/health` with `HEALTH_CHECK_TOKEN` shows `services.trigger: true`.

### 5. Post-deploy verification

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app npm run verify:production
```

Manual checks:

1. Sign in with GitHub
2. Connect a repository
3. Run **Reindex search** on repository settings
4. Push a commit and confirm webhook sync
5. Complete one objective lifecycle (plan → agent run → decision)

## Migration Hygiene

Canonical migrations live under `prisma/migrations/202606*`. Do not add duplicate timestamp prefixes. Verify fresh deploy:

```bash
npx prisma migrate deploy
```
