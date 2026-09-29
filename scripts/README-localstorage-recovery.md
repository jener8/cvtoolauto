# localStorage recovery helper (read-only)

Copy production browser cache to localhost so application cards can resolve `resumeVersionId` values from local snapshots — **without modifying Supabase**.

## What these scripts do

| Script | Origin | Action |
|--------|--------|--------|
| `export-production-localStorage.js` | **https://tool.cv-by-design.com** | Read 7 keys → download JSON |
| `import-localhost-localStorage.js` | **http://localhost:3000** | Backup localhost → import JSON → verify |

They only use `localStorage` and file download. No fetch, no Supabase, no repair/relink/dedupe/merge/delete.

## Keys exported / imported

- `cv_local_job_applications`
- `cv_local_resume_versions`
- `cv_local_cover_letters`
- `cv_current_resume_draft`
- `cv_local_folders`
- `cv_folders_list_v1`
- `cv_deleted_application_tombstones`

---

## Step 1 — Export on production

1. Open **https://tool.cv-by-design.com** and sign in.
2. Open the workspace once (so cache is populated).
3. Open **DevTools → Console**.
4. Paste the full contents of **`export-production-localStorage.js`** and press Enter.
5. A file downloads: `cv-production-localStorage-YYYY-MM-DD-HH-mm-ss.json`
6. Keep that file safe (it contains your CV data).

---

## Step 2 — Import on localhost

**Never run the import script on production.**

1. Open **http://localhost:3000** (any route on that origin is fine).
2. **Close other tabs** running the CV app on localhost if possible (reduces accidental sync after reload).
3. Open **DevTools → Console**.
4. Paste the full contents of **`import-localhost-localStorage.js`** and press Enter.
5. Run:

```javascript
cvLocalStorageRecovery.importFromFile()
```

6. Select the production export JSON from Step 1.
7. The script will:
   - Download a **localhost backup** first (`cv-localhost-localStorage-backup-before-import-….json`)
   - Write the 7 keys into localhost `localStorage`
   - Print verification:
     - job application count
     - resume version count
     - cover letter count
     - referenced resume IDs
     - which referenced IDs resolve from `cv_local_resume_versions`

8. Reload **http://localhost:3000/app** to see Resume / Cover letter chips.

### Manual import (if you already have the JSON object in memory)

```javascript
cvLocalStorageRecovery.importPayload(exportObject)
// exportObject = parsed production JSON (must have .keys or be the key map)
```

### Re-run verification without importing

```javascript
cvLocalStorageRecovery.verify()
```

### Backup localhost only (no import)

```javascript
cvLocalStorageRecovery.backupLocalhost()
```

---

## Supabase writes

These scripts **do not** call Supabase.

After you **reload the app**, the normal workspace sync may persist local changes on **save/edit** (app behaviour, not this script). To inspect verification only, use `cvLocalStorageRecovery.verify()` and avoid editing applications until the UI looks correct.

---

## Restore localhost from backup

If you need to undo the import:

1. Open **http://localhost:3000** → DevTools → Console.
2. Open the backup JSON file from the import step.
3. Run:

```javascript
const backup = /* paste parsed backup JSON */;
cvLocalStorageRecovery.importPayload(backup, { skipBackup: true });
```

(`skipBackup: true` avoids nesting another backup; the payload uses the same `.keys` shape.)

---

## File locations

```
cvresume-production-recovered/scripts/
  export-production-localStorage.js
  import-localhost-localStorage.js
  README-localstorage-recovery.md
```
