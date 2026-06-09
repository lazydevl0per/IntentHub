# IntentHub

Git versions code. IntentHub versions decisions.

IntentHub is an AI-native collaboration layer on top of Git. It preserves objectives, plans, agent runs, evaluations, and decision records — linked to commits and searchable over time.

## Features

- **Authentication** — email/password registration and GitHub OAuth
- **Repository integration** — connect GitHub repos, sync commits/branches, auto-register webhooks
- **Objectives** — create, edit, and track work with status and priority
- **Plans** — multiple implementation approaches per objective
- **Agent runs** — record runs manually or execute an AI agent on a plan (creates a Git branch + implementation report)
- **Evaluations** — test, benchmark, security, and quality results
- **Decision records** — capture the winning plan, rationale, and linked commit
- **Objective summaries** — AI-generated business/technical summaries when a decision is recorded
- **Semantic commit insights** — intent, architecture impact, and test status on synced commits
- **Repository chat** — hybrid RAG (vector + full-text search) with persistent chat sessions
- **Knowledge graph** — interactive view of objective → plan → run → evaluation → decision → commit

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui-style components
- PostgreSQL + Prisma + pgvector
- NextAuth (credentials + GitHub OAuth)
- OpenAI (embeddings + chat) with optional Anthropic for chat
- GitHub API + webhooks
- Trigger.dev (background sync, indexing, webhooks, AI jobs, agent execution)

## Demo Mode

Browse the UI without Docker, PostgreSQL, or authentication:

```bash
npm install
npm run dev:demo
```

