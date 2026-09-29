import { normalizeJobApplication } from "./application-outcome"
import { mapJobApplicationRow } from "./job-application-map"
import { normalizeUploadDetails } from "./upload-details"
import { mergeJobLinkFieldsForUpsert, mergeNewerJobApplication } from "./job-application-link-guard"
import { sortJobApplicationsByDate, COMPANY_NOT_ADDED, JOB_TITLE_NOT_ADDED } from "./job-application-display"
import { prepareJobApplicationsForWorkspace } from "./job-applications-normalize"
import { mapFolderRow } from "./folder-map"
import type { JobApplication, ResumeVersion, Folder, CoverLetter } from "./types"
import { readFoldersCache, writeFoldersCache } from "./folders-cache"
import { getSupabaseClient } from "./supabase/client"
import {
  ensureSupabaseAuthSession,
  getAuthenticatedSupabaseUserId,
} from "./supabase/app-auth"
import { isSupabaseAuthBlocked } from "./supabase/client-auth-cache"
import { shouldUseLocalFallback, markSupabaseOffline } from "./supabase/availability"
import {
  describeSupabaseError,
  formatSupabaseErrorMessage,
  isRetryableSupabaseError,
  parsePgrst204MissingColumn,
  serializeSupabaseError,
} from "./supabase/errors"
import { LOCAL_STORE_KEYS, readLocalStore, writeLocalStore } from "./supabase/local-store"
import { supabaseWithAbort } from "./supabase/request"
import { SUPABASE_REQUEST_TIMEOUT_MS } from "./supabase/config"

export { describeSupabaseError }

async function upsertJobApplicationRowsWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  rows: Record<string, unknown>[],
): Promise<{ error: unknown }> {
  let attemptRows = rows.map((row) => ({ ...row }))
  const omittedColumns: string[] = []

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await supabase.from("job_applications").upsert(attemptRows, {
      onConflict: "id",
    })

    if (!error) {
      if (omittedColumns.length > 0) {
        console.warn(
          `[v0] Job applications cloud sync succeeded after omitting columns missing from Supabase schema: ${omittedColumns.join(", ")}. Run scripts/apply-missing-supabase-schema.sql in the Supabase SQL editor.`,
        )
      }
      return { error: null }
    }

    const missingColumn = parsePgrst204MissingColumn(error)
    if (!missingColumn || !attemptRows.some((row) => missingColumn in row)) {
      return { error }
    }

    attemptRows = attemptRows.map((row) => {
      const { [missingColumn]: _removed, ...rest } = row
      return rest
    })
    omittedColumns.push(missingColumn)
    console.warn(`[v0] Retrying job applications sync without missing column: ${missingColumn}`)
  }

  return {
    error: new Error(
      `Job applications cloud sync failed after omitting columns: ${omittedColumns.join(", ")}`,
    ),
  }
}

async function resolveRemoteUserId(): Promise<string | null> {
  if (isSupabaseAuthBlocked()) return null
  await ensureSupabaseAuthSession()
  return getAuthenticatedSupabaseUserId()
}

function jobApplicationDbText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  return fallback
}

