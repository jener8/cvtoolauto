# Step 1: Download production source snapshot (read-only)

This downloads the **currently live** production deployment source from Vercel.

- **Read-only** against Vercel/production (no redeploy, no mutations)
- **Writes only** under `cvresume-production-recovered/`
- Does **not** touch `cvresume-clean`, `CV tool`, or any other existing folders
- Does **not** change Supabase

## Target deployment

| Field | Value |
|---|---|
| Production URL | `https://tool.cv-by-design.com` |
| Deployment ID | `dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM` |
| Vercel project | `cvresume-vqtg` |
| Team ID | `team_1hXCUKm8UftAa3LEvG3LKtLn` |

---

## Commands (copy one at a time)

### 1) Go to the recovery folder

```bash
cd /Users/jenny/Documents/Cursor/cvresume-production-recovered
```

### 2) Create a Vercel token (if you do not already have one)

1. Open https://vercel.com/account/tokens
2. Create a token with read access to team **jennygenerate-2075**
3. Copy the token (shown once)

### 3) Export the token in your terminal session

```bash
export VERCEL_TOKEN="paste-your-token-here"
```

Optional overrides (defaults match production):

```bash
export VERCEL_DEPLOYMENT_ID="dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM"
export VERCEL_TEAM_ID="team_1hXCUKm8UftAa3LEvG3LKtLn"
export VERCEL_PRODUCTION_URL="https://tool.cv-by-design.com"
```

### 4) Run the download script

```bash
python3 scripts/download-production-source.py
```

Expected output directories:

```
cvresume-production-recovered/
├── source/                          # recovered production files
├── logs/
│   ├── download-dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM.log
│   ├── download-summary.json
│   └── verification.json
└── scripts/
    └── download-production-source.py
```

### 5) Read the verification result

```bash
cat logs/verification.json
```

Pass criteria:

- `"missing": []` (empty array)
- log ends with `VERIFICATION PASSED`
- `file_count` is roughly **300–400** (production build logged 370 files)

Quick manual checks:

```bash
ls -la source/app/login/page.tsx
ls -la source/app/admin/page.tsx
ls -la "source/app/app/workspace/[slug]/page.tsx"
rg "Sign in required|href=\"/login\"" source/app/page.tsx
rg "Welcome back|Sign in to access your workspace" source/app/login/page.tsx
```

### 6) Inspect download stats (optional)

```bash
cat logs/download-summary.json
tail -n 40 logs/download-dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM.log
find source -type f | wc -l
```

---

## What the script verifies automatically

Required route files:

- `app/login/page.tsx`
- `app/admin/page.tsx`
- `app/app/workspace/[slug]/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/folders/route.ts`
- `app/api/linkedin/sync/route.ts`
- `app/api/admin/accounts/route.ts`

Required UI markers:

- Landing: `Sign in required`, `href="/login"`
- Login: `Welcome back`, `Sign in to access your workspace`

---

## Troubleshooting

### `ERROR listing files: HTTP 404`

The deployment file tree may not be available via API for this deployment. Fallbacks (read-only):

1. Vercel Dashboard → project **cvresume-vqtg** → deployment **l7yxwb2pc** → **Source** tab (browse manually)
2. Search your Mac for the folder used for `vercel --prod`:

```bash
rg -l "Sign in to access your workspace|Request an account" ~/Documents/Cursor ~/Documents 2>/dev/null
find ~/Documents/Cursor -path "*/app/login/page.tsx" 2>/dev/null
```

If found, **copy** (do not move) into:

```bash
cp -a /path/to/found/project/. /Users/jenny/Documents/Cursor/cvresume-production-recovered/source/
```

Then re-run verification only (no Vercel API calls):

```bash
python3 scripts/download-production-source.py --verify-only
```

### Some files failed but most downloaded

Check the log for `FAIL` lines. Re-run the script; it overwrites files in `source/` only.

### `VERIFICATION FAILED` with missing routes

The snapshot is incomplete or from the wrong deployment. Confirm:

```bash
vercel inspect https://tool.cv-by-design.com
```

Deployment id must be `dpl_BoxHXvrqgFAxmBL4DtBHDxVCViBM`.

---

## Next step (not part of this script)

After verification passes, proceed to Step 2–6 from the recovery plan: diff vs GitHub `main`, backups, new branch `recover/production-dpl-boxhxv`, and localhost verification before any redeploy.
