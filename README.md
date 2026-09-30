# EquitAI

Single project for the **EquitAI marketing site** and **career tool**.

## Project layout

| Path | What it is | Live URL |
|------|------------|----------|
| `source/src/` | Marketing landing + career tool (Next.js) | [equitai.eu.com](https://equitai.eu.com) |
| `website/` | Legacy static pages (coaches, imprint, etc.) | [cv-by-design.com](https://cv-by-design.com) |

The **marketing site** is **equitai.eu.com** — homepage, nav, pricing, and sign-up all live in the Next.js app at `source/src/`.

Design tokens live in `source/src/design-system/`. Sync to the legacy static folder with:

```bash
npm run sync:design-system
```

## Local development

From the project root:

```bash
# Marketing + app → http://localhost:3000
npm run dev:tool

# Legacy static pages only → http://localhost:8080
npm run dev:website
```

Open the marketing homepage at [http://localhost:3000](http://localhost:3000).

## Deploy

- **Marketing + app:** deploy `source/src/` to Vercel → **equitai.eu.com**
- **Legacy static pages:** deploy `website/` to Vercel → cv-by-design.com (until migrated)

See `TODO.md` for domain migration tasks.

## Job agents (feature-flagged)

Branch: `feature/job-agents-v2`. Default **off** — matches tags `pre-job-agents-v2` / `pre-job-agent` when flags are false.

### Setup

1. Apply SQL in Supabase: `source/src/scripts/020_agent_tables.sql` (plus `021_*`, `022_*` if not already applied).
2. In Vercel / `.env.local` set:
   - `JOB_AGENT_ENABLED=true`
   - `NEXT_PUBLIC_JOB_AGENT_ENABLED=true` (nav + client UI)
   - `ANTHROPIC_API_KEY` (relevance + drafts)
   - Optional sources: `BA_JOBSUCHE_API_KEY`, `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
   - Optional: `JOB_AGENT_DAILY_CAP=5`, `JOB_AGENT_AUTO_REVIEW=false`, `JOB_AGENT_GMAIL_CONNECTED=false`
   - Cron: `JOB_AGENT_CRON_SECRET` and Vercel `CRON_SECRET` (same value)
3. Redeploy. Open **Job agents** from the profile menu → confirm master-profile facts → Search settings → **Run now** on the queue (or wait for daily cron).

`source/src/vercel.json` schedules `GET /api/agents/cron` daily at **06:00 UTC** (search → relevance → draft; respects daily cap). Manual **Run now** hits `POST /api/agents/pipeline/run`.

### Env vars (agents)

| Variable | Default | Role |
|----------|---------|------|
| `JOB_AGENT_ENABLED` | `false` | Server/API gate |
| `NEXT_PUBLIC_JOB_AGENT_ENABLED` | `false` | Client nav/UI |
| `JOB_AGENT_DAILY_CAP` | `5` | Max drafts per UTC day |
| `JOB_AGENT_AUTO_REVIEW` | `false` | Auto-review after search |
| `JOB_AGENT_CRON_SECRET` | — | Auth for `/api/agents/cron` |
| `CRON_SECRET` | — | Vercel cron Bearer (set equal to `JOB_AGENT_CRON_SECRET`) |
| `JOB_AGENT_GMAIL_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` / `FROM` | — | Real Gmail API send (Phase 8) |
| `JOB_AGENT_GMAIL_CONNECTED` | `false` | Legacy stub send unlock (no employer email) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — | Relevance + Writer/Fact Checker |
| `BA_JOBSUCHE_API_KEY` | public BA key | Arbeitsagentur |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | — | Adzuna (skipped if unset) |

See `source/src/.env.example`, `docs/agents-local-dev.md`, `docs/agents-data.md` (storage/GDPR), and `docs/agents-job-applications-mapping.md` (optional “Add to my applications”).

### Behaviour notes

- No LinkedIn scraping. No portal auto-apply. Gmail send requires OAuth env (or legacy stub flag for local testing only).
- Claude receives **confirmed** master-profile facts + listing text only; drafts keep `cited_facts_snapshot`.
- **Delete all agent data** (Search settings) clears `agent_*` only — not resumes / `job_applications`.

### Rollback

```bash
git checkout pre-job-agents-v2   # or pre-job-agent
# Ensure JOB_AGENT_ENABLED and NEXT_PUBLIC_JOB_AGENT_ENABLED are unset/false
```

Do not merge to `main` until review is complete.