/** Merge partial updates onto a job without dropping nested cover letter / prep fields. */
export function applyJobApplicationUpdates(
  job: JobApplication,
  updates: Partial<JobApplication>,
): JobApplication {
  const now = Date.now()
  const merged: JobApplication = {
    ...job,
    ...updates,
    lastModified: now,
    coverLetter: updates.coverLetter
      ? {
          ...(job.coverLetter ?? { content: "", lastModified: now }),
          ...updates.coverLetter,
          lastModified: updates.coverLetter.lastModified ?? now,
        }
      : job.coverLetter,
    yourStory: updates.yourStory
      ? {
          ...(job.yourStory ?? {
            content: "",
            lastModified: now,
            resumeVersionId: job.resumeVersionId,
            cvEvidence: [],
          }),
          ...updates.yourStory,
          lastModified: updates.yourStory.lastModified ?? now,
          cvEvidence:
            updates.yourStory.cvEvidence !== undefined
              ? updates.yourStory.cvEvidence
              : job.yourStory?.cvEvidence ?? [],
          applicationStoryWizard: updates.yourStory.applicationStoryWizard
            ? {
                ...job.yourStory?.applicationStoryWizard,
                ...updates.yourStory.applicationStoryWizard,
                inputs: updates.yourStory.applicationStoryWizard.inputs
                  ? {
                      ...job.yourStory?.applicationStoryWizard?.inputs,
                      ...updates.yourStory.applicationStoryWizard.inputs,
                      optionalSources: updates.yourStory.applicationStoryWizard.inputs
                        .optionalSources
                        ? {
                            ...job.yourStory?.applicationStoryWizard?.inputs?.optionalSources,
                            ...updates.yourStory.applicationStoryWizard.inputs.optionalSources,
                          }
                        : job.yourStory?.applicationStoryWizard?.inputs?.optionalSources,
                    }
                  : job.yourStory?.applicationStoryWizard?.inputs,
                analysis: updates.yourStory.applicationStoryWizard.analysis
                  ? {
                      ...job.yourStory?.applicationStoryWizard?.analysis,
                      ...updates.yourStory.applicationStoryWizard.analysis,
                    }
                  : job.yourStory?.applicationStoryWizard?.analysis,
                storyMap: updates.yourStory.applicationStoryWizard.storyMap
                  ? {
                      ...job.yourStory?.applicationStoryWizard?.storyMap,
                      ...updates.yourStory.applicationStoryWizard.storyMap,
                    }
                  : job.yourStory?.applicationStoryWizard?.storyMap,
                illustration: updates.yourStory.applicationStoryWizard.illustration
                  ? {
                      ...job.yourStory?.applicationStoryWizard?.illustration,
                      ...updates.yourStory.applicationStoryWizard.illustration,
                    }
                  : job.yourStory?.applicationStoryWizard?.illustration,
              }
            : job.yourStory?.applicationStoryWizard,
        }
      : job.yourStory,
    companyInfo: updates.companyInfo
      ? { ...job.companyInfo, ...updates.companyInfo }
      : job.companyInfo,
    interviewPrep: updates.interviewPrep
      ? { ...job.interviewPrep, ...updates.interviewPrep }
      : job.interviewPrep,
    contacts: updates.contacts !== undefined ? updates.contacts : job.contacts,
    fitScores: updates.fitScores !== undefined ? updates.fitScores : job.fitScores,
    redFlags: updates.redFlags !== undefined ? updates.redFlags : job.redFlags,
    pipeline: updates.pipeline !== undefined ? updates.pipeline : job.pipeline,
    uploadDetails: updates.uploadDetails
      ? {
          ...job.uploadDetails,
          ...updates.uploadDetails,
          salaryGuidance: updates.uploadDetails.salaryGuidance
            ? {
                ...job.uploadDetails?.salaryGuidance,
                ...updates.uploadDetails.salaryGuidance,
              }
            : job.uploadDetails?.salaryGuidance,
        }
      : job.uploadDetails,
  }

  return normalizeJobApplication(merged)
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (isRetryableSupabaseError(error) && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`[v0] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }

  throw lastError
}

const FOLDERS_QUERY_TIMEOUT_MS = SUPABASE_REQUEST_TIMEOUT_MS

function preserveFolderListWhenEmpty(remote: Folder[], label: string): Folder[] {
  if (remote.length > 0) return remote
  const fallback = getLocalFoldersFallback()
  if (fallback.length > 0) {
    console.warn(`[v0] ${label} returned no folders; keeping cached local list`)
    return fallback
  }
  return remote
}

function getLocalFoldersFallback(): Folder[] {
  const cached = readFoldersCache()
  if (cached.length > 0) return cached
  return readLocalStore<Folder>(LOCAL_STORE_KEYS.folders)
}

async function fetchFoldersViaApi(): Promise<Folder[]> {
  if (shouldUseLocalFallback()) {
    return getLocalFoldersFallback()
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FOLDERS_QUERY_TIMEOUT_MS)
  try {
    const res = await fetch("/api/folders", {
      signal: controller.signal,
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || (body as { offline?: boolean }).offline) {
      const fallback = getLocalFoldersFallback()
      if (fallback.length > 0) return fallback
      throw new Error((body as { error?: string }).error || `API error ${res.status}`)
    }
    const folders = (body as { folders?: Folder[] }).folders
    if (!Array.isArray(folders)) {
      throw new Error("Invalid folders API response")
    }
    return folders
  } finally {
    clearTimeout(timeoutId)
  }
}

type JobApplicationsApiResponse = {
  applications?: JobApplication[]
  offline?: boolean
  error?: string
  hint?: string
  code?: string
  cloudCount?: number
  byFolder?: Record<string, number>
}

export type JobApplicationsLoadMeta = {
  cloudCount: number
  localOnlyCount: number
  totalCount: number
  offline: boolean
  authFailure?: boolean
  code?: string
  error?: string
  hint?: string
}

let lastJobApplicationsLoadMeta: JobApplicationsLoadMeta = {
  cloudCount: 0,
  localOnlyCount: 0,
  totalCount: 0,
  offline: true,
}

export function getLastJobApplicationsLoadMeta(): JobApplicationsLoadMeta {
  return lastJobApplicationsLoadMeta
}

async function fetchJobApplicationsViaApi(
  folderId?: string,
): Promise<JobApplicationsApiResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FOLDERS_QUERY_TIMEOUT_MS)
  const url = folderId
    ? `/api/workspace/job-applications?folderId=${encodeURIComponent(folderId)}`
    : "/api/workspace/job-applications"
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    })
    return (await res.json().catch(() => ({}))) as JobApplicationsApiResponse
  } finally {
    clearTimeout(timeoutId)
  }
}

// Resume versions — delegates to resume-persistence (local + remote merge)
export {
  loadResumes as loadResumeVersions,
  loadResumesForWorkspace,
  cacheResumeVersionsFromCloud,
  saveResumes as saveResumeVersions,
  saveResume,
  saveResumeDraft,
  deleteResume,
  createNewResumeId,
  ensureResumeId,
  normalizeResumeVersion,
  defaultResumeTitle,
  clearLocalSavedResumeVersions,
  clearAllCvLocalStorage,
  retryResumeRemoteSync,
} from "./resume-persistence"

// Job applications storage functions
export const loadJobApplications = async (folderId?: string): Promise<JobApplication[]> => {
  return await jobApplicationsStorage.getAll(folderId)
}

/** Pin applications to the active workspace folder for display and local cache. */
export function assignApplicationsToWorkspaceFolder(
  applications: JobApplication[],
  folderId: string,
): JobApplication[] {
  return applications.map((app) =>
    app.folderId === folderId ? app : { ...app, folderId },
  )
}

/**
 * Load every cloud application for this account. Preserves each row's original
 * folder_id until the sync layer assigns the active workspace — remapping here
 * caused mergeAllDuplicateApplications to treat cross-folder rows as duplicates.
 */
export async function loadWorkspaceJobApplications(
  folderId: string,
  _allFolders: Folder[],
  _workspaceSlug?: string | null,
): Promise<JobApplication[]> {
  if (shouldUseLocalFallback()) {
    return loadJobApplications(folderId)
  }

  try {
    const all = await loadJobApplications()
    const meta = getLastJobApplicationsLoadMeta()

    if (meta.cloudCount === 0 && meta.totalCount > 0) {
      console.warn(
        `[workspace] Showing ${meta.totalCount} application(s) from this device only — cloud returned 0.`,
        meta.hint ?? meta.error ?? "",
      )
    } else if (meta.cloudCount > 0) {
      console.info(`[workspace] Cloud applications loaded: ${meta.cloudCount}`)
    }

    if (all.length === 0) {
      return loadJobApplications(folderId)
    }

    return sortJobApplicationsByDate(prepareJobApplicationsForWorkspace(all))
  } catch (error) {
    console.warn("[workspace] Full cloud application load failed, using folder scope:", error)
    return loadJobApplications(folderId)
  }
}

export const saveJobApplications = async (applications: JobApplication[], folderId?: string): Promise<void> => {
  await jobApplicationsStorage.save(applications, folderId)
}

/** Persist job applications to localStorage only (no remote call). */
export function cacheJobApplicationsLocally(
  applications: JobApplication[],
  folderId?: string,
): void {
  mergeLocalJobApplications(applications, folderId)
}

function mergeLocalJobApplications(applications: JobApplication[], folderId?: string): void {
  const existing = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications)
  const merged = folderId
    ? [...existing.filter((app) => app.folderId !== folderId), ...applications]
    : applications
  writeLocalStore(LOCAL_STORE_KEYS.jobApplications, merged)
}

export type DeleteJobApplicationResult = {
  success: boolean
  applicationId: string
  folderId?: string
  resumeVersionId?: string
  remoteDeleted: boolean
  localDeleted: boolean
  verifiedAbsent: boolean
  duplicateMatches: Array<{ id: string; role: string; company: string; folder_id: string | null }>
  error?: string
}

/** Explicit remote delete — never infer deletes from a partial in-memory list. */
export async function deleteJobApplicationById(
  id: string,
  context?: {
    folderId?: string
    resumeVersionId?: string
    company?: string
    jobTitle?: string
  },
): Promise<DeleteJobApplicationResult> {
  const applicationId = id.trim()
  console.log("Deleting application:", applicationId, {
    folderId: context?.folderId,
    resumeVersionId: context?.resumeVersionId,
    company: context?.company,
    jobTitle: context?.jobTitle,
  })

  const result: DeleteJobApplicationResult = {
    success: false,
    applicationId,
    folderId: context?.folderId,
    resumeVersionId: context?.resumeVersionId,
    remoteDeleted: false,
    localDeleted: false,
    verifiedAbsent: false,
    duplicateMatches: [],
  }

  if (!applicationId) {
    result.error = "Missing application id"
    return result
  }

  const removeFromLocalStore = () => {
    const localAll = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).filter(
      (app) => app.id !== applicationId,
    )
    writeLocalStore(LOCAL_STORE_KEYS.jobApplications, localAll)
    result.localDeleted = true
  }

  if (shouldUseLocalFallback()) {
    removeFromLocalStore()
    result.success = true
    result.verifiedAbsent = true
    return result
  }

  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      removeFromLocalStore()
      result.success = true
      result.verifiedAbsent = true
      return result
    }

    await ensureSupabaseAuthSession()

    if (context?.company?.trim()) {
      const companyNeedle = context.company.trim()
      const { data: duplicateRows, error: duplicateError } = await supabaseWithAbort(
        (signal) =>
          supabase
            .from("job_applications")
            .select("id, role, company, folder_id")
            .ilike("company", `%${companyNeedle}%`)
            .abortSignal(signal),
        "Duplicate application lookup",
      )

      if (duplicateError) {
        console.warn("[v0] Duplicate application lookup failed:", duplicateError)
      } else {
        result.duplicateMatches = (duplicateRows ?? []).map((row) => ({
          id: String(row.id),
          role: String(row.role ?? ""),
          company: String(row.company ?? ""),
          folder_id: row.folder_id ? String(row.folder_id) : null,
        }))
        console.log("[v0] Matching application rows before delete:", result.duplicateMatches)
      }
    }

    const { error } = await supabaseWithAbort(
      (signal) =>
        supabase.from("job_applications").delete().eq("id", applicationId).abortSignal(signal),
      "Delete job application",
    )
    console.log("Delete error:", error)

    if (error) {
      result.error = formatSupabaseErrorMessage(error)
      console.error("[v0] Failed to delete job application from database:", error)
      return result
    }

    result.remoteDeleted = true

    const { data: verifyRow, error: verifyError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle()

    if (verifyError) {
      console.warn("[v0] Post-delete verification query failed:", verifyError)
      result.verifiedAbsent = true
    } else {
      result.verifiedAbsent = !verifyRow
      console.log("[v0] Post-delete verification:", {
        applicationId,
        stillExists: Boolean(verifyRow),
      })
    }

    result.success = result.verifiedAbsent
    if (!result.success) {
      result.error = "Application still exists in the database after delete."
      return result
    }

    removeFromLocalStore()
    return result
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Delete failed"
    console.error("[v0] Failed to delete job application from database:", e)
    return result
  }
}

function mergeRemoteWithLocalJobApplications(
  remote: JobApplication[],
  folderId?: string,
): JobApplication[] {
  const localAll = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).map(
    normalizeJobApplication,
  )
  const local = folderId ? localAll.filter((app) => app.folderId === folderId) : localAll
  const localById = new Map(local.map((app) => [app.id, app]))
  const remoteIds = new Set(remote.map((app) => app.id))
  const localOnly = local.filter((app) => !remoteIds.has(app.id))
  const mergedRemote = remote.map((remoteApp) => {
    const localApp = localById.get(remoteApp.id)
    if (!localApp) return remoteApp
    return mergeNewerJobApplication(remoteApp, localApp)
  })
  if (localOnly.length === 0) {
    return sortJobApplicationsByDate(prepareJobApplicationsForWorkspace(mergedRemote))
  }
  return sortJobApplicationsByDate(
    prepareJobApplicationsForWorkspace([...mergedRemote, ...localOnly]),
  )
}

function finishJobApplicationsLoad(
  remote: JobApplication[],
  folderId: string | undefined,
  meta: Partial<JobApplicationsLoadMeta>,
): JobApplication[] {
  const merged = mergeRemoteWithLocalJobApplications(remote, folderId)
  const localOnlyCount = Math.max(0, merged.length - remote.length)
  lastJobApplicationsLoadMeta = {
    cloudCount: remote.length,
    localOnlyCount,
    totalCount: merged.length,
    offline: meta.offline ?? remote.length === 0,
    authFailure: meta.authFailure,
    code: meta.code,
    error: meta.error,
    hint: meta.hint,
  }
  console.info(
    `[v0] Job applications: ${merged.length} total (${remote.length} from cloud, ${localOnlyCount} local-only)`,
    meta.authFailure ? { authFailure: true, code: meta.code } : meta.hint ? { hint: meta.hint } : "",
  )
  return merged
}

/** Cloud unavailable — return local data only; never wipe applications on auth/sync failure. */
function finishJobApplicationsLoadOffline(
  folderId: string | undefined,
  meta: Partial<JobApplicationsLoadMeta> & { code?: string },
): JobApplication[] {
  const local = loadLocalJobApplicationsOnly(folderId)
  lastJobApplicationsLoadMeta = {
    cloudCount: 0,
    localOnlyCount: local.length,
    totalCount: local.length,
    offline: true,
    authFailure: meta.authFailure ?? true,
    code: meta.code,
    error: meta.error,
    hint: meta.hint,
  }
  console.warn(
    `[v0] Job applications: cloud unavailable — showing ${local.length} local application(s) without mutation`,
    {
      code: meta.code,
      error: meta.error,
    },
  )
  return local
}

function loadLocalJobApplicationsOnly(folderId?: string): JobApplication[] {
  const localAll = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).map(
    normalizeJobApplication,
  )
  const scoped = folderId ? localAll.filter((app) => app.folderId === folderId) : localAll
  return sortJobApplicationsByDate(prepareJobApplicationsForWorkspace(scoped))
}

export const jobApplicationsStorage = {
  getAll: async (folderId?: string): Promise<JobApplication[]> => {
    if (typeof window === "undefined") return []

    if (shouldUseLocalFallback()) {
      return loadLocalJobApplicationsOnly(folderId)
    }

    try {
      const api = await fetchJobApplicationsViaApi(folderId)
      if (!api.offline && Array.isArray(api.applications)) {
        if (api.byFolder) {
          console.info("[workspace] Cloud applications:", api.cloudCount ?? api.applications.length, "by folder:", api.byFolder)
        }
        return finishJobApplicationsLoad(api.applications, folderId, { offline: false })
      }

      if (api.code === "SUPABASE_SERVER_AUTH_MISSING" || api.code === "SUPABASE_SERVER_AUTH_FAILED") {
        console.warn("[v0] Cloud applications unavailable:", api.error, api.hint ?? "")
        return finishJobApplicationsLoadOffline(folderId, {
          authFailure: true,
          code: api.code,
          error: api.error,
          hint: api.hint,
        })
      }
    } catch (apiError) {
      console.warn("[v0] Job applications API failed, trying Supabase client:", describeSupabaseError(apiError))
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        return finishJobApplicationsLoadOffline(folderId, {
          error: "Supabase client unavailable",
        })
      }

      if (isSupabaseAuthBlocked()) {
        return finishJobApplicationsLoadOffline(folderId, {
          authFailure: true,
          code: "SUPABASE_SERVER_AUTH_FAILED",
          error: "Supabase auth session blocked after recent failure",
        })
      }

      const authenticated = await ensureSupabaseAuthSession()
      if (!authenticated) {
        console.warn("[v0] Supabase auth session unavailable — keeping local applications only")
        return finishJobApplicationsLoadOffline(folderId, {
          authFailure: true,
          code: "SUPABASE_SERVER_AUTH_FAILED",
          error: "Supabase auth session could not be started",
          hint: "Add SUPABASE_APP_USER_EMAIL and SUPABASE_APP_USER_PASSWORD to .env.local, then restart the server.",
        })
      }

      let query = supabase
        .from("job_applications")
        .select("*")
        .order("applied_date", { ascending: false })

      if (folderId) {
        query = query.eq("folder_id", folderId)
      }

      const { data, error } = await supabaseWithAbort(
        (signal) => query.abortSignal(signal),
        "Job applications query",
      )

      if (error) {
        console.error(
          "[v0] Supabase load error:",
          formatSupabaseErrorMessage(error),
          serializeSupabaseError(error),
        )
        return finishJobApplicationsLoadOffline(folderId, {
          error: formatSupabaseErrorMessage(error),
        })
      }

      const applications: JobApplication[] =
        data?.map((row) => mapJobApplicationRow(row as Record<string, unknown>)) ?? []

      return finishJobApplicationsLoad(applications, folderId, { offline: false })
    } catch (e) {
      console.error(
        "[v0] Failed to load job applications from database:",
        formatSupabaseErrorMessage(e),
        serializeSupabaseError(e),
      )
      return finishJobApplicationsLoadOffline(folderId, {
        error: formatSupabaseErrorMessage(e),
      })
    }
  },

  save: async (applications: JobApplication[], folderId?: string): Promise<void> => {
    if (typeof window === "undefined") return

    if (shouldUseLocalFallback()) {
      mergeLocalJobApplications(applications, folderId)
      return
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        mergeLocalJobApplications(applications, folderId)
        return
      }

      // Upsert only — never delete rows missing from this in-memory array.
      // Partial/stale state previously caused permanent data loss (sync-delete).
      if (applications.length > 0) {
        await ensureSupabaseAuthSession()
        const userId = await resolveRemoteUserId()
        const applicationIds = applications.map((app) => app.id)
        const { data: existingLinkRows } = await supabase
          .from("job_applications")
          .select("id, resume_version_id, cover_letter_id")
          .in("id", applicationIds)
        const existingLinksById = new Map(
          (existingLinkRows ?? []).map((row) => [
            String(row.id),
            {
              resume_version_id: row.resume_version_id as string | null,
              cover_letter_id: row.cover_letter_id as string | null,
            },
          ]),
        )

        const dbApplications = applications.map((app) => {
          const links = mergeJobLinkFieldsForUpsert(app, existingLinksById.get(app.id))
          return {
          id: app.id,
          role: jobApplicationDbText(app.jobTitle, JOB_TITLE_NOT_ADDED),
          company: jobApplicationDbText(app.company, COMPANY_NOT_ADDED),
          job_description: {
            content: app.jobDescription,
            summary: app.jobDescriptionSummary,
            url: app.jobDescriptionUrl,
            resumeVersionId: app.resumeVersionId,
            contactPerson: app.contactPersonName,
            salary: app.salaryExpectation,
            employmentType: app.employmentType,
            firstInterviewDate: app.firstInterviewDate
              ? new Date(app.firstInterviewDate).toISOString()
              : null,
            additionalInterviewDates: (app.additionalInterviewDates ?? []).map((value) =>
              new Date(value).toISOString(),
            ),
            rejectionDate: app.rejectionDate ? new Date(app.rejectionDate).toISOString() : null,
            offerDate: app.offerDate ? new Date(app.offerDate).toISOString() : null,
            pipeline: (app.pipeline ?? []).map((record) => ({
              stage: record.stage,
              outcome: record.outcome,
              date: record.date ? new Date(record.date).toISOString() : null,
              notes: record.notes ?? null,
            })),
            location: app.location?.trim() || null,
          },
          job_strategy: app.jobStrategy,
          why_content: {
            text: app.why,
          },
          company_info: app.companyInfo,
          contacts: app.contacts,
          cover_letter: app.coverLetter,
          your_story: app.yourStory ?? null,
          cover_letter_id: links.cover_letter_id,
          resume_version_id: links.resume_version_id,
          interview_prep: app.interviewPrep,
          fit_scores: app.fitScores || null,
          red_flags: app.redFlags || null,
          upload_details: app.uploadDetails || null,
          status: app.status ?? "applied",
          folder_id: app.folderId || null,
          user_id: userId,
          applied_date: new Date(app.appliedDate).toISOString(),
          // Do not overwrite created_at on upsert — DB default handles inserts;
          // rewriting it from appliedDate previously stamped legacy rows as "new".
          updated_at: new Date(app.lastModified).toISOString(),
        }})

        const { error } = await upsertJobApplicationRowsWithSchemaFallback(
          supabase,
          dbApplications as Record<string, unknown>[],
        )

        if (error) {
          console.warn(
            "[v0] Failed to save job applications to database:",
            formatSupabaseErrorMessage(error),
            serializeSupabaseError(error),
          )
          mergeLocalJobApplications(applications, folderId)
          markSupabaseOffline(formatSupabaseErrorMessage(error))
        } else {
          mergeLocalJobApplications(applications, folderId)
          console.log("[v0] Saved", applications.length, "job applications to database")
        }
      } else if (folderId) {
        mergeLocalJobApplications(applications, folderId)
      }
    } catch (e) {
      console.warn(
        "[v0] Failed to save job applications to database:",
        formatSupabaseErrorMessage(e),
        serializeSupabaseError(e),
      )
      mergeLocalJobApplications(applications, folderId)
      markSupabaseOffline(e instanceof Error ? e.message : "Job applications save failed")
    }
  },

  create: async (application: Omit<JobApplication, "id">): Promise<JobApplication> => {
    const newApplication: JobApplication = {
      ...application,
      id: crypto.randomUUID(),
    }
    const applications = await jobApplicationsStorage.getAll()
    await jobApplicationsStorage.save([newApplication, ...applications])
    return newApplication
  },

  update: async (id: string, updates: Partial<JobApplication>): Promise<void> => {
    const applications = await jobApplicationsStorage.getAll()
    const updated = applications.map((app) =>
      app.id === id
        ? {
            ...app,
            ...updates,
            coverLetter: updates.coverLetter
              ? {
                  ...app.coverLetter,
                  ...updates.coverLetter,
                }
              : app.coverLetter,
            companyInfo: updates.companyInfo
              ? {
                  ...app.companyInfo,
                  ...updates.companyInfo,
                }
              : app.companyInfo,
            interviewPrep: updates.interviewPrep
              ? {
                  ...app.interviewPrep,
                  ...updates.interviewPrep,
                }
              : app.interviewPrep,
            contacts: updates.contacts !== undefined ? updates.contacts : app.contacts,
            uploadDetails: updates.uploadDetails
              ? {
                  ...app.uploadDetails,
                  ...updates.uploadDetails,
                  salaryGuidance: updates.uploadDetails.salaryGuidance
                    ? {
                        ...app.uploadDetails?.salaryGuidance,
                        ...updates.uploadDetails.salaryGuidance,
                      }
                    : app.uploadDetails?.salaryGuidance,
                }
              : app.uploadDetails,
            lastModified: Date.now(),
          }
        : app,
    )
    await jobApplicationsStorage.save(updated)
  },

  delete: async (id: string, folderId?: string): Promise<DeleteJobApplicationResult> => {
    const applications = await jobApplicationsStorage.getAll(folderId)
    const target = applications.find((app) => app.id === id)
    const deleteResult = await deleteJobApplicationById(id, {
      folderId,
      resumeVersionId: target?.resumeVersionId,
      company: target?.company,
      jobTitle: target?.jobTitle,
    })
    if (deleteResult.success) {
      await jobApplicationsStorage.save(
        applications.filter((app) => app.id !== id),
        folderId,
      )
    }
    return deleteResult
  },
}

// Folder storage functions
export const foldersStorage = {
  /** Lightweight list for the workspace picker (skips large profile_image blobs). */
  list: async (): Promise<Folder[]> => {
    if (typeof window === "undefined") return []

    if (shouldUseLocalFallback()) {
      return getLocalFoldersFallback()
    }

    let lastError: unknown

    try {
      console.log("[v0] Loading folder list via API...")
      const folders = preserveFolderListWhenEmpty(
        await fetchFoldersViaApi(),
        "Folder API",
      )
      console.log("[v0] Loaded", folders.length, "folders via API:", folders.map((f) => f.name).join(", "))
      writeFoldersCache(folders)
      writeLocalStore(LOCAL_STORE_KEYS.folders, folders)
      return folders
    } catch (apiError) {
      lastError = apiError
      markSupabaseOffline(apiError instanceof Error ? apiError.message : "Folder API failed")
      console.warn("[v0] Folder API load failed, trying Supabase directly:", describeSupabaseError(apiError))
    }

    try {
      return await withRetry(async () => {
        const supabase = getSupabaseClient()
        if (!supabase) return getLocalFoldersFallback()

        await ensureSupabaseAuthSession()

        console.log("[v0] Loading folder list from Supabase...")
        const { data, error } = await supabaseWithAbort(
          (signal) =>
            supabase
              .from("folders")
              .select("id, name, contact_info, created_at, updated_at")
              .order("created_at", { ascending: false })
              .abortSignal(signal),
          "Folder list query",
        )

        console.log("[v0] Folder list result - data:", data?.length, "folders, error:", error)

        if (error) {
          console.error("[v0] Supabase load error:", describeSupabaseError(error))
          throw error
        }

        const folders = preserveFolderListWhenEmpty(
          (data ?? []).map((row) => mapFolderRow(row as Record<string, unknown>, false)),
          "Folder list query",
        )
        console.log("[v0] Loaded", folders.length, "folders:", folders.map((f) => f.name).join(", "))
        writeFoldersCache(folders)
        writeLocalStore(LOCAL_STORE_KEYS.folders, folders)
        return folders
      }, 2)
    } catch (e) {
      console.error("[v0] Failed to load folder list:", describeSupabaseError(e ?? lastError))
      const fallback = getLocalFoldersFallback()
      if (fallback.length > 0) return fallback
      throw e ?? lastError
    }
  },

  getById: async (id: string): Promise<Folder | null> => {
    if (typeof window === "undefined") return null

    if (shouldUseLocalFallback()) {
      return getLocalFoldersFallback().find((f) => f.id === id) ?? null
    }

    try {
      return await withRetry(async () => {
        const supabase = getSupabaseClient()
        if (!supabase) return getLocalFoldersFallback().find((f) => f.id === id) ?? null

        await ensureSupabaseAuthSession()

        const { data, error } = await supabaseWithAbort(
          (signal) =>
            supabase
              .from("folders")
              .select("id, name, profile_image, contact_info, created_at, updated_at")
              .eq("id", id)
              .maybeSingle()
              .abortSignal(signal),
          "Folder getById query",
        )

        if (error) throw error
        if (!data) return null
        return mapFolderRow(data as Record<string, unknown>, true)
      })
    } catch (e) {
      console.error("[v0] Failed to load folder:", describeSupabaseError(e))
      return null
    }
  },

  getAll: async (): Promise<Folder[]> => {
    if (typeof window === "undefined") return []

    if (shouldUseLocalFallback()) {
      return getLocalFoldersFallback()
    }

    try {
      return await withRetry(async () => {
        const supabase = getSupabaseClient()
        if (!supabase) return getLocalFoldersFallback()

        await ensureSupabaseAuthSession()

        console.log("[v0] Loading folders from database...")
        const { data, error } = await supabaseWithAbort(
          (signal) =>
            supabase
              .from("folders")
              .select("*")
              .order("created_at", { ascending: false })
              .abortSignal(signal),
          "Folders query",
        )

        console.log("[v0] Folders query result - data:", data?.length, "folders, error:", error)

        if (error) {
          console.error("[v0] Supabase load error:", describeSupabaseError(error))
          throw error
        }

        const folders = preserveFolderListWhenEmpty(
          (data ?? []).map((row) => mapFolderRow(row as Record<string, unknown>, true)),
          "Folders query",
        )
        console.log("[v0] Loaded", folders.length, "folders from database:", folders.map((f) => f.name).join(", "))
        return folders
      })
    } catch (e) {
      console.error("[v0] Failed to load folders from database after retries:", describeSupabaseError(e))
      throw e
    }
  },

  save: async (folders: Folder[]): Promise<void> => {
    if (typeof window === "undefined") return

    writeFoldersCache(folders)
    writeLocalStore(LOCAL_STORE_KEYS.folders, folders)

    if (shouldUseLocalFallback()) return

    try {
      const supabase = getSupabaseClient()
      if (!supabase) return

      console.log("[v0] Saving", folders.length, "folders to database:", folders.map((f) => f.name).join(", "))
      console.log("[v0] Folder IDs being saved:", folders.map((f) => f.id).join(", "))

      if (folders.length > 0) {
        await ensureSupabaseAuthSession()
        const userId = await resolveRemoteUserId()
        const dbFolders = folders.map((f) => ({
          id: f.id,
          name: f.name,
          profile_image: f.profileImage || null,
          contact_info: f.contactInfo || null,
          user_id: userId,
          created_at: new Date(f.createdAt).toISOString(),
          updated_at: new Date(f.updatedAt).toISOString(),
        }))

        console.log("[v0] DB folders to upsert:", JSON.stringify(dbFolders, null, 2))

        const { data, error } = await supabase.from("folders").upsert(dbFolders, {
          onConflict: "id",
          ignoreDuplicates: false,
        }).select()

        if (error) {
          console.error("[v0] Failed to save folders to database:", describeSupabaseError(error))
        } else {
          console.log("[v0] Successfully saved folders to database, returned data:", JSON.stringify(data, null, 2))
        }
      }
    } catch (e) {
      console.error("[v0] Failed to save folders to database:", describeSupabaseError(e))
    }
  },

  create: async (
    name: string,
    profileImage: string | null = null,
    contactInfo?: Partial<Folder["contactInfo"]>
  ): Promise<Folder> => {
    const defaultContactInfo: Folder["contactInfo"] = {
      name: "",
      email: "",
      phone: "",
      address: "",
      linkedin: "",
      citizenship: "",
      portfolio: "",
      portfolios: [],
      professionalTitle: "",
      language: "en",
    }
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      profileImage,
      contactInfo: { ...defaultContactInfo, ...contactInfo },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const folders = await foldersStorage.getAll()
    await foldersStorage.save([newFolder, ...folders])
    return newFolder
  },

  update: async (
    id: string,
    updates: { name?: string; profileImage?: string | null; contactInfo?: Partial<Folder["contactInfo"]> }
  ): Promise<void> => {
    const folders = await foldersStorage.getAll()
    const updated = folders.map((f) => {
      if (f.id !== id) return f
      return {
        ...f,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.profileImage !== undefined && { profileImage: updates.profileImage }),
        ...(updates.contactInfo && { contactInfo: { ...f.contactInfo, ...updates.contactInfo } }),
        updatedAt: Date.now(),
      }
    })
    await foldersStorage.save(updated)
  },

  delete: async (id: string): Promise<void> => {
    const folders = await foldersStorage.getAll()
    await foldersStorage.save(folders.filter((f) => f.id !== id))
  },
}

async function fetchCoverLettersViaApi(folderId?: string): Promise<{
  letters: CoverLetter[]
  offline: boolean
  cloudCount?: number
}> {
  const params = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ""
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FOLDERS_QUERY_TIMEOUT_MS)
  try {
    const res = await fetch(`/api/workspace/cover-letters${params}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    })
    const body = (await res.json().catch(() => ({}))) as {
      letters?: CoverLetter[]
      offline?: boolean
      cloudCount?: number
    }
    if (!body.offline && Array.isArray(body.letters)) {
      return { letters: body.letters, offline: false, cloudCount: body.cloudCount }
    }
    return { letters: [], offline: true }
  } finally {
    clearTimeout(timeoutId)
  }
}

