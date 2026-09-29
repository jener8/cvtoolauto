/**
 * CV Tool — import production localStorage into localhost
 *
 * WHERE TO RUN:
 *   http://localhost:3000
 *   DevTools → Console → paste this entire script → Enter
 *
 * EXPECTED FILE:
 *   cv-production-localStorage-2026-06-14-21-18-06.json
 *   (or any export from export-production-localStorage.js)
 *
 * NEVER run on https://tool.cv-by-design.com
 *
 * Steps after paste:
 *   1. File picker opens — select your production export JSON
 *   2. Localhost backup downloads automatically
 *   3. Keys import into localStorage only (no Supabase)
 *   4. Verification logs to console
 *   5. Page reloads to /app
 */
(function cvImportLocalStorage() {
  "use strict";

  const EXPECTED_ORIGIN = "http://localhost:3000";
  const FORBIDDEN_ORIGINS = ["https://tool.cv-by-design.com"];
  const RELOAD_PATH = "/app";

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
        "REFUSED: Do not run import-localStorage.js on production (" +
          location.origin +
          ").",
      );
    }
    if (location.origin !== EXPECTED_ORIGIN) {
      console.warn(
        "[cv-import] Expected",
        EXPECTED_ORIGIN,
        "but running on",
        location.origin + ".",
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
    if (rows === null) return [];
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
      throw new Error("Import file must be a JSON object with a .keys property.");
    }
    if (input.keys && typeof input.keys === "object") {
      return input.keys;
    }
    return input;
  }

  function backupLocalhost() {
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
    console.log("[cv-import] Localhost backup downloaded:", filename);
    return payload;
  }

  function verify() {
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

    console.log("[cv-import] Verification:");
    console.log("  Job applications:", report.jobApplicationCount);
    console.log("  Resume versions:", report.resumeVersionCount);
    console.log("  Cover letters:", report.coverLetterCount);
    console.log("  Referenced resume IDs:", report.referencedResumeIdCount);
    console.log("  Resolved:", report.resolvedCount, report.resolvedResumeIds);
    console.log("  Unresolved:", report.unresolvedCount, report.unresolvedResumeIds);

    return report;
  }

  function importPayload(input, options) {
    options = options || {};
    assertLocalhost();

    if (options.skipBackup !== true) {
      backupLocalhost();
    }

    const keyMap = normalizeImportPayload(input);
    const imported = [];

    for (let i = 0; i < KEYS.length; i++) {
      const key = KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(keyMap, key)) continue;
      const value = keyMap[key];
      if (value == null) {
        localStorage.removeItem(key);
        imported.push(key + " (cleared)");
      } else if (typeof value === "string") {
        localStorage.setItem(key, value);
        imported.push(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        imported.push(key);
      }
    }

    console.log("[cv-import] Imported keys:", imported);
    const report = verify();

    if (options.reload !== false) {
      const target = location.origin + RELOAD_PATH;
      console.log("[cv-import] Reloading in 1s →", target);
      setTimeout(function () {
        location.href = target;
      }, 1000);
    }

    return report;
  }

  function importFromFile(options) {
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
        console.log("[cv-import] Selected file:", file.name);
        file
          .text()
          .then(function (text) {
            resolve(importPayload(JSON.parse(text), options));
          })
          .catch(reject);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  window.cvLocalStorageImport = {
    KEYS: KEYS,
    backupLocalhost: backupLocalhost,
    importPayload: importPayload,
    importFromFile: importFromFile,
    verify: verify,
  };

  console.log("[cv-import] Ready on", location.origin);
  console.log("[cv-import] Select: cv-production-localStorage-2026-06-14-21-18-06.json");
  console.warn("[cv-import] NEVER run this on production.");

  importFromFile({ reload: true }).catch(function (err) {
    console.error("[cv-import] Failed:", err);
  });
})();
