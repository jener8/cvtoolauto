/**
 * CV Tool — production localStorage export (read-only)
 *
 * WHERE TO RUN:
 *   https://tool.cv-by-design.com
 *   DevTools → Console (while signed in and after workspace has loaded at least once)
 *
 * WHAT IT DOES:
 *   Reads localStorage keys only. Downloads a JSON file. Does not touch Supabase.
 *
 * DO NOT run the import script on production.
 */
(function cvExportProductionLocalStorage() {
  "use strict";

  const EXPECTED_ORIGIN = "https://tool.cv-by-design.com";
  const KEYS = [
    "cv_local_job_applications",
    "cv_local_resume_versions",
    "cv_local_cover_letters",
    "cv_current_resume_draft",
    "cv_local_folders",
    "cv_folders_list_v1",
    "cv_deleted_application_tombstones",
  ];

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

  if (location.origin !== EXPECTED_ORIGIN) {
    console.error(
      "[cv-recovery] Wrong origin:",
      location.origin,
      "— run this script on",
      EXPECTED_ORIGIN,
    );
    return;
  }

  const keyValues = {};
  const summary = {
    exportedAt: new Date().toISOString(),
    sourceOrigin: location.origin,
    keysPresent: [],
    keysMissing: [],
    counts: {},
  };

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    const value = localStorage.getItem(key);
    keyValues[key] = value;
    if (value == null) {
      summary.keysMissing.push(key);
      summary.counts[key] = 0;
    } else {
      summary.keysPresent.push(key);
      if (key === "cv_local_resume_versions") {
        summary.counts[key] = extractResumeIdsFromStoredRaw(value).length;
      } else if (
        key === "cv_current_resume_draft" ||
        key === "cv_deleted_application_tombstones"
      ) {
        summary.counts[key] = value ? 1 : 0;
      } else {
        const arr = parseJsonArray(value);
        summary.counts[key] = arr === null ? "invalid-json" : arr.length;
      }
    }
  }

  const jobs = parseJsonArray(keyValues.cv_local_job_applications) || [];
  const resumeIds = new Set(extractResumeIdsFromStoredRaw(keyValues.cv_local_resume_versions));
  const referencedResumeIds = jobs
    .map(function (job) {
      return job && typeof job.resumeVersionId === "string" ? job.resumeVersionId.trim() : "";
    })
    .filter(Boolean);
  const uniqueReferenced = Array.from(new Set(referencedResumeIds));
  const resolved = uniqueReferenced.filter(function (id) {
    return resumeIds.has(id);
  });
  const unresolved = uniqueReferenced.filter(function (id) {
    return !resumeIds.has(id);
  });

  summary.jobApplications = jobs.length;
  summary.referencedResumeIds = uniqueReferenced.length;
  summary.resolvedResumeIds = resolved.length;
  summary.unresolvedResumeIds = unresolved.length;

  const payload = {
    schemaVersion: 1,
    kind: "cv-localstorage-export",
    exportedAt: summary.exportedAt,
    sourceOrigin: summary.sourceOrigin,
    readOnly: true,
    keys: keyValues,
    summary: summary,
  };

  const stamp = summary.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  const filename = "cv-production-localStorage-" + stamp + ".json";
  downloadJson(filename, payload);

  console.log("[cv-recovery] Production export complete (read-only, no Supabase calls).");
  console.log("[cv-recovery] Downloaded:", filename);
  console.table(summary.counts);
  console.log("[cv-recovery] Job applications:", summary.jobApplications);
  console.log(
    "[cv-recovery] Referenced resume IDs:",
    summary.referencedResumeIds,
    "resolved:",
    summary.resolvedResumeIds,
    "unresolved:",
    summary.unresolvedResumeIds,
  );
  if (unresolved.length) {
    console.warn("[cv-recovery] Unresolved resume IDs in production cache:", unresolved);
  }

  window.cvLocalStorageRecovery = window.cvLocalStorageRecovery || {};
  window.cvLocalStorageRecovery.lastExport = payload;
  window.cvLocalStorageRecovery.KEYS = KEYS;

  return payload;
})();