// Cover letter storage functions
export const coverLettersStorage = {
  getAll: async (folderId?: string): Promise<CoverLetter[]> => {
    if (typeof window === "undefined") return []

    if (shouldUseLocalFallback()) {
      const all = readLocalStore<CoverLetter>(LOCAL_STORE_KEYS.coverLetters)
      return folderId ? all.filter((l) => l.folderId === folderId) : all
    }

    try {
      const api = await fetchCoverLettersViaApi(folderId)
      if (!api.offline) {
        console.log(
          "[v0] Loaded",
          api.letters.length,
          "cover letters from database",
          api.cloudCount != null ? `(cloud: ${api.cloudCount})` : "",
        )
        return api.letters
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        const all = readLocalStore<CoverLetter>(LOCAL_STORE_KEYS.coverLetters)
        return folderId ? all.filter((l) => l.folderId === folderId) : all
      }

      await ensureSupabaseAuthSession()

      let query = supabase.from("cover_letters").select("*").order("created_at", { ascending: false })

      if (folderId) {
        query = query.eq("folder_id", folderId)
      }

      const { data, error } = await supabaseWithAbort(
        (signal) => query.abortSignal(signal),
        "Cover letters query",
      )

      if (error) {
        console.error("[v0] Supabase load error:", error)
        return []
      }

      const letters: CoverLetter[] =
        data?.map((row: any) => ({
          id: row.id,
          name: row.name,
          contentEn: row.content_en || "",
          contentDe: row.content_de || "",
          contactPersonName: row.contact_person_name || "",
          folderId: row.folder_id,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        })) || []

      console.log("[v0] Loaded", letters.length, "cover letters from database")
      return letters
    } catch (e) {
      console.error("[v0] Failed to load cover letters from database:", e)
      return []
    }
  },

  save: async (letters: CoverLetter[]): Promise<void> => {
    if (typeof window === "undefined") return

    if (shouldUseLocalFallback()) {
      writeLocalStore(LOCAL_STORE_KEYS.coverLetters, letters)
      return
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        writeLocalStore(LOCAL_STORE_KEYS.coverLetters, letters)
        return
      }

      if (letters.length > 0) {
        await ensureSupabaseAuthSession()
        const userId = await resolveRemoteUserId()
        const dbLetters = letters.map((l) => ({
          id: l.id,
          name: l.name,
          content_en: l.contentEn,
          content_de: l.contentDe,
          contact_person_name: l.contactPersonName,
          folder_id: l.folderId || null,
          user_id: userId,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
        }))

        const { error } = await supabase.from("cover_letters").upsert(dbLetters, {
          onConflict: "id",
        })
        if (error) {
          console.error("[v0] Failed to save cover letters to database:", error)
        } else {
          console.log("[v0] Saved", letters.length, "cover letters to database")
        }
      }
    } catch (e) {
      console.error("[v0] Failed to save cover letters to database:", e)
    }
  },

  create: async (name: string, folderId?: string): Promise<CoverLetter> => {
    const newLetter: CoverLetter = {
      id: crypto.randomUUID(),
      name,
      contentEn: "",
      contentDe: "",
      contactPersonName: "",
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const letters = await coverLettersStorage.getAll(folderId)
    await coverLettersStorage.save([newLetter, ...letters])
    return newLetter
  },

  update: async (id: string, updates: Partial<CoverLetter>): Promise<void> => {
    const letters = await coverLettersStorage.getAll()
    const updated = letters.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l))
    await coverLettersStorage.save(updated)
  },

  delete: async (id: string): Promise<void> => {
    const letters = await coverLettersStorage.getAll()
    await coverLettersStorage.save(letters.filter((l) => l.id !== id))
  },
}

