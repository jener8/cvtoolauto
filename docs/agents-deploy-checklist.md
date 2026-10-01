# Job agents — production deploy checklist

**Do not start this until local testing on a separate Supabase project is done.**  
Flags stay **off** on the host until you intentionally enable them. No merge/deploy is implied by this checklist alone.

Related: [agents-local-dev.md](./agents-local-dev.md) (separate Supabase for local), tag `pre-job-agents-v2`, draft PR for `feature/job-agents-v2`.

---

## 1. Host env vars — feature **OFF** first

Set these on the **production** host (Vercel → Project → Settings → Environment Variables → Production) **before** or with the deploy that includes agent code. Keep agents disabled until migrations + Gmail + cron are ready.

### Required safely-off defaults

```bash
JOB_AGENT_ENABLED=false
NEXT_PUBLIC_JOB_AGENT_ENABLED=false
```

| Variable | Role |
|----------|------|
| `JOB_AGENT_ENABLED` | **Server gate** for all `/api/agents/*`, cron, and SSR `/app/agents*`. Must be `true` to unlock APIs. `NEXT_PUBLIC_*` cannot unlock APIs. |
| `NEXT_PUBLIC_JOB_AGENT_ENABLED` | Client nav / UI chrome only |

### Other agent-related vars (set as needed; leave unset until ready)

```bash
# AI (relevance + drafts)
ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-sonnet-5

# Caps
JOB_DRAFTS_DAILY_CAP=5          # primary; JOB_AGENT_DAILY_CAP still accepted
COMPANY_SCOUT_WEEKLY_CAP=5
# JOB_AGENT_AUTO_REVIEW=false

# Job sources
BA_JOBSUCHE_API_KEY=jobboerse-jobsuche   # public default; override if BA rotates
ADZUNA_APP_ID=                           # optional; Adzuna skipped when unset
ADZUNA_APP_KEY=

# Gmail OAuth (real send after confirm + 30s undo)
JOB_AGENT_GMAIL_CLIENT_ID=
JOB_AGENT_GMAIL_CLIENT_SECRET=
JOB_AGENT_GMAIL_REFRESH_TOKEN=
JOB_AGENT_GMAIL_FROM=
# Aliases also accepted: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN / GMAIL_FROM
# Do NOT set JOB_AGENT_GMAIL_CONNECTED=true in production (local stub only)

# Cron auth (same secret for both)
JOB_AGENT_CRON_SECRET=                   # long random string
CRON_SECRET=                             # must match JOB_AGENT_CRON_SECRET (Vercel Cron)
```

Redeploy after changing env (or use Vercel “Redeploy” so server/client bundles pick up values).

---

## 2. Apply SQL migrations `020`–`023` on **production** Supabase

Run in the **live** project SQL Editor **in order** (additive; pair `_down.sql` only for rollback):

1. `source/src/scripts/020_agent_tables.sql`
2. `source/src/scripts/021_agent_jobs_source_key.sql`
3. `source/src/scripts/022_agent_jobs_not_relevant_status.sql`
4. `source/src/scripts/023_agent_controls_scheduling.sql`

Verify: PostgREST can see `agent_jobs`, `agent_profile_facts`, `agent_agent_controls`, etc. (Dashboard table list or a read-only count probe).

**Do not** apply agent migrations first on a host that already has `JOB_AGENT_ENABLED=true` without testing — prefer migrations while flags are still `false`.

Optional: re-measure non-`agent_` tables vs `backups/pre-job-agents-v2-counts.md` after migrate (expect Δ ≈ 0 if no concurrent product writes).

---

## 3. Gmail OAuth setup (Google Cloud)

Needed only for **real** employer email sends (portal apply stays manual “Mark as sent”).