Open [http://localhost:3000](http://localhost:3000). Sample data is pre-loaded — write actions (connect repo, sync, forms, chat send) are disabled.

| Route | Description |
|-------|-------------|
| `/` | Dashboard with repo, active objective, recent decision |
| `/repositories/demo-repo` | Objectives, commits with insights, RAG chat (read-only) |
| `/repositories/demo-repo/settings` | Sync, webhook, branches, agent config |
| `/objectives/seed-objective-1` | Completed objective with plans, runs, evaluation, decision |
| `/knowledge-graph/seed-objective-1` | Interactive knowledge graph |

For full functionality, use the [Local Setup](#local-setup) below.

### Public demo hosting

Deploy a read-only demo to Vercel without a database:

1. Create a Vercel project from this repository
2. Set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`
3. Set `AUTH_SECRET` to any random string and `NEXT_PUBLIC_APP_URL` to your Vercel URL
4. Use the build command from `vercel.json` (`prisma generate && next build`)
5. Open the deployed URL — sample data loads from fixtures with write actions disabled

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

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Session secret (`openssl rand -base64 32`) |
| `GITHUB_ID` / `GITHUB_SECRET` | For GitHub | OAuth app credentials |
| `OPENAI_API_KEY` | For AI | Embeddings, chat, summaries, commit insights, agents |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (e.g. `http://localhost:3000`) — used for webhook registration |
| `TRIGGER_SECRET_KEY` | Optional | Trigger.dev secret key; without it, jobs run inline |
| `TRIGGER_PROJECT_REF` | Optional | Trigger.dev project ref |
| `AI_PROVIDER` | Optional | `openai` (default) or `anthropic` for chat |
| `AI_CHAT_MODEL` | Optional | Chat model (default `gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | If using Anthropic | Required when `AI_PROVIDER=anthropic` |
| `GITHUB_WEBHOOK_SECRET` | Optional | Fallback webhook secret if per-repo secret is unset |
| `GITHUB_SYNC_COMMIT_LIMIT` | Optional | Max commits per sync (default `500`) |
| `GITHUB_SYNC_BRANCH_LIMIT` | Optional | Max branches per sync (default `100`) |

### 3. Install and migrate

```bash
npm install
npm run db:migrate
npm run db:seed
```

### 4. Run dev servers

Terminal 1 — Next.js:

```bash
npm run dev
```

Terminal 2 — Trigger.dev (recommended for sync, indexing, webhooks, AI jobs):

```bash
npx trigger.dev@latest login
npm run dev:trigger
```

Open [http://localhost:3000](http://localhost:3000).

Demo account after seeding: `demo@intenthub.dev` / `password123`

Link GitHub via OAuth to connect repositories and run agents (branch creation requires a linked GitHub account).

## GitHub OAuth App

1. Create a GitHub OAuth App
2. Set callback URL to `http://localhost:3000/api/auth/callback/github` (or your production URL)
3. Request scopes: `read:user`, `user:email`, `repo`

## Webhooks

When you connect a repository, IntentHub automatically registers a webhook at:

```
POST /api/webhooks/github
```

Events: `push`, `create`, `delete`, `pull_request`, `check_run`

Check webhook status on the repository **Settings** page. If auto-registration fails, verify `NEXT_PUBLIC_APP_URL` is correct.

For local development without a public URL, use [smee.io](https://smee.io) or ngrok to tunnel webhooks, or rely on manual **Sync** from the repository page.

## Deploy to Vercel

1. Push to GitHub and import the project in Vercel
2. Add environment variables from `.env.example`
3. Use [Neon](https://neon.tech) PostgreSQL with `pgvector` enabled:
   - Copy the connection string to `DATABASE_URL`
   - In the Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Run migrations: `npx prisma migrate deploy`
4. Set `NEXT_PUBLIC_APP_URL` to your production URL
5. Update the GitHub OAuth callback to `https://<your-domain>/api/auth/callback/github`
6. Verify health: `GET /api/health` — expect `{ status: "ok", db: "connected", services: { ... } }`
7. Deploy Trigger.dev tasks: `npm run deploy:trigger`
8. Connect a repository, create an objective, and trigger **Reindex search** on the repository settings page
9. Confirm GitHub webhooks arrive at `/api/webhooks/github` after a push

### Production verification checklist

| Check | How |
|-------|-----|
| Database | `GET /api/health` returns `db: "connected"` |
| Background jobs | `services.trigger: true` in health response after setting `TRIGGER_SECRET_KEY` |
| AI features | `services.openai: true` (or `anthropic: true`) in health response |
| GitHub OAuth | Sign in with GitHub and connect a repository |
| Search index | Use **Reindex search** on repository settings after connecting |
| Webhooks | Push a commit; repository sync updates without manual sync |

## Pages

| Route | Description |
|-------|-------------|
| `/login`, `/register` | Authentication |
| `/` | Dashboard — repos, active objectives, recent decisions |
| `/repositories/[id]` | Objectives, commits with semantic insights, RAG chat |
| `/repositories/[id]/settings` | Sync, webhook status, branches, agent prompt, disconnect |
| `/objectives/[id]` | Plans, agent runs, evaluations, decision, AI summary |
| `/knowledge-graph/[objectiveId]` | Interactive knowledge graph |

## API Overview

### Auth

- `POST /api/auth/register` — email/password registration

### Repositories

- `GET /api/repositories` — list connected repositories
- `POST /api/repositories` — connect a repository (sync + webhook registration)
- `GET /api/repositories/github` — list GitHub repos for the authenticated user
- `GET /api/repositories/[id]` — repository detail
- `PATCH /api/repositories/[id]` — update settings (e.g. agent system prompt)
- `DELETE /api/repositories/[id]` — disconnect or leave repository
- `POST /api/repositories/[id]/sync` — manual sync (queued via Trigger.dev when configured)
- `POST /api/repositories/[id]/reindex` — rebuild search indexes for the repository
- `GET/POST /api/repositories/[id]/objectives` — list/create objectives
- `GET/POST /api/repositories/[id]/chat` — list chat sessions / send message (streamed)
- `GET /api/repositories/[id]/chat/sessions/[sessionId]` — load chat session messages

### Objectives

- `GET/PATCH/DELETE /api/objectives/[id]` — objective detail, update, delete
- `POST /api/objectives/[id]/plans` — create plan
- `PATCH/DELETE /api/plans/[id]` — update/delete plan
- `POST /api/objectives/[id]/agent-runs` — manually record an agent run
- `POST /api/objectives/[id]/agent-runs/execute` — run AI agent on a plan (branch + report)
- `GET /api/agent-runs/[id]` — agent run status
- `POST /api/objectives/[id]/evaluations` — record evaluation
- `POST /api/objectives/[id]/decision` — record decision (triggers objective summary)
- `GET /api/objectives/[id]/graph` — knowledge graph data

### System

- `GET /api/health` — database connectivity check
- `POST /api/webhooks/github` — GitHub webhook handler

## Background Jobs

When `TRIGGER_SECRET_KEY` is set, these run asynchronously via Trigger.dev:

| Job | Trigger |
|-----|---------|
| `sync-repository` | Repo connect, manual sync |
| `index-entity` | Entity create/update |
| `github-webhook` | GitHub push/branch events |
| `analyze-commit` | After commit indexing |
| `generate-objective-summary` | After decision recorded |
| `execute-agent-run` | Agent execution requested |
| `reindex-repository` | Manual reindex from repository settings |

Without Trigger.dev, the same work runs inline in the API process (fine for local testing, not ideal for production).