async function fetchCoverLettersByIds(ids: string[]): Promise<CoverLetter[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  if (shouldUseLocalFallback()) {
    const all = readLocalStore<CoverLetter>(LOCAL_STORE_KEYS.coverLetters)
    return unique
      .map((id) => all.find((letter) => letter.id === id))
      .filter((letter): letter is CoverLetter => Boolean(letter))
  }

  try {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    await ensureSupabaseAuthSession()
    const { data, error } = await supabaseWithAbort(
      (signal) =>
        supabase.from("cover_letters").select("*").in("id", unique).abortSignal(signal),
      "Cover letters by id query",
    )
    if (error) {
      console.error("[v0] Cover letter fetch by id error:", error)
      return []
    }

    return (
      data?.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        contentEn: String(row.content_en ?? ""),
        contentDe: String(row.content_de ?? ""),
        contactPersonName: String(row.contact_person_name ?? ""),
        folderId: row.folder_id ? String(row.folder_id) : undefined,
        createdAt: new Date(String(row.created_at)).getTime(),
        updatedAt: new Date(String(row.updated_at ?? row.created_at)).getTime(),
      })) ?? []
    )
  } catch (e) {
    console.error("[v0] Cover letter fetch by id failed:", e)
    return []
  }
}

function embeddedCoverLetterId(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const id = (value as { id?: unknown }).id
  return typeof id === "string" ? id.trim() : ""
}

