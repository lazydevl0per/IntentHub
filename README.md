# IntentHub

Git versions code. IntentHub versions decisions.

IntentHub is an AI-native collaboration layer on top of Git that preserves objectives, plans, agent runs, evaluations, and decision records.

## Stack

- Next.js 15 (App Router)
- TypeScript, Tailwind CSS, shadcn/ui-style components
- PostgreSQL + Prisma
- NextAuth (credentials + GitHub OAuth)
- OpenAI (RAG chat + embeddings)
- GitHub API + webhooks
- Trigger.dev (background sync, indexing, webhooks)

## Local Setup

### 1. Start PostgreSQL

```bash
docker compose up -d
```

Uses `pgvector/pgvector:pg16` on port 5432.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

- `AUTH_SECRET` — run `openssl rand -base64 32`
- `GITHUB_ID` / `GITHUB_SECRET` — GitHub OAuth app credentials
- `OPENAI_API_KEY` — for repository chat
- `GITHUB_WEBHOOK_SECRET` — for webhook signature verification

### 3. Install and migrate

```bash
npm install
npm run db:migrate
npm run db:seed
```

### 4. Run dev server

In one terminal:

```bash
npm run dev
```

For background jobs (sync, indexing, webhooks), run Trigger.dev in a second terminal:

```bash
npx trigger.dev@latest login
npm run dev:trigger
```

Set `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` from your [Trigger.dev](https://trigger.dev) project dashboard. Without these, jobs run inline in the API process (fine for local testing).

Open [http://localhost:3000](http://localhost:3000).

Demo account after seeding: `demo@intenthub.dev` / `password123`

## GitHub OAuth App

1. Create a GitHub OAuth App
2. Set callback URL to `http://localhost:3000/api/auth/callback/github`
3. Request scopes: `read:user`, `user:email`, `repo`

## Webhooks (optional)

Point GitHub webhooks to:

```
POST /api/webhooks/github
```

Events: `push`, `create`, `delete`

For local development, use [smee.io](https://smee.io) or ngrok to tunnel webhooks.

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables from `.env.example`
4. Use [Neon](https://neon.tech) PostgreSQL with `pgvector` enabled:
   - Create a project and copy the connection string to `DATABASE_URL`
   - In the Neon SQL editor, run: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Run migrations: `npx prisma migrate deploy` (or let Vercel build handle `prisma generate`)
5. Set `NEXT_PUBLIC_APP_URL` to your production URL
6. Update GitHub OAuth callback to `https://<your-domain>/api/auth/callback/github`
7. Verify deployment health at `GET /api/health`
8. Deploy Trigger.dev tasks: `npm run deploy:trigger` (add `TRIGGER_SECRET_KEY` to Trigger.dev env)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/repositories/[id]` | Repository objectives, commits, chat |
| `/repositories/[id]/settings` | Repository sync, webhook status, branches |
| `/objectives/[id]` | Plans, runs, evaluations, decision |
| `/knowledge-graph/[objectiveId]` | Interactive knowledge graph |

## API Overview

- `POST /api/auth/register` — email/password registration
- `GET/POST /api/repositories` — list/connect repositories
- `GET/POST /api/repositories/[id]/objectives` — objectives CRUD
- `POST /api/objectives/[id]/plans` — create plans
- `POST /api/objectives/[id]/agent-runs` — record agent runs
- `POST /api/objectives/[id]/evaluations` — record evaluations
- `POST /api/objectives/[id]/decision` — record decision
- `POST /api/repositories/[id]/chat` — RAG chat (streamed)
- `GET /api/health` — database connectivity check
- `POST /api/webhooks/github` — GitHub webhook handler