1. Create/use a Google Cloud project.
2. Enable **Gmail API**.
3. Configure **OAuth consent screen** (External or Internal as appropriate).
4. While in Testing: add **your Gmail** as a **test user**.
5. Create OAuth client (Web application or Desktop — whichever you use to obtain a refresh token).
6. Scopes (minimum for this feature):
   - `https://www.googleapis.com/auth/gmail.send` (send)
   - Prefer also `https://www.googleapis.com/auth/gmail.readonly` if your token flow/docs request read-only alongside send (message id / thread confirmation).
7. Complete OAuth once as the sending user; store the **refresh token** in `JOB_AGENT_GMAIL_REFRESH_TOKEN` (plus client id/secret and `JOB_AGENT_GMAIL_FROM`).
8. Confirm on a **dev** Supabase project first; never rely on the local stub (`JOB_AGENT_GMAIL_CONNECTED`) in production.

Without Gmail env, finalize stays safe (approved / no employer email).

---

## 4. Cron / scheduler on the host

`source/src/vercel.json` defines:

| Path | Schedule (UTC) | Pipeline |
|------|----------------|----------|
| `/api/agents/cron?agent=job_scout` | `0 6,12,18 * * *` (three entries) | Job Scout → Assessor → Writer |
| `/api/agents/cron?agent=company_scout` | `0 7 * * 1` (Mondays) | Company Scout → Assessor → Writer |

Checklist:

1. Deploy includes `vercel.json` crons (Vercel Pro/Hobby cron limits apply).
2. Set `JOB_AGENT_CRON_SECRET` and **`CRON_SECRET` to the same value** so Vercel’s `Authorization: Bearer …` matches the route.
3. Cron still returns **404** while `JOB_AGENT_ENABLED` is not `true` — safe to ship crons before flip.
4. After enabling the flag, smoke-test one manual cron call with the secret, then wait for a scheduled run.

Pause / Run now: Search settings UI + `/api/agents/controls`, `/api/agents/run`.

---

## 5. Turning the flag **on** (single shared deployment — be honest)

This app is a **single shared production deployment** (one Vercel project / one env). There is **no per-user feature flag** in the database today.

Practical meaning:

- Setting `JOB_AGENT_ENABLED=true` (and optionally `NEXT_PUBLIC_JOB_AGENT_ENABLED=true`) on **Production** turns agents on for **everyone** who can log into that deployment.
- For a personal/single-user EquitAI instance, that is effectively “on for you only” because you are the only user — but it is **not** a multi-tenant “enable for user X” switch.
- Safer sequence: keep Production flags `false` → finish local testing on a **separate** Supabase project → apply `020`–`023` on live → set secrets → then set both flags to `true` and redeploy.
- To hide UI but keep APIs off: leave `JOB_AGENT_ENABLED=false` (APIs stay 404 even if public flag is true).

---

## 6. Rollback

1. **Immediate:** set `JOB_AGENT_ENABLED=false` and `NEXT_PUBLIC_JOB_AGENT_ENABLED=false` on the host → redeploy (or restart). APIs/cron/SSR agents → 404; product paths unchanged.
2. **Code:** revert/merge-revert the job-agents PR (or redeploy the commit before the feature landed).
3. **Known-good tag:** `pre-job-agents-v2` marks the snapshot before this work — check out/redeploy from that tag if you need a hard rollback of the tree.
4. **Schema (last resort):** only if you must remove tables — run `023`→`020` `_down.sql` scripts in reverse on Supabase. Prefer leaving empty `agent_*` tables in place if the product is healthy with flags off.

---

## Quick go-live order

1. Env on host with flags **false** + secrets prepared  
2. Migrations `020`–`023` on production Supabase  
3. Gmail OAuth env (if sending email)  
4. Confirm crons + `CRON_SECRET` / `JOB_AGENT_CRON_SECRET`  
5. Flip `JOB_AGENT_ENABLED` (then `NEXT_PUBLIC_JOB_AGENT_ENABLED` for nav)  
6. Smoke: review queue, one search, one draft; cron auth  
7. Keep rollback path (flag off → revert → tag) ready  
