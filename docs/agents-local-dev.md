# Job agents — local development

Feature stays **off** unless both flags are set. Do **not** restart Phase 2; apply migrations and enable flags locally.

## 0. Use a separate Supabase project for local / agent testing

**Do not point local agent testing at the live production Supabase project.** Test searches, drafts, and Company Scout would write `agent_*` (and could confuse live counts). Create your own **dev** project (or Supabase Branch) and keep production credentials only on Vercel Production.

### Steps (you create the project)

1. In [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (or Branch of production). Name it e.g. `equitai-agents-dev`.
2. Run the SQL scripts in order in that project’s SQL Editor (see §2).
3. Create the app Auth user (same email/password pattern as production, or a dedicated test user).
4. In **local** `source/src/.env.local`, point **only** these vars at the **dev** project:

```bash
# Dev Supabase (local agent testing) — NOT production
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_APP_USER_EMAIL=cv-app-dev@your-domain.com
SUPABASE_APP_USER_PASSWORD=use-a-long-random-password
```

5. Keep production URL/keys in Vercel Production env only. Never commit `.env.local`.
6. Optional: use two env files (`\.env.local.dev` / copy when switching) so you do not accidentally leave production URL in local agent runs.

If you need to inspect live row counts without writing agent data, use a **read-only** script against production with flags **off** (`JOB_AGENT_ENABLED=false`) — do not enable agents against live.

## 1. Enable the feature

```bash
cd source/src
```

In `.env.local` (create from `.env.example` if needed):

```bash
JOB_AGENT_ENABLED=true
NEXT_PUBLIC_JOB_AGENT_ENABLED=true
ANTHROPIC_API_KEY=your-anthropic-key   # relevance + drafts
```

**Flag rules**

| Flag | Controls |
|------|----------|
| `JOB_AGENT_ENABLED` | **All** `/api/agents/*` and cron (server). Public flag cannot unlock APIs. |
| `NEXT_PUBLIC_JOB_AGENT_ENABLED` | Client nav / UI chrome only |

Optional caps / cron:

```bash
JOB_DRAFTS_DAILY_CAP=5              # primary; alias JOB_AGENT_DAILY_CAP still works
COMPANY_SCOUT_WEEKLY_CAP=5
JOB_AGENT_CRON_SECRET=…             # + Vercel CRON_SECRET same value
```

Optional sources:

```bash
# BA has a public default key; override only if needed
BA_JOBSUCHE_API_KEY=jobboerse-jobsuche
# Adzuna skipped when unset
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

Optional Gmail (Phase 8 — real send after confirm + 30s undo):

```bash
JOB_AGENT_GMAIL_CLIENT_ID=
JOB_AGENT_GMAIL_CLIENT_SECRET=
JOB_AGENT_GMAIL_REFRESH_TOKEN=   # OAuth refresh token with gmail.send
JOB_AGENT_GMAIL_FROM=you@gmail.com
```

Without Gmail env, email finalize stays safe (reverts to approved; no employer email). Portal apps stay **Mark as sent** only.

## 2. Apply SQL in Supabase (dev project)

Dashboard → SQL Editor, run in order:

1. `source/src/scripts/020_agent_tables.sql`
2. `source/src/scripts/021_agent_jobs_source_key.sql`
3. `source/src/scripts/022_agent_jobs_not_relevant_status.sql`
4. `source/src/scripts/023_agent_controls_scheduling.sql` (Phase 9 — pause controls + `target_companies`)

(`gmail_message_id` is already on `agent_jobs` in 020 — no extra migration for Phase 8.)

## 3. Run the app

```bash
cd source/src
npm run dev
```

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:3000/app/agents | Review queue |
| http://localhost:3000/app/agents/profile | Master-profile facts |
| http://localhost:3000/app/agents/settings | Search settings, pause/run per agent, delete agent data |

Agents also appear in the left workspace nav and profile menu when `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`.

## 4. What works without Adzuna / BA keys

| Capability | Without Adzuna | Without BA override |
|------------|----------------|---------------------|
| UI + profile + settings | Yes | Yes |
| Arbeitnow search | Yes (no key) | Yes |
| BA Jobsuche | Uses public default `BA_JOBSUCHE_API_KEY` | Same |
| Adzuna | Skipped | — |
| Relevance / drafts | Needs `ANTHROPIC_API_KEY` | Same |
| Company Scout | Watchlist / known companies only | Same |
| Email send to employers | Needs Gmail OAuth env | Same |
| Portal apply | Always manual | Always manual |

## 5. Scheduling (Phase 9)

`source/src/vercel.json` crons (UTC, Europe-friendly):

| Path | Schedule | Pipeline |
|------|----------|----------|
| `/api/agents/cron?agent=job_scout` | `0 6,12,18 * * *` (three entries) | Job Scout → Assessor → Writer |
| `/api/agents/cron?agent=company_scout` | `0 7 * * 1` (Mondays) | Company Scout → Assessor → Writer |

Pause / Run now per agent: Search settings UI + `GET/PATCH /api/agents/controls`, `POST /api/agents/run`.

## 6. Flag off (production-safe default)

Unset or set `JOB_AGENT_ENABLED` to anything other than `true`:

- `/api/agents/*` → 404 (even if `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`)
- Cron → 404
- SSR `/app/agents*` → 404 when server flag off

Unset `NEXT_PUBLIC_JOB_AGENT_ENABLED` to hide the sidebar and profile-menu Agents items.
