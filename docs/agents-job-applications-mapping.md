# Agent jobs → `job_applications` field mapping (Phase 7 readiness)

**Status:** Proposal only. Phase 6 does **not** auto-write into `job_applications`. Any sync should be **opt-in / manual** (e.g. “Add to applications”) after `approved` or `sent`.

**Goal:** When a human-approved agent job reaches `sent` (or optionally `approved`), create or link a workspace `job_applications` row so the existing EquitAI tracker stays the source of truth for pipeline stages, interviews, etc.

---

## Suggested trigger

| Trigger | Write? | Notes |
|--------|--------|--------|
| `agent_jobs.status = approved` | Optional / manual only | Ready to apply; user may still change drafts |
| `agent_jobs.status = sent` | Preferred sync point | Email undo finished or portal “Mark as sent” |
| `rejected` / `not_relevant` | No | Keep on `agent_jobs` for dedupe only |

Never auto-submit to employer portals. Sync is a **tracker** write, not an apply action.

---

## Column mapping

### Core identity

| `job_applications` | Source (`agent_jobs` / `agent_drafts` / `agent_companies`) | Notes |
|--------------------|-----------------------------------------------------------|--------|
| `id` | New UUID (do **not** reuse `agent_jobs.id` unless an explicit FK is added later) | Keep queues independent; optional later column `agent_job_id` |
| `user_id` | `agent_jobs.user_id` | Same auth user |
| `role` | `agent_jobs.title` | Required; fallback “Job title not added” if null |
| `company` | `agent_companies.name` via `agent_jobs.company_id` | Required; fallback “Company not added” |
| `status` | Map from agent status | See status mapping below |
| `applied_date` | `now()` when marking `sent`; else null / omit until sent | Aligns with tracker “applied” |
| `folder_id` | null (or user-chosen folder on manual export) | Do not invent a folder |
| `created_at` / `updated_at` | DB defaults | — |

### Suggested status mapping

| `agent_jobs.status` | `job_applications.status` (current app usage) |
|---------------------|-----------------------------------------------|
| `approved` | Do not create yet, **or** create as a draft-like / “to apply” if product adds that stage — today tracker often expects `applied` |
| `sent` | `applied` (or whatever the app’s primary “applied” status string is) |
| Other agent statuses | No row |

If creating only on `sent`, set `status = 'applied'` and `applied_date = now()`.

### Nested / JSONB fields

| `job_applications` | Source | Mapping proposal |
|--------------------|--------|------------------|
| `job_description` | `agent_jobs` | `{ content: description \|\| raw_listing_text, url, location, summary: relevance.summary, source, postedAt, agentJobId }` |
| `cover_letter` | `agent_drafts.cover_text` | `{ content: cover_text, lastModified: Date.now() }` — optional later: also create standalone `cover_letters` + `cover_letter_id` |
| `why_content` | `agent_jobs.relevance.summary` | `{ text: summary }` (fit explanation, not a fabricated “why”) |
| `company_info` | `agent_companies` | `{ website: company.website \|\| '', researchNotes: '', linkedInContacts: [], lastModified }` |
| `contacts` | `agent_jobs.email_to` | If `email_to` present: one contact `{ email: email_to, …empty fields }` else `[]` |
| `job_strategy` | — | Leave null / omit on first sync |
| `interview_prep` | — | Default empty structure if the upsert path requires it |
| `your_story` / `upload_details` / `fit_scores` / `red_flags` | — | Omit |
| `resume_version_id` | — | **Do not** auto-link. Agent drafts are text in `agent_drafts.cv_text`, not `resume_versions`. Optional Phase 7+: “Save draft as resume version” then link |
| `cover_letter_id` | — | Optional later if exporting into `cover_letters` |

### Agent-only fields (stay on `agent_*`)

Keep on `agent_jobs` / `agent_drafts` (do not flatten into `job_applications` unless product asks):

- `kind` (`listing` \| `initiative`)
- `apply_method` (`email` \| `portal`)
- `relevance` (full met / not-met evidence; no scores)
- `fabrication_flags`, `cited_facts_snapshot`, draft `version`
- `gmail_message_id`, `sending_started_at`, `reject_reason`
- `source` / `source_key` (dedupe)

Optional additive column (Phase 7 migration, if sync ships):

```sql
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS agent_job_id uuid REFERENCES public.agent_jobs(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_agent_job_id
  ON public.job_applications (agent_job_id) WHERE agent_job_id IS NOT NULL;
```

---

## Draft CV handling

`agent_drafts.cv_text` is tailored resume **markup text**, not a full CV-builder `resume_versions` document.

**Recommendation:** On sync, store a pointer in `job_description` (e.g. `agentDraftId`, `cvTextPreview`) and leave `resume_version_id` null until the user explicitly saves the draft into the CV builder. Do not silently create incomplete resume versions.

---

## Idempotency

1. Prefer unique `agent_job_id` on `job_applications` once the column exists.
2. Until then, match on `(user_id, role, company, job_description->>'url')` or `(user_id, job_description->>'agentJobId')` stored in JSON.
3. Re-sync on re-`sent` should **update** cover letter / description, not create duplicates.

---

## Out of scope for this note

- Vercel / Supabase cron (Phase 7)
- Automatic Gmail send
- Portal auto-submit
- Writing `job_applications` from the Phase 6 review UI

---

## Phase 6 delivery note

Review queue implements human decisions on `agent_jobs` only. Use this doc when designing the optional “Add to my applications” action in Phase 7+.
