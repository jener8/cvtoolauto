/**
 * CV Tool — localhost localStorage import (read-only recovery helper)
 *
 * WHERE TO RUN:
 *   http://localhost:3000
 *   DevTools → Console
 *
 * NEVER run this on https://tool.cv-by-design.com
 *
 * WHAT IT DOES:
 *   1. Backs up current localhost localStorage for the same keys
 *   2. Imports a production export file into localStorage only
 *   3. Verifies counts and resume ID resolution
 *
 * Does not call Supabase. Does not repair, relink, dedupe, merge, or delete remote data.
 */
(function cvImportLocalhostLocalStorage() {
  "use strict";

  const EXPECTED_ORIGIN = "http://localhost:3000";
  const FORBIDDEN_ORIGINS = ["https://tool.cv-by-design.com"];

  const KEYS = [
    "cv_local_job_applications",
    "cv_local_resume_versions",
    "cv_local_cover_letters",
    "cv_current_resume_draft",
    "cv_local_folders",
    "cv_folders_list_v1",
    "cv_deleted_application_tombstones",
  ];

  function assertLocalhost() {
    if (FORBIDDEN_ORIGINS.indexOf(location.origin) !== -1) {
      throw new Error(
        "REFUSED: Do not run the import script on production (" +
          location.origin +
          "). Use export-production-localStorage.js on production only.",
      );
    }
    if (location.origin !== EXPECTED_ORIGIN) {
      console.warn(
        "[cv-recovery] Expected",
        EXPECTED_ORIGIN,
        "but running on",
        location.origin +
          ". localStorage is per-origin — confirm this is the localhost port you use.",
      );
    }
  }

  function parseJsonArray(raw) {
    if (raw == null || raw === "") return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
  }

  function extractResumeIdsFromStoredRaw(raw) {
    if (raw == null) return [];
    const rows = parseJsonArray(raw);
    if (rows === null) {
      if (typeof raw === "string") {
        try {
          const draft = JSON.parse(raw);
          if (draft && draft.compact && typeof draft.compact.id === "string") {
            return [draft.compact.id];
          }
        } catch {
          /* ignore */
        }
      }
      return [];
    }
    return rows
      .map(function (row) {
        if (!row || typeof row !== "object") return null;
        if (typeof row.id === "string" && row.id) return row.id;
        if (typeof row.i === "string" && row.i) return row.i;
        if (row.compact && typeof row.compact.id === "string") return row.compact.id;
        return null;
      })
      .filter(Boolean);
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readCurrentKeys() {
    const keys = {};
    for (let i = 0; i < KEYS.length; i++) {
      keys[KEYS[i]] = localStorage.getItem(KEYS[i]);
    }
    return keys;
  }

  function normalizeImportPayload(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Import payload must be an object (production export JSON).");
    }
    if (input.keys && typeof input.keys === "object") {
      return input.keys;
    }
    return input;
  }

  function backupLocalhost() {
    assertLocalhost();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const payload = {
      schemaVersion: 1,
      kind: "cv-localstorage-localhost-backup",
      backedUpAt: new Date().toISOString(),
      sourceOrigin: location.origin,
      readOnly: true,
      keys: readCurrentKeys(),
    };
    const filename = "cv-localhost-localStorage-backup-before-import-" + stamp + ".json";
    downloadJson(filename, payload);
    console.log("[cv-recovery] Localhost backup downloaded:", filename);
    return payload;
  }

  function verify() {
    assertLocalhost();

    const jobsRaw = localStorage.getItem("cv_local_job_applications");
    const resumesRaw = localStorage.getItem("cv_local_resume_versions");
    const lettersRaw = localStorage.getItem("cv_local_cover_letters");

    const jobs = parseJsonArray(jobsRaw) || [];
    const letters = parseJsonArray(lettersRaw) || [];
    const resumeIds = extractResumeIdsFromStoredRaw(resumesRaw);
    const resumeIdSet = new Set(resumeIds);

    const referenced = jobs
      .map(function (job) {
        return job && typeof job.resumeVersionId === "string" ? job.resumeVersionId.trim() : "";
      })
      .filter(Boolean);
    const uniqueReferenced = Array.from(new Set(referenced));

    const resolved = [];
    const unresolved = [];
    for (let i = 0; i < uniqueReferenced.length; i++) {
      const id = uniqueReferenced[i];
      if (resumeIdSet.has(id)) resolved.push(id);
      else unresolved.push(id);
    }

    const report = {
      verifiedAt: new Date().toISOString(),
      origin: location.origin,
      jobApplicationCount: jobs.length,
      resumeVersionCount: resumeIds.length,
      coverLetterCount: letters.length,
      referencedResumeIdCount: uniqueReferenced.length,
      resolvedResumeIds: resolved,
      unresolvedResumeIds: unresolved,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
    };

    console.log("[cv-recovery] Verification (localStorage only, no Supabase):");
    console.log("  Job applications:", report.jobApplicationCount);
    console.log("  Resume versions:", report.resumeVersionCount);
    console.log("  Cover letters:", report.coverLetterCount);
    console.log("  Resume IDs referenced by jobs:", report.referencedResumeIdCount);
    console.log("  Resolved from localStorage:", report.resolvedCount, report.resolvedResumeIds);
    console.log("  Unresolved:", report.unresolvedCount, report.unresolvedResumeIds);

    if (report.unresolvedCount > 0) {
      console.warn(
        "[cv-recovery] Some job resumeVersionId values still have no local snapshot — cards may show Add CV for those jobs.",
      );
    } else if (report.referencedResumeIdCount > 0) {
      console.log(
        "[cv-recovery] All referenced resume IDs resolve locally — Resume chips should match production after app reload.",
      );
    }

    return report;
  }

  function importPayload(input, options) {
    assertLocalhost();
    options = options || {};

    if (options.skipBackup !== true) {
      backupLocalhost();
    }

    const keyMap = normalizeImportPayload(input);
    const imported = [];
    const skipped = [];

    for (let i = 0; i < KEYS.length; i++) {
      const key = KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(keyMap, key)) {
        skipped.push(key);
        continue;
      }
      const value = keyMap[key];
      if (value == null) {
        localStorage.removeItem(key);
        imported.push(key + " (removed — null in export)");
      } else if (typeof value === "string") {
        localStorage.setItem(key, value);
        imported.push(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        imported.push(key);
      }
    }

    console.log("[cv-recovery] Imported keys:", imported);
    if (skipped.length) {
      console.warn("[cv-recovery] Keys not in export (unchanged):", skipped);
    }
    console.log(
      "[cv-recovery] Import finished. No Supabase calls were made by this script.",
    );
    console.log(
      "[cv-recovery] Reload http://localhost:3000/app to see Resume / Cover letter chips.",
    );
    console.warn(
      "[cv-recovery] After reload, the app may sync and write to Supabase on save/edit — avoid editing until you confirm UI looks correct.",
    );

    return verify();
  }

  function importFromFile() {
    assertLocalhost();
    return new Promise(function (resolve, reject) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      input.onchange = function () {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) {
          reject(new Error("No file selected."));
          return;
        }
        file
          .text()
          .then(function (text) {
            const payload = JSON.parse(text);
            resolve(importPayload(payload));
          })
          .catch(reject);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  window.cvLocalStorageRecovery = {
    KEYS: KEYS,
    backupLocalhost: backupLocalhost,
    importPayload: importPayload,
    importFromFile: importFromFile,
    verify: verify,
  };

  console.log("[cv-recovery] Localhost import helper loaded.");
  console.log("[cv-recovery] Steps:");
  console.log("  1. cvLocalStorageRecovery.importFromFile()");
  console.log("     → picks production export JSON, backs up localhost, imports, verifies");
  console.log("  2. Optional: cvLocalStorageRecovery.verify()");
  console.log("  3. Reload http://localhost:3000/app to view chips");
  console.warn(
    "[cv-recovery] NEVER run this script on https://tool.cv-by-design.com",
  );
})();
