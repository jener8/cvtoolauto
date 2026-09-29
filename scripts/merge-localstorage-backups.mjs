#!/usr/bin/env node
/**
 * Merge localhost + production localStorage exports.
 * Keeps localhost job applications; fills resume versions from production.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
const localhostPath =
  args[0] ??
  "/Users/jenny/Downloads/cv-localhost-localStorage-backup-before-import-2026-06-14-21-22-13.json"
const productionPath =
  args[1] ??
  "/Users/jenny/Downloads/cv-production-localStorage-2026-06-14-21-18-06.json"
const outPath =
  args[2] ??
  resolve(
    process.cwd(),
    "backups/cv-merged-localStorage-localhost-jobs-plus-production-resumes.json",
  )

function parseBackup(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"))
  const keys = raw.keys ?? raw
  return { raw, keys }
}

function parseArray(raw) {
  if (raw == null || raw === "") return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

function resumeId(row) {
  if (!row || typeof row !== "object") return null
  return row.i || row.id || null
}

const localhost = parseBackup(localhostPath)
const production = parseBackup(productionPath)

const mergedKeys = { ...localhost.keys }
mergedKeys.cv_local_resume_versions = production.keys.cv_local_resume_versions ?? "[]"

if (!mergedKeys.cv_local_cover_letters && production.keys.cv_local_cover_letters) {
  mergedKeys.cv_local_cover_letters = production.keys.cv_local_cover_letters
}

const localJobs = parseArray(localhost.keys.cv_local_job_applications)
const prodResumes = parseArray(production.keys.cv_local_resume_versions)
const resumeIds = new Set(prodResumes.map(resumeId).filter(Boolean))
const referenced = [
  ...new Set(localJobs.map((j) => j.resumeVersionId).filter(Boolean)),
]

const resolved = referenced.filter((id) => resumeIds.has(id))
const missing = referenced.filter((id) => !resumeIds.has(id))

const payload = {
  schemaVersion: 1,
  kind: "cv-localstorage-merged-backup",
  mergedAt: new Date().toISOString(),
  sources: {
    localhost: localhostPath,
    production: productionPath,
  },
  summary: {
    jobApplications: localJobs.length,
    resumeVersions: prodResumes.length,
    referencedResumeIds: referenced.length,
    resolvedResumeIds: resolved.length,
    missingResumeIds: missing,
  },
  keys: mergedKeys,
}

writeFileSync(outPath, JSON.stringify(payload, null, 2))

console.log("Wrote merged backup:", outPath)
console.log("  job applications:", payload.summary.jobApplications)
console.log("  resume versions:", payload.summary.resumeVersions)
console.log("  referenced / resolved:", resolved.length, "/", referenced.length)
if (missing.length) {
  console.log("  still missing resume IDs:")
  for (const id of missing) console.log("   -", id)
}
