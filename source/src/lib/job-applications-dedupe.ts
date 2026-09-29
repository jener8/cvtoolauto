import { normalizeJobApplication } from "@/lib/application-outcome"
import type { JobApplication, ResumeVersion } from "@/lib/types"

export type ApplicationMatchInput = {
  folderId: string
  company: string
  jobTitle: string
  appliedDate: number
  excludeApplicationIds?: Set<string>
}

export type LikelyDuplicateGroup = {
  key: string
  company: string
  jobTitle: string
  appliedDate: number
  applications: JobApplication[]
}

function normalizeMatchText(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeAppliedTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

function readApplicationCompany(app: JobApplication): string {
  const raw =
    app.company ??
    (app as JobApplication & { role?: unknown }).role
  return normalizeMatchText(raw)
}

function readApplicationJobTitle(app: JobApplication): string {
  const raw =
    app.jobTitle ??
    (app as JobApplication & { title?: unknown }).title
  return normalizeMatchText(raw)
}

function applicationAppliedTimestamp(app: JobApplication): number {
  return normalizeAppliedTimestamp(app.appliedDate ?? app.lastModified)
}

export function sameApplicationCalendarDay(a: number, b: number): boolean {
  const safeA = normalizeAppliedTimestamp(a)
  const safeB = normalizeAppliedTimestamp(b)
  const da = new Date(safeA)
  const db = new Date(safeB)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return safeA === safeB
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function buildApplicationMatchKey(input: {
  folderId?: string | null
  company?: unknown
  jobTitle?: unknown
  role?: unknown
  title?: unknown
  appliedDate?: unknown
  lastModified?: unknown
}): string {
  const applied = normalizeAppliedTimestamp(input.appliedDate ?? input.lastModified)
  const day = new Date(applied)
  const dayKey = Number.isNaN(day.getTime())
    ? "unknown-day"
    : `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`
  return [
    typeof input.folderId === "string" ? input.folderId : "",
    normalizeMatchText(input.company ?? input.role),
    normalizeMatchText(input.jobTitle ?? input.title),
    dayKey,
  ].join("|")
}

/** Same folder + company + role, ignoring applied date (restore often shifts dates by a day). */
export function buildApplicationRoleKey(app: JobApplication): string {
  const company = readApplicationCompany(app)
  const title = readApplicationJobTitle(app)
  if (!company && !title) return `id:${app.id}`
  return [app.folderId ?? "", company, title].join("|")
}

export function hasApplicationContent(
  app: JobApplication,
  versions: ResumeVersion[],
): boolean {
  const resumeId = app.resumeVersionId?.trim()
  if (resumeId) {
    const linked = versions.find((version) => version.id === resumeId)
    if (linked?.resumeText?.trim()) return true
  }
  if (versions.some((version) => version.applicationId === app.id && version.resumeText?.trim())) {
    return true
  }
  if (app.coverLetterId?.trim()) return true
  if (app.coverLetter?.content?.trim()) return true
  if (app.jobDescription?.trim()) return true
  return false
}

function appliedDatesWithinDays(a: number, b: number, maxDays: number): boolean {
  const safeA = normalizeAppliedTimestamp(a)
  const safeB = normalizeAppliedTimestamp(b)
  if (!safeA || !safeB) return false
  return Math.abs(safeA - safeB) <= maxDays * 24 * 60 * 60 * 1000
}

export function applicationsAreRoleDuplicates(
  a: JobApplication,
  b: JobApplication,
  versions: ResumeVersion[],
): boolean {
  if (!a.folderId || !b.folderId || a.folderId !== b.folderId) return false
  if (readApplicationCompany(a) !== readApplicationCompany(b)) return false
  if (readApplicationJobTitle(a) !== readApplicationJobTitle(b)) return false
  if (a.id === b.id) return false

  if (applicationsMatchForDedupe(a, b)) return true

  const resumeA = a.resumeVersionId?.trim()
  const resumeB = b.resumeVersionId?.trim()
  if (resumeA && resumeB && resumeA === resumeB) return true

  const aContent = hasApplicationContent(a, versions)
  const bContent = hasApplicationContent(b, versions)
  if (aContent !== bContent) return true

  return appliedDatesWithinDays(
    applicationAppliedTimestamp(a),
    applicationAppliedTimestamp(b),
    14,
  )
}

export function applicationsMatchForDedupe(
  a: JobApplication,
  b: JobApplication,
): boolean {
  if (!a.folderId || !b.folderId || a.folderId !== b.folderId) return false
  if (readApplicationCompany(a) !== readApplicationCompany(b)) return false
  if (readApplicationJobTitle(a) !== readApplicationJobTitle(b)) return false
  return sameApplicationCalendarDay(
    applicationAppliedTimestamp(a),
    applicationAppliedTimestamp(b),
  )
}

export function findMatchingApplication(
  applications: JobApplication[],
  input: ApplicationMatchInput,
): JobApplication | null {
  const exclude = input.excludeApplicationIds ?? new Set<string>()
  const targetCompany = normalizeMatchText(input.company)
  const targetTitle = normalizeMatchText(input.jobTitle)
  if (!targetCompany && !targetTitle) return null

  for (const app of applications) {
    if (exclude.has(app.id)) continue
    if (app.folderId !== input.folderId) continue
    if (targetCompany && readApplicationCompany(app) !== targetCompany) continue
    if (targetTitle && readApplicationJobTitle(app) !== targetTitle) continue
    if (
      !sameApplicationCalendarDay(
        applicationAppliedTimestamp(app),
        normalizeAppliedTimestamp(input.appliedDate),
      )
    ) {
      continue
    }
    return app
  }

  return null
}

export function findLikelyDuplicateGroups(
  applications: JobApplication[],
  folderId?: string,
): LikelyDuplicateGroup[] {
  const scoped = folderId
    ? applications.filter((app) => app.folderId === folderId)
    : applications

  const groups = new Map<string, JobApplication[]>()
  for (const app of scoped) {
    const key = buildApplicationMatchKey({
      folderId: app.folderId ?? "",
      company: app.company,
      jobTitle: app.jobTitle,
      role: (app as JobApplication & { role?: unknown }).role,
      title: (app as JobApplication & { title?: unknown }).title,
      appliedDate: app.appliedDate,
      lastModified: app.lastModified,
    })
    const bucket = groups.get(key) ?? []
    bucket.push(app)
    groups.set(key, bucket)
  }

  return [...groups.entries()]
    .filter(([, apps]) => apps.length > 1)
    .map(([key, apps]) => {
      const primary = apps[0]!
      return {
        key,
        company: typeof primary.company === "string" ? primary.company : "",
        jobTitle: typeof primary.jobTitle === "string" ? primary.jobTitle : "",
        appliedDate: applicationAppliedTimestamp(primary) || Date.now(),
        applications: apps.sort(
          (a, b) => applicationAppliedTimestamp(b) - applicationAppliedTimestamp(a),
        ),
      }
    })
}

function resumeScore(version: ResumeVersion | undefined): number {
  if (!version) return 0
  return version.resumeText?.trim().length ?? 0
}

function applicationRichnessScore(app: JobApplication, versions: ResumeVersion[]): number {
  let score = 0
  if (hasApplicationContent(app, versions)) score += 10_000
  const resumeId = app.resumeVersionId?.trim()
  if (resumeId) score += resumeScore(versions.find((version) => version.id === resumeId))
  if (app.coverLetterId?.trim() || app.coverLetter?.content?.trim()) score += 500
  if (app.jobDescription?.trim()) score += 200
  if (app.company?.trim()) score += 50
  if (app.jobTitle?.trim()) score += 50
  return score
}

/** Pick the application to keep in a duplicate group (richest content, then earliest applied date). */
export function choosePrimaryApplication(
  applications: JobApplication[],
  versions: ResumeVersion[],
): JobApplication {
  const byVersionId = new Map(versions.map((v) => [v.id, v]))
  return [...applications].sort((a, b) => {
    const richnessDiff = applicationRichnessScore(b, versions) - applicationRichnessScore(a, versions)
    if (richnessDiff !== 0) return richnessDiff

    const appliedA = applicationAppliedTimestamp(a)
    const appliedB = applicationAppliedTimestamp(b)
    if (appliedA > 0 && appliedB > 0 && appliedA !== appliedB) {
      return appliedA - appliedB
    }

    const modDiff = applicationAppliedTimestamp(b) - applicationAppliedTimestamp(a)
    if (modDiff !== 0) return modDiff

    const scoreA = resumeScore(
      a.resumeVersionId ? byVersionId.get(a.resumeVersionId) : undefined,
    )
    const scoreB = resumeScore(
      b.resumeVersionId ? byVersionId.get(b.resumeVersionId) : undefined,
    )
    return scoreB - scoreA
  })[0]!
}

function coalesceDuplicateApplications(
  primary: JobApplication,
  duplicates: JobApplication[],
): JobApplication {
  let next: JobApplication = { ...primary }

  for (const other of duplicates) {
    if (!next.resumeVersionId?.trim() && other.resumeVersionId?.trim()) {
      next.resumeVersionId = other.resumeVersionId
    }
    if (!next.coverLetterId?.trim() && other.coverLetterId?.trim()) {
      next.coverLetterId = other.coverLetterId
    }
    if (!next.jobDescription?.trim() && other.jobDescription?.trim()) {
      next.jobDescription = other.jobDescription
    }
    if (!next.jobDescriptionUrl?.trim() && other.jobDescriptionUrl?.trim()) {
      next.jobDescriptionUrl = other.jobDescriptionUrl
    }
    if (!next.location?.trim() && other.location?.trim()) {
      next.location = other.location
    }

    const appliedA = applicationAppliedTimestamp(next)
    const appliedB = applicationAppliedTimestamp(other)
    if (appliedB > 0 && (!appliedA || appliedB < appliedA)) {
      next.appliedDate = appliedB
    }

    if ((other.pipeline?.length ?? 0) > (next.pipeline?.length ?? 0)) {
      next.pipeline = other.pipeline
    }
    if ((other.lastModified ?? 0) > (next.lastModified ?? 0)) {
      next.lastModified = other.lastModified
    }
  }

  return normalizeJobApplication(next)
}

function clusterDuplicateApplications(
  applications: JobApplication[],
  folderId: string | undefined,
  versions: ResumeVersion[],
): JobApplication[][] {
  const scoped = folderId
    ? applications.filter((app) => app.folderId === folderId)
    : applications

  const parent = scoped.map((_, index) => index)

  function find(index: number): number {
    let current = index
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!
      current = parent[current]!
    }
    return current
  }

  function unite(a: number, b: number): void {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let i = 0; i < scoped.length; i++) {
    for (let j = i + 1; j < scoped.length; j++) {
      if (applicationsAreRoleDuplicates(scoped[i]!, scoped[j]!, versions)) {
        unite(i, j)
      }
    }
  }

  const clusters = new Map<number, JobApplication[]>()
  for (let i = 0; i < scoped.length; i++) {
    const root = find(i)
    const bucket = clusters.get(root) ?? []
    bucket.push(scoped[i]!)
    clusters.set(root, bucket)
  }

  return [...clusters.values()].filter((cluster) => cluster.length > 1)
}

export function mergeDuplicateGroup(
  applications: JobApplication[],
  group: LikelyDuplicateGroup,
  versions: ResumeVersion[],
): {
  nextApplications: JobApplication[]
  keptApplicationId: string
  removedApplicationIds: string[]
} {
  const primary = choosePrimaryApplication(group.applications, versions)
  const duplicates = group.applications.filter((app) => app.id !== primary.id)
  const coalesced = coalesceDuplicateApplications(primary, duplicates)
  const removedIds = new Set(duplicates.map((app) => app.id))

  const nextApplications = applications
    .filter((app) => !removedIds.has(app.id))
    .map((app) => (app.id === primary.id ? coalesced : app))

  return {
    nextApplications,
    keptApplicationId: primary.id,
    removedApplicationIds: [...removedIds],
  }
}

/** Merge all duplicate groups in one pass; keeps the richest application per role cluster. */
export function mergeAllDuplicateApplications(
  applications: JobApplication[],
  versions: ResumeVersion[],
  folderId?: string,
): {
  applications: JobApplication[]
  removedApplications: JobApplication[]
} {
  const clusters = clusterDuplicateApplications(applications, folderId, versions)
  if (clusters.length === 0) {
    return { applications, removedApplications: [] }
  }

  let nextApplications = applications
  const removedById = new Map<string, JobApplication>()

  for (const cluster of clusters) {
    const group: LikelyDuplicateGroup = {
      key: buildApplicationRoleKey(cluster[0]!),
      company: cluster[0]?.company ?? "",
      jobTitle: cluster[0]?.jobTitle ?? "",
      appliedDate: applicationAppliedTimestamp(cluster[0]!) || Date.now(),
      applications: cluster,
    }
    const merged = mergeDuplicateGroup(nextApplications, group, versions)
    nextApplications = merged.nextApplications
    for (const id of merged.removedApplicationIds) {
      const job = applications.find((app) => app.id === id)
      if (job) removedById.set(id, job)
    }
  }

  return {
    applications: nextApplications,
    removedApplications: [...removedById.values()],
  }
}

/** Collapse duplicate roles across workspace folders (same company + title + calendar day). */
export function dedupeCrossFolderDuplicateApplications(
  applications: JobApplication[],
  versions: ResumeVersion[] = [],
): JobApplication[] {
  const groups = new Map<string, JobApplication[]>()

  for (const app of applications) {
    const company = readApplicationCompany(app)
    const title = readApplicationJobTitle(app)
    if (!company && !title) {
      groups.set(`id:${app.id}`, [app])
      continue
    }
    const applied = applicationAppliedTimestamp(app)
    const day = new Date(applied)
    const dayKey = Number.isNaN(day.getTime())
      ? "unknown-day"
      : `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`
    const key = `${company}|${title}|${dayKey}`
    const bucket = groups.get(key) ?? []
    bucket.push(app)
    groups.set(key, bucket)
  }

  const kept: JobApplication[] = []
  for (const apps of groups.values()) {
    if (apps.length === 1) {
      kept.push(apps[0]!)
      continue
    }
    const folderIds = new Set(apps.map((app) => app.folderId).filter(Boolean))
    // Same role saved twice across duplicate workspace folders — keep the newest record.
    if (folderIds.size > 1) {
      kept.push(choosePrimaryApplication(apps, versions))
      continue
    }
    // Same folder: only collapse exact same-calendar-day duplicates.
    kept.push(choosePrimaryApplication(apps, versions))
  }

  return kept
}

/** @deprecated Use dedupeCrossFolderDuplicateApplications — too aggressive for same-folder list. */
export function dedupeApplicationsByCompanyAndTitle(
  applications: JobApplication[],
  versions: ResumeVersion[] = [],
): JobApplication[] {
  return dedupeCrossFolderDuplicateApplications(applications, versions)
}