/** Folder-scoped cover letters plus name-pattern matches for linked CVs (any folder). */
export async function loadCoverLettersForWorkspace(
  folderId: string,
  applications: JobApplication[],
  resumes: ResumeVersion[] = [],
): Promise<CoverLetter[]> {
  const allLetters = await coverLettersStorage.getAll()
  const byId = new Map(allLetters.map((letter) => [letter.id, letter]))

  const linkedResumeIds = new Set(
    applications.map((app) => app.resumeVersionId?.trim()).filter(Boolean) as string[],
  )
  const relevantResumes = resumes.filter(
    (resume) =>
      linkedResumeIds.has(resume.id) ||
      applications.some((app) => app.id === resume.applicationId),
  )
  const patternNames = new Set(
    relevantResumes
      .map((resume) => resume.name?.trim())
      .filter(Boolean)
      .map((name) => `Cover Letter - ${name}`),
  )

  const embeddedLetterIds = new Set<string>()
  for (const app of applications) {
    const fromJob = embeddedCoverLetterId(app.coverLetter)
    if (fromJob) embeddedLetterIds.add(fromJob)
    const resumeId = app.resumeVersionId?.trim()
    const resume = resumeId ? resumes.find((row) => row.id === resumeId) : undefined
    const fromResume = embeddedCoverLetterId(resume?.coverLetter)
    if (fromResume) embeddedLetterIds.add(fromResume)
  }

  const explicitLinkedIds = new Set(
    applications.map((app) => app.coverLetterId?.trim()).filter(Boolean) as string[],
  )

  const relevant = allLetters.filter(
    (letter) =>
      letter.folderId === folderId ||
      explicitLinkedIds.has(letter.id) ||
      embeddedLetterIds.has(letter.id) ||
      patternNames.has(letter.name),
  )

  const outsideFolder = relevant.filter((letter) => letter.folderId !== folderId).length
  if (outsideFolder > 0) {
    console.info(
      `[workspace] Loaded ${outsideFolder} cover letter(s) matched by name or link outside folder ${folderId.slice(0, 8)}…`,
    )
  }

  const missingIds = [...explicitLinkedIds, ...embeddedLetterIds].filter((id) => !byId.has(id))
  if (missingIds.length > 0) {
    const linkedExtra = await fetchCoverLettersByIds(missingIds)
    for (const letter of linkedExtra) {
      byId.set(letter.id, letter)
      if (!relevant.some((row) => row.id === letter.id)) {
        relevant.push(letter)
      }
    }
  }

  return relevant.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const loadCoverLetters = async (folderId?: string): Promise<CoverLetter[]> => {
  return await coverLettersStorage.getAll(folderId)
}

export const saveCoverLetters = async (letters: CoverLetter[]): Promise<void> => {
  await coverLettersStorage.save(letters)
}

export const saveFolders = async (folders: Folder[]): Promise<void> => {
  await foldersStorage.save(folders)
}
