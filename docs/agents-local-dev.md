# Job agents — local development

Feature stays **off** unless both flags are set. Do **not** restart Phase 2; apply migrations and enable flags locally.

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

Supabase (same as the rest of the app):

```bash
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_APP_USER_EMAIL=…
SUPABASE_APP_USER_PASSWORD=…
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

## 2. Apply SQL in Supabase

Dashboard → SQL Editor, run in order:

1. `source/src/scripts/020_agent_tables.sql`
2. `source/src/scripts/021_agent_jobs_source_key.sql`
3. `source/src/scripts/022_agent_jobs_not_relevant_status.sql`

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
| http://localhost:3000/app/agents/settings | Search settings / delete agent data |

Agents also appear in the profile menu when `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`.

## 4. What works without Adzuna / BA keys

| Capability | Without Adzuna | Without BA override |
|------------|----------------|---------------------|
| UI + profile + settings | Yes | Yes |
| Arbeitnow search | Yes (no key) | Yes |
| BA Jobsuche | Uses public default `BA_JOBSUCHE_API_KEY` | Same |
| Adzuna | Skipped | — |
| Relevance / drafts | Needs `ANTHROPIC_API_KEY` | Same |
| Email send to employers | Needs Gmail OAuth env | Same |
| Portal apply | Always manual | Always manual |

## 5. Flag off (production-safe default)

Unset or set `JOB_AGENT_ENABLED` / `NEXT_PUBLIC_JOB_AGENT_ENABLED` to anything other than `true`:

- `/app/agents*` → 404
- Profile menu Agents item hidden
- `/api/agents/*` → 404
- Cron → 404 unless flag on **and** `JOB_AGENT_CRON_SECRET` auth passes
