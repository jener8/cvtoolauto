# Job agents — data storage & retention (GDPR)

EquitAI Job Agents store candidate and listing data in **Supabase** (Postgres), not in application logs or the git repository.

Feature gate: `JOB_AGENT_ENABLED` (server/API — alone) / `NEXT_PUBLIC_JOB_AGENT_ENABLED` (client UI). Default **false**. With the server flag off, `/api/agents/*` returns 404 even if the public flag is true.

---

## What is stored

| Table | Purpose | Personal data |
|-------|---------|----------------|
| `agent_profile_facts` | Master-profile facts (confirmed / unconfirmed) | Fact text, category, source |
| `agent_search_settings` | Keywords, location, languages, seniority, company watchlist | Search preferences |
| `agent_agent_controls` | Per-agent pause flags (job_scout, company_scout, assessor, writer) | Boolean pause state only |
| `agent_companies` | Deduped company names / websites from listings | Company metadata (public) |
| `agent_jobs` | Queue of listings / initiative targets | Title, location, description, URL, email_to, relevance JSON, status |
| `agent_drafts` | Tailored CV/cover text + cited-facts snapshot | Draft text, fabrication flags, cited fact snapshot |
| `agent_activity` | Run logs | **Counts and error strings only** — no titles, companies, emails, or fact text |

Related product tables (`resumes`, `job_applications`, `cover_letters`, folders) are **not** agent tables. Optional “Add to my applications” creates a **new** `job_applications` row; deleting agent data does **not** remove that tracker row.

---

## What is sent to Claude

Relevance (Phase 4) and Writer / Fact Checker (Phase 5) call Anthropic with:

1. **Confirmed** master-profile facts only (`id`, `category`, `fact_text`)
2. The **job listing** text (title, company name, truncated listing body)

Unconfirmed facts are never sent. No full résumé documents, no unrelated workspace data.

Every drafted claim is expected to be traceable via `agent_drafts.cited_facts_snapshot` (fact ids + text at draft time).

---

## Logs & repository

- Server logs use **counts and generic error messages** (e.g. drafted: 2, errors: 1). Do not log listing titles, emails, or fact text.
- Secrets and personal data must not be committed. Use `.env.local` / Vercel env vars.
- Activity `errors` jsonb may contain technical failure messages; avoid putting PII into thrown errors.

---

## Retention & deletion

- Agent rows live until the user deletes them or the auth user is removed (`ON DELETE CASCADE` from `auth.users`).
- There is no automatic purge schedule beyond normal workspace lifecycle.
- **Delete all agent data** (UI on Search settings + `DELETE /api/agents/data` with `{ "confirm": "DELETE_AGENT_DATA" }`) removes all `agent_*` rows for the workspace user. It does **not** delete resumes or `job_applications`.

---

## Scheduling

Phase 9 crons (`source/src/vercel.json`), authenticated with `JOB_AGENT_CRON_SECRET`, only when `JOB_AGENT_ENABLED=true`:

| Agent | Schedule (UTC) | Pipeline |
|-------|----------------|----------|
| Job Scout | 06:00, 12:00, 18:00 daily | search → assess → draft |
| Company Scout | Monday 07:00 | watchlist/known companies → assess → draft |

Drafts respect `JOB_DRAFTS_DAILY_CAP` (alias `JOB_AGENT_DAILY_CAP`, default 5). Company Scout respects `COMPANY_SCOUT_WEEKLY_CAP` (default 5). Pause state lives in `agent_agent_controls`. Each run writes `agent_activity` with agent kind and counts only (no PII).

---

## No employer submission from agents

Agents never auto-submit to employer portals. Portal applications stay **Mark as sent** only.

Email applications: per-item confirmation dialog → 30s undo → Gmail API send when
`JOB_AGENT_GMAIL_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` / `FROM` are set (stores
`gmail_message_id`). Without credentials, finalize reverts to approved (no employer email).
`JOB_AGENT_GMAIL_CONNECTED=true` is a local stub that marks sent with a `stub-gmail-*` id only.
