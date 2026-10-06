# Job agents — local development

Feature stays **off** unless both flags are set. Do **not** restart Phase 2; apply migrations and enable flags locally.

## Unblock: `Could not find the table 'public.agent_jobs'`

That error means `.env.local` points at a Supabase project that does **not** have scripts `020`–`023` applied (today that includes live `gpbqlxowvwosonatiuac`).

**Do not** run those migrations on live unless you explicitly approve “apply to live” in chat.

### Why not local Docker Supabase?

Preferred local path needs Docker + `supabase` CLI. If those are missing on the machine, use a **free remote DEV project** instead (below). Helper script:

```bash
cd source/src
node scripts/setup-agents-dev-supabase.mjs          # print steps
node scripts/setup-agents-dev-supabase.mjs bundle-sql
node scripts/setup-agents-dev-supabase.mjs scaffold-env
# …create project, paste SQL, fill .env.agents-dev.local…
node scripts/setup-agents-dev-supabase.mjs use-agents-dev
npm run dev
node scripts/setup-agents-dev-supabase.mjs check
# later: node scripts/setup-agents-dev-supabase.mjs restore-live
```

### Copy-paste path (you must create the Supabase project)

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (free tier). Name e.g. `equitai-agents-dev`.
2. From `source/src`: `node scripts/setup-agents-dev-supabase.mjs bundle-sql` → open `scripts/agents-dev-schema-bundle.sql` → paste into that project’s **SQL Editor** → Run.  
   Empty projects need the **full** bundle (base app + `020`–`023`). See §2 for the numbered file list.  
   The generated bundle is **idempotent** — safe to re-run if a previous paste failed partway (e.g. `policy already exists`).
3. **Authentication → Users → Add user** (email/password you will put in `SUPABASE_APP_USER_*`). Auth user already created on your side → skip if done.
4. `scaffold-env` (if needed), then edit `.env.agents-dev.local` with the new project’s **URL + anon key + app user email/password**. Set `JOB_AGENT_ENABLED=true` and `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`. Do not paste the service role key in chat; app runtime does not need it.
5. `use-agents-dev` (backs up current `.env.local` → `.env.live.local`) → restart `npm run dev` → `check`.

Live stays untouched until you say otherwise. To point back at live credentials: `restore-live`.

## 0. Use a separate Supabase project for local / agent testing

**Do not point local agent testing at the live production Supabase project.** Test searches, drafts, and Company Scout would write `agent_*` (and could confuse live counts). Create your own **dev** project (or Supabase Branch) and keep production credentials only on Vercel Production.

### Steps (you create the project)

1. In [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (or Branch of production). Name it e.g. `equitai-agents-dev`.
2. Run the SQL scripts in order in that project’s SQL Editor (see §2), or use the bundle from `setup-agents-dev-supabase.mjs bundle-sql`.
3. Create the app Auth user (same email/password pattern as production, or a dedicated test user).
4. Prefer `.env.agents-dev.local` + `use-agents-dev`, or set **only** these vars in local `.env.local` at the **dev** project:

```bash
# Dev Supabase (local agent testing) — NOT production
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_APP_USER_EMAIL=cv-app-dev@your-domain.com
SUPABASE_APP_USER_PASSWORD=use-a-long-random-password
```

5. Keep production URL/keys in Vercel Production env only. Never commit `.env.local`.
6. Optional: use `.env.agents-dev.local` / `.env.live.local` (via the helper) so you do not accidentally leave the production URL in local agent runs.

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

### Empty / brand-new DEV project (required)

Prefer one paste: from `source/src` run `node scripts/setup-agents-dev-supabase.mjs bundle-sql`, then paste `scripts/agents-dev-schema-bundle.sql` into the **DEV** SQL Editor and Run.

The bundle generator keeps numbered migration files unchanged for one-shot deploy, and transforms the paste file to be **re-run safe** (`DROP POLICY`/`DROP TRIGGER IF EXISTS` before creates; `IF NOT EXISTS` on tables/indexes). If a previous run failed mid-script, regenerate and paste again on the **same DEV** project — do not run this on live.

#### Diagnostic: what is already on the DEV project?

Run in the DEV SQL Editor (read-only):

```sql
-- Public tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Public RLS policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected after a full bundle: base tables (`profiles`, `folders`, `resume_versions`, `job_applications`, `cover_letters`) plus `agent_*` tables, with policies on each.

Same order as individual files (all under `source/src/scripts/`):

| # | File | Purpose |
|---|------|---------|
| 1 | `001_create_tables.sql` | profiles, resume_versions, job_applications |
| 2 | `002_profile_trigger.sql` | auth → profiles trigger |
| 3 | `004_create_folders.sql` | folders + folder_id FKs |
| 4 | `005_create_cover_letters.sql` | cover_letters |
| 5 | `006_add_user_id_and_rls.sql` | folders/cover_letters `user_id` (+ interim RLS) |
| 6 | `008_add_cover_letter_id_to_jobs.sql` | job ↔ cover letter link |
| 7 | `009_add_fit_scores_and_red_flags.sql` | application scoring columns |
| 8 | `010_add_resume_style_columns.sql` | resume styling columns |
| 9 | `010_add_upload_details.sql` | upload_details on applications |
| 10 | `011_add_resume_embedded_cover_letter.sql` | embedded cover letter on resumes |
| 11 | `012_add_resume_version_history.sql` | version_history |
| 12 | `add-folder-contact-info.sql` | folders `profile_image` + `contact_info` |
| 13 | `013_enable_rls_security.sql` | final RLS policies for authenticated app user |
| 14 | `016_add_your_story.sql` | your_story on applications |
| 15 | `apply-missing-supabase-schema.sql` | idempotent column catch-up + schema reload |
| 16 | `020_agent_tables.sql` | agent_* tables |
| 17 | `021_agent_jobs_source_key.sql` | source_key |
| 18 | `022_agent_jobs_not_relevant_status.sql` | not_relevant status |
| 19 | `023_agent_controls_scheduling.sql` | pause controls + `target_companies` |

**Do not** run this bundle (or 020–023) on live `gpbqlxowvwosonatiuac` unless you explicitly approve “apply to live”.

Skipped on purpose for empty DEV (live/data-only): `007`, `014*`, `015`, `017`–`019`, interview-questions scripts.

### Agents-only (existing base schema already present)

If the project already has the full product schema and only needs agents:

1. `020_agent_tables.sql`
2. `021_agent_jobs_source_key.sql`
3. `022_agent_jobs_not_relevant_status.sql`
4. `023_agent_controls_scheduling.sql`

(`gmail_message_id` is already on `agent_jobs` in 020 — no extra migration for Phase 8.)

### Env vars the app reads for Supabase

| Variable | Required for app runtime? |
|----------|---------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_APP_USER_EMAIL` | Yes (server Auth sign-in) |
| `SUPABASE_APP_USER_PASSWORD` | Yes (Auth user password — not an API key) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** for app runtime (optional admin scripts only; set locally yourself — do not paste in chat) |

Agent flags for local DEV: `JOB_AGENT_ENABLED=true`, `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`.

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
