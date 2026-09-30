# Job agents — data storage & retention (GDPR)

EquitAI Job Agents store candidate and listing data in **Supabase** (Postgres), not in application logs or the git repository.

Feature gate: `JOB_AGENT_ENABLED` / `NEXT_PUBLIC_JOB_AGENT_ENABLED` (default **false**). With the flag off, agent UI and `/api/agents/*` behave as at tag `pre-job-agents-v2` (404 / hidden).

---

## What is stored

| Table | Purpose | Personal data |
|-------|---------|----------------|
| `agent_profile_facts` | Master-profile facts (confirmed / unconfirmed) | Fact text, category, source |
| `agent_search_settings` | Keywords, location, languages, seniority | Search preferences |
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

Daily cron (`vercel.json` → `GET/POST /api/agents/cron` at 06:00 UTC) runs search → relevance → draft when `JOB_AGENT_ENABLED=true`, authenticated with `JOB_AGENT_CRON_SECRET`. Drafts respect `JOB_AGENT_DAILY_CAP` (default 5). Each pipeline run also writes an `agent_activity` row (`kind: cron` or `pipeline`).

---

## No employer submission from agents

Agents never auto-submit to employer portals. Gmail send stays stubbed unless `JOB_AGENT_GMAIL_CONNECTED=true` (still not a full OAuth integration in v2). Humans approve, edit, and apply manually.
