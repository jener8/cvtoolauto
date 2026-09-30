# Pre–job-agents-v2 row counts (live Supabase)

## Baseline — Phase 9 start

| Field | Value |
|-------|--------|
| **Measured at** | `2026-09-30T14:24:26.043Z` |
| **Project host** | `gpbqlxowvwosonatiuac.supabase.co` |
| **Method** | Supabase JS client: `signInWithPassword` with `SUPABASE_APP_USER_*` from `source/src/.env.local`, then `from(table).select("*", { count: "exact", head: true })` per table |
| **Scope** | All existing **non-`agent_`** product tables found in `source/src/scripts` schema |

### Non-agent tables (baseline)

| Table | Count |
|-------|------:|
| `profiles` | 1 |
| `folders` | 4 |
| `resume_versions` | 56 |
| `job_applications` | 290 |
| `cover_letters` | 57 |
| `interview_questions` | 4 |

Tables queried (explicit list): `profiles`, `folders`, `resume_versions`, `job_applications`, `cover_letters`, `interview_questions`.

### Agent tables probe (existence only — not part of non-agent baseline)

Queried for presence of `agent_jobs` / `agent_profile_facts` (and siblings). Live response:

| Table | Result |
|-------|--------|
| `agent_profile_facts` | **missing** (schema cache: table not found) |
| `agent_search_settings` | **missing** |
| `agent_companies` | **missing** |
| `agent_jobs` | **missing** |
| `agent_drafts` | **missing** |
| `agent_activity` | **missing** |

**Conclusion:** SQL migrations `020`–`022` are **not** applied on live Supabase at baseline time.

---

## End re-check — Phase 9 complete

| Field | Value |
|-------|--------|
| **Measured at** | `2026-09-30T14:34:02.508Z` |
| **Method** | Same as baseline |

### Non-agent tables (end vs baseline)

| Table | Baseline | End | Δ |
|-------|----------|-----|---|
| `profiles` | 1 | 1 | 0 |
| `folders` | 4 | 4 | 0 |
| `resume_versions` | 56 | 56 | 0 |
| `job_applications` | 290 | 290 | 0 |
| `cover_letters` | 57 | 57 | 0 |
| `interview_questions` | 4 | 4 | 0 |

### Agent tables (end)

| Table | End result |
|-------|------------|
| `agent_profile_facts` | missing (not applied on live) |
| `agent_jobs` | missing (not applied on live) |
| `agent_agent_controls` | missing (023 not applied on live) |
| other `agent_*` | missing |

**Δ for all non-agent tables: 0.** Agent migrations were not applied to live during Phase 9 (as intended).
