import { normalizeContactInfo } from "./contact-info"
import { getHiringManagerName, hiringManagerFields } from "./resume-cover-letter"
import {
  clearAllCvLocalStorage,
  clearLocalSavedResumeVersions,
  STORAGE_FULL_MESSAGE,
  expandCompactResume,
  migrateLocalResumeStorageIfNeeded,
  mergeResumesWithDraft,
  readResumeDraftAsVersion,
  readResumeSnapshotsForFolder,
  readResumeSnapshotsLocal,
  removeResumeFromLocalStores,
  saveResumeDraftLocal,
  saveResumeSnapshotLocal,
  upsertResumeSnapshotsFromCloud,
  writeResumeSnapshotsForFolder,
} from "./resume-local-storage"
import { normalizeResumeVersionHistory } from "./resume-version-history"
import { resolveResumeForJob } from "./resolve-application-resume"
import type { JobApplication, ResumeEmbeddedCoverLetter, ResumeVersion } from "./types"
import { getSupabaseClient } from "./supabase/client"
import {
  ensureSupabaseAuthSession,
  getAuthenticatedSupabaseUserId,
} from "./supabase/app-auth"
import {
  shouldUseLocalFallback,
  markSupabaseOffline,
  refreshSupabaseReachability,
  describeSupabaseSyncBlocker,
} from "./supabase/availability"
import { getSupabaseEnv } from "./supabase/config"
import {
  formatSupabaseErrorMessage,
  parsePgrst204MissingColumn,
  serializeSupabaseError,
} from "./supabase/errors"
import { supabaseWithAbort } from "./supabase/request"
import { SUPABASE_REQUEST_TIMEOUT_MS } from "./supabase/config"

type ResumeVersionsApiResponse = {
  versions?: ResumeVersion[]
  offline?: boolean
  error?: string
  hint?: string
  code?: string
  cloudCount?: number
  withTextCount?: number
}

async function fetchResumeVersionsViaApi(options?: {
  folderId?: string
  ids?: string[]
  applicationIds?: string[]
}): Promise<ResumeVersionsApiResponse> {
  if (typeof window === "undefined") return { offline: true, versions: [] }

  const params = new URLSearchParams()
  if (options?.folderId) params.set("folderId", options.folderId)
  if (options?.ids?.length) params.set("ids", options.ids.join(","))
  if (options?.applicationIds?.length) {
    params.set("applicationIds", options.applicationIds.join(","))
  }
  const query = params.toString()
  const url = query
    ? `/api/workspace/resume-versions?${query}`
    : "/api/workspace/resume-versions"

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    })
    return (await res.json().catch(() => ({}))) as ResumeVersionsApiResponse
  } finally {
    clearTimeout(timeoutId)
  }
}

async function loadRemoteResumeVersions(options?: {
  folderId?: string
  ids?: string[]
  applicationIds?: string[]
}): Promise<ResumeVersion[]> {
  const api = await fetchResumeVersionsViaApi(options)
  if (!api.offline && Array.isArray(api.versions)) {
    if (api.cloudCount != null) {
      console.info(
        `[workspace] Cloud resume versions: ${api.cloudCount} (${api.withTextCount ?? "?"} with CV text)`,
      )
    }
    return api.versions
  }

  if (api.code === "SUPABASE_SERVER_AUTH_MISSING" || api.code === "SUPABASE_SERVER_AUTH_FAILED") {
    console.warn("[resume] Cloud resume versions unavailable:", api.error, api.hint ?? "")
  }

  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    await ensureSupabaseAuthSession()
    let query = supabase.from("resume_versions").select("*").order("created_at", { ascending: false })
    if (options?.folderId) query = query.eq("folder_id", options.folderId)
    if (options?.ids?.length) query = query.in("id", options.ids)
    if (options?.applicationIds?.length) {
      query = query.in("application_id", options.applicationIds)
    }
    const { data, error } = await supabaseWithAbort(
      (signal) => query.abortSignal(signal),
      "Resume versions query",
    )
    if (error) {
      console.error(
        "[resume] client fallback load error:",
        formatSupabaseErrorMessage(error),
        serializeSupabaseError(error),
      )
      return []
    }
    return (data ?? []).map((row) => mapResumeVersionRow(row as Record<string, unknown>))
  } catch (e) {
    console.error(
      "[resume] client fallback load failed:",
      formatSupabaseErrorMessage(e),
      serializeSupabaseError(e),
    )
    return []
  }
}

export { clearLocalSavedResumeVersions, clearAllCvLocalStorage }

/** Normalize legacy rows and ensure stable timestamps for persistence. */
function parseEmbeddedCoverLetter(raw: unknown): ResumeEmbeddedCoverLetter | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.name !== "string") return null
  const createdAt = typeof c.createdAt === "number" ? c.createdAt : Date.now()
  const updatedAt = typeof c.updatedAt === "number" ? c.updatedAt : createdAt
  const manager = getHiringManagerName(
    c as Partial<Pick<ResumeEmbeddedCoverLetter, "contactPersonName" | "hiringManager">>,
  )
  return {
    id: c.id,
    name: c.name,
    contentEn: (c.contentEn as string) || "",
    contentDe: (c.contentDe as string) || "",
    ...hiringManagerFields(manager),
    recipientCompany: typeof c.recipientCompany === "string" ? c.recipientCompany : "",
    profileImage: stripImageForRemote(
      typeof c.profileImage === "string" ? c.profileImage : null,
    ),
    companyLogo: stripImageForRemote(typeof c.companyLogo === "string" ? c.companyLogo : null),
    applicantName: typeof c.applicantName === "string" ? c.applicantName : "",
    applicantAddress: typeof c.applicantAddress === "string" ? c.applicantAddress : "",
    applicantEmail: typeof c.applicantEmail === "string" ? c.applicantEmail : "",
    applicantPhone: typeof c.applicantPhone === "string" ? c.applicantPhone : "",
    letterDate: typeof c.letterDate === "string" ? c.letterDate : "",
    createdAt,
    updatedAt,
  }
}

export function normalizeResumeVersion(v: ResumeVersion): ResumeVersion {
  const createdAt = v.createdAt ?? v.timestamp ?? Date.now()
  const updatedAt = v.updatedAt ?? v.timestamp ?? createdAt
  const rawContact = v.contactInfo ?? (v as { contact_info?: unknown }).contact_info
  const rawHistory =
    v.versionHistory ??
    (v as { version_history?: ResumeVersion["versionHistory"] }).version_history
  return normalizeResumeVersionHistory({
    ...v,
    timestamp: v.timestamp ?? createdAt,
    createdAt,
    updatedAt,
    contactInfo: normalizeContactInfo(
      rawContact as ResumeVersion["contactInfo"] | Record<string, unknown> | null,
    ),
    coverLetter: v.coverLetter ?? null,
    versionHistory: rawHistory,
    applicationId: v.applicationId ?? (v as { application_id?: string }).application_id,
  })
}

function readAllResumesLocal(folderId?: string): ResumeVersion[] {
  if (folderId !== undefined) {
    return readResumeSnapshotsForFolder(folderId)
  }
  return readResumeSnapshotsLocal()
    .map(expandCompactResume)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

function mergeResumeLists(
  primary: ResumeVersion[],
  secondary: ResumeVersion[],
  folderId?: string,
): ResumeVersion[] {
  const draft = readResumeDraftAsVersion()
  const draftApplies =
    Boolean(draft) &&
    (folderId === undefined || (draft!.folderId ?? "") === (folderId ?? ""))
  return mergeResumesWithDraft(primary, secondary, draftApplies ? draft : null)
}

/** Base64 JPEG logos/photos are stored in text columns — allow compact data URLs. */
const MAX_REMOTE_IMAGE_DATA_URL_LEN = 120_000
const MAX_REMOTE_JOB_DESCRIPTION_LEN = 100_000

function stripImageForRemote(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_REMOTE_IMAGE_DATA_URL_LEN) {
    console.warn(
      `[resume] Image omitted from save (${Math.round(trimmed.length / 1024)}KB) — compress or use a smaller file`,
    )
    return null
  }
  return trimmed
}

function serializeCoverLetterForRemote(
  cl: ResumeEmbeddedCoverLetter | null | undefined,
): ResumeEmbeddedCoverLetter | null {
  if (!cl) return null
  const manager = getHiringManagerName(cl)
  return {
    id: String(cl.id),
    name: String(cl.name || "Cover letter"),
    contentEn: typeof cl.contentEn === "string" ? cl.contentEn : "",
    contentDe: typeof cl.contentDe === "string" ? cl.contentDe : "",
    ...hiringManagerFields(manager),
    recipientCompany: typeof cl.recipientCompany === "string" ? cl.recipientCompany : "",
    profileImage: stripImageForRemote(cl.profileImage),
    companyLogo: stripImageForRemote(cl.companyLogo),
    applicantName: typeof cl.applicantName === "string" ? cl.applicantName : "",
    applicantAddress: typeof cl.applicantAddress === "string" ? cl.applicantAddress : "",
    applicantEmail: typeof cl.applicantEmail === "string" ? cl.applicantEmail : "",
    applicantPhone: typeof cl.applicantPhone === "string" ? cl.applicantPhone : "",
    letterDate: typeof cl.letterDate === "string" ? cl.letterDate : "",
    createdAt: typeof cl.createdAt === "number" ? cl.createdAt : Date.now(),
    updatedAt: typeof cl.updatedAt === "number" ? cl.updatedAt : Date.now(),
  }
}

/** Serializable resume for Supabase upsert (no blobs, stable ids/dates). */
export function normalizeResumeForRemoteSave(resume: ResumeVersion): ResumeVersion {
  const base = normalizeResumeVersion(resume)
  const createdAt = base.createdAt ?? Date.now()
  const updatedAt = Date.now()
  const jobDescription = base.jobDescription
    ? base.jobDescription.slice(0, MAX_REMOTE_JOB_DESCRIPTION_LEN)
    : undefined

  return {
    ...base,
    id: ensureResumeId(base.id),
    name: (base.name || "Untitled Resume").trim() || "Untitled Resume",
    resumeText: typeof base.resumeText === "string" ? base.resumeText : "",
    jobDescription,
    profileImage: stripImageForRemote(base.profileImage),
    companyLogo: stripImageForRemote(base.companyLogo),
    contactInfo: normalizeContactInfo(base.contactInfo),
    coverLetter: serializeCoverLetterForRemote(base.coverLetter),
    folderId: base.folderId || undefined,
    createdAt,
    updatedAt,
    timestamp: base.timestamp ?? createdAt,
  }
}

function resumeToDbRow(
  v: ResumeVersion,
  createdAtIso: string,
  updatedAtIso: string,
  userId?: string | null,
) {
  const remote = normalizeResumeForRemoteSave(v)
  const sanitizedContactInfo = normalizeContactInfo(remote.contactInfo)

  return {
    id: remote.id,
    name: remote.name || "Untitled Resume",
    resume_text: remote.resumeText || "",
    profile_image: remote.profileImage || null,
    company_logo: remote.companyLogo || null,
    contact_info: sanitizedContactInfo,
    accent_color: remote.accentColor || remote.accentColorHex || null,
    job_description: remote.jobDescription || null,
    folder_id: remote.folderId || null,
    profile_photo_border: remote.profilePhotoBorder !== false,
    target_box_bg_color: remote.targetBoxBgColor || null,
    target_box_border_color: remote.targetBoxBorderColor || null,
    resume_cover_letter: remote.coverLetter ?? null,
    version_history: remote.versionHistory?.length ? remote.versionHistory : null,
    application_id: remote.applicationId?.trim() || null,
    user_id: userId ?? null,
    created_at: createdAtIso,
    updated_at: updatedAtIso,
  }
}

type ResumeDbRow = ReturnType<typeof resumeToDbRow>

async function upsertResumeRowWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  row: ResumeDbRow,
): Promise<{ error: unknown; status?: number; statusText?: string }> {
  let attemptRow: Record<string, unknown> = { ...row }
  const omittedColumns: string[] = []

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await supabase
      .from("resume_versions")
      .upsert([attemptRow], { onConflict: "id" })

    const { error, status, statusText } = response as {
      error: unknown
      status?: number
      statusText?: string
    }

    if (!error) {
      if (omittedColumns.length > 0) {
        console.warn(
          `[resume] Cloud sync succeeded after omitting columns missing from Supabase schema: ${omittedColumns.join(", ")}. Run scripts/apply-missing-supabase-schema.sql in the Supabase SQL editor.`,
        )
      }
      return { error: null, status, statusText }
    }

    const missingColumn = parsePgrst204MissingColumn(error)
    if (!missingColumn || !(missingColumn in attemptRow)) {
      return { error, status, statusText }
    }

    const { [missingColumn]: _removed, ...rest } = attemptRow
    attemptRow = rest
    omittedColumns.push(missingColumn)
    console.warn(`[resume] Retrying cloud sync without missing column: ${missingColumn}`)
  }

  return {
    error: new Error(
      `Cloud sync failed after omitting columns: ${omittedColumns.join(", ")}`,
    ),
  }
}

function describeRemotePayloadShape(row: ResumeDbRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    folder_id: row.folder_id ?? null,
    resumeTextLength: row.resume_text?.length ?? 0,
    jobDescriptionLength: row.job_description?.length ?? 0,
    hasProfileImage: Boolean(row.profile_image),
    hasCompanyLogo: Boolean(row.company_logo),
    profileImageKind: row.profile_image?.startsWith("data:")
      ? "data-url"
      : row.profile_image
        ? "url"
        : "none",
    contactInfoKeys: row.contact_info ? Object.keys(row.contact_info) : [],
    hasCoverLetter: Boolean(row.resume_cover_letter),
    accent_color: row.accent_color ?? null,
  }
}

function logRemoteSaveFailure(
  context: string,
  error: unknown,
  extra: Record<string, unknown>,
): string {
  const serialized = serializeSupabaseError(error)
  const message = formatSupabaseErrorMessage(error)
  console.warn(`[resume] Remote sync failed (${context}), local save preserved`, {
    message,
    error: serialized,
    ...extra,
  })
  return message
}

export function mapResumeVersionRow(row: Record<string, unknown>): ResumeVersion {
  const createdAt = new Date(row.created_at as string).getTime()
  const updatedAt = new Date((row.updated_at as string) || (row.created_at as string)).getTime()
  return normalizeResumeVersion({
    id: row.id as string,
    name: row.name as string,
    resumeText: (row.resume_text as string) || "",
    profileImage: (row.profile_image as string | null) || null,
    companyLogo: (row.company_logo as string | null) || null,
    timestamp: createdAt,
    createdAt,
    updatedAt,
    contactInfo: normalizeContactInfo(
      row.contact_info as ResumeVersion["contactInfo"] | Record<string, unknown> | null,
    ),
    accentColor: row.accent_color as string | undefined,
    accentColorHex: row.accent_color as string | undefined,
    jobDescription: (row.job_description as string) || undefined,
    folderId: (row.folder_id as string) || undefined,
    profilePhotoBorder: row.profile_photo_border !== false,
    targetBoxBgColor: (row.target_box_bg_color as string) || "#f8f9fa",
    targetBoxBorderColor: (row.target_box_border_color as string) || "",
    coverLetter: parseEmbeddedCoverLetter(row.resume_cover_letter),
    versionHistory: Array.isArray(row.version_history)
      ? (row.version_history as ResumeVersion["versionHistory"])
      : undefined,
    applicationId: (row.application_id as string) || undefined,
  })
}

async function ensureRemoteSyncAvailable(): Promise<{ ok: true } | { ok: false; remoteError: string }> {
  await refreshSupabaseReachability()
  if (!shouldUseLocalFallback()) return { ok: true }
  return { ok: false, remoteError: describeSupabaseSyncBlocker() }
}

async function syncResumeRemote(resume: ResumeVersion): Promise<{
  remoteSynced: boolean
  remoteError?: string
}> {
  const gate = await ensureRemoteSyncAvailable()
  if (!gate.ok) {
    return { remoteSynced: false, remoteError: gate.remoteError }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return { remoteSynced: false, remoteError: "Supabase client is not available." }
  }

  await ensureSupabaseAuthSession()
  const userId = await getAuthenticatedSupabaseUserId()

  const remoteReady = normalizeResumeForRemoteSave(resume)
  const createdAtIso = new Date(remoteReady.createdAt ?? Date.now()).toISOString()
  const updatedAtIso = new Date(remoteReady.updatedAt ?? Date.now()).toISOString()
  const row = resumeToDbRow(remoteReady, createdAtIso, updatedAtIso, userId)
  const table = "resume_versions"
  const env = getSupabaseEnv()
  const requestUrl = env ? `${env.url.replace(/\/$/, "")}/rest/v1/${table}` : "(supabase url not configured)"

  let bodyPreview = ""
  try {
    bodyPreview = JSON.stringify([row])
  } catch (serializeErr) {
    const msg = logRemoteSaveFailure("payload-serialize", serializeErr, {
      requestUrl,
      method: "POST",
      table,
      payloadShape: { id: row.id, keys: Object.keys(row) },
    })
    return { remoteSynced: false, remoteError: msg }
  }

  try {
    const { error, status, statusText } = await upsertResumeRowWithSchemaFallback(
      supabase,
      row,
    )

    if (error) {
      const msg = logRemoteSaveFailure("upsert", error, {
        requestUrl,
        method: "POST",
        httpStatus: status,
        httpStatusText: statusText,
        resumeId: remoteReady.id,
        payloadShape: describeRemotePayloadShape(row),
        bodyBytes: bodyPreview.length,
      })
      markSupabaseOffline(msg)
      return { remoteSynced: false, remoteError: msg }
    }

    return { remoteSynced: true }
  } catch (e) {
    const msg = logRemoteSaveFailure("upsert-throw", e, {
      requestUrl,
      method: "POST",
      resumeId: remoteReady.id,
      payloadShape: describeRemotePayloadShape(row),
      bodyBytes: bodyPreview.length,
    })
    markSupabaseOffline(msg)
    return { remoteSynced: false, remoteError: msg }
  }
}

function mergeResumeVersionsById(...lists: ResumeVersion[][]): ResumeVersion[] {
  const byId = new Map<string, ResumeVersion>()
  for (const list of lists) {
    for (const resume of list) {
      byId.set(resume.id, resume)
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Fetch resume rows by primary key (ignores folder scope). */
export async function fetchResumeVersionsByIds(ids: string[]): Promise<ResumeVersion[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  if (shouldUseLocalFallback()) {
    const all = readAllResumesLocal()
    return unique
      .map((id) => all.find((resume) => resume.id === id))
      .filter((resume): resume is ResumeVersion => Boolean(resume))
  }

  if (typeof window !== "undefined") {
    return loadRemoteResumeVersions({ ids: unique })
  }

  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    await ensureSupabaseAuthSession()
    const { data, error } = await supabaseWithAbort(
      (signal) =>
        supabase.from("resume_versions").select("*").in("id", unique).abortSignal(signal),
      "Resume versions by id query",
    )
    if (error) {
      console.error(
        "[resume] fetch by id error:",
        formatSupabaseErrorMessage(error),
        serializeSupabaseError(error),
      )
      return []
    }
    return (data ?? []).map((row) => mapResumeVersionRow(row as Record<string, unknown>))
  } catch (e) {
    console.error(
      "[resume] fetch by id failed:",
      formatSupabaseErrorMessage(e),
      serializeSupabaseError(e),
    )
    return []
  }
}

/** Fetch resume rows owned by applications via application_id (ignores folder scope). */
export async function fetchResumeVersionsByApplicationIds(
  applicationIds: string[],
): Promise<ResumeVersion[]> {
  const unique = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  if (shouldUseLocalFallback()) {
    const all = readAllResumesLocal()
    return all.filter(
      (resume) =>
        resume.applicationId &&
        unique.includes(resume.applicationId.trim()) &&
        Boolean(resume.resumeText?.trim()),
    )
  }

  if (typeof window !== "undefined") {
    return loadRemoteResumeVersions({ applicationIds: unique })
  }

  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    await ensureSupabaseAuthSession()
    const { data, error } = await supabaseWithAbort(
      (signal) =>
        supabase
          .from("resume_versions")
          .select("*")
          .in("application_id", unique)
          .abortSignal(signal),
      "Resume versions by application_id query",
    )
    if (error) {
      console.error(
        "[resume] fetch by application_id error:",
        formatSupabaseErrorMessage(error),
        serializeSupabaseError(error),
      )
      return []
    }
    return (data ?? []).map((row) => mapResumeVersionRow(row as Record<string, unknown>))
  } catch (e) {
    console.error(
      "[resume] fetch by application_id failed:",
      formatSupabaseErrorMessage(e),
      serializeSupabaseError(e),
    )
    return []
  }
}

/** All CVs for the signed-in account (every folder). Used to resolve application links. */
export async function loadAllResumesForAccount(): Promise<ResumeVersion[]> {
  if (typeof window === "undefined") return []

  migrateLocalResumeStorageIfNeeded()
  const localAll = readAllResumesLocal()

  if (shouldUseLocalFallback()) {
    return localAll.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  try {
    const remote = await loadRemoteResumeVersions()
    if (remote.length > 0) {
      return mergeResumeLists(remote, localAll, undefined)
    }
  } catch (e) {
    console.error(
      "[resume] load all via API failed:",
      formatSupabaseErrorMessage(e),
      serializeSupabaseError(e),
    )
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return localAll.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  try {
    await ensureSupabaseAuthSession()
    const { data, error } = await supabaseWithAbort(
      (signal) =>
        supabase
          .from("resume_versions")
          .select("*")
          .order("created_at", { ascending: false })
          .abortSignal(signal),
      "Resume versions (all) query",
    )
    if (error) {
      console.error(
        "[resume] load all error:",
        formatSupabaseErrorMessage(error),
        serializeSupabaseError(error),
      )
      return localAll.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const remote = (data ?? []).map((row) => mapResumeVersionRow(row as Record<string, unknown>))
    return mergeResumeLists(remote, localAll, undefined)
  } catch (e) {
    console.error(
      "[resume] load all failed:",
      formatSupabaseErrorMessage(e),
      serializeSupabaseError(e),
    )
    markSupabaseOffline(e instanceof Error ? e.message : "loadAllResumesForAccount failed")
    return localAll.sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

/**
 * All account CVs plus any still needed to resolve application rows (by resumeVersionId
 * or application_id), even when stored under a different folder_id.
 */
export async function loadResumesForWorkspace(
  folderId: string,
  applications: JobApplication[],
): Promise<ResumeVersion[]> {
  const allAccount = await loadAllResumesForAccount()

  const linkedResumeIds = [
    ...new Set(
      applications
        .map((app) => app.resumeVersionId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ].filter((id) => !allAccount.some((resume) => resume.id === id))

  const applicationIdsForFetch = applications
    .filter((app) => !resolveResumeForJob(app, allAccount))
    .map((app) => app.id)

  const [linkedExtra, ownedExtra] = await Promise.all([
    linkedResumeIds.length > 0
      ? fetchResumeVersionsByIds(linkedResumeIds)
      : Promise.resolve([]),
    applicationIdsForFetch.length > 0
      ? fetchResumeVersionsByApplicationIds(applicationIdsForFetch)
      : Promise.resolve([]),
  ])

  const merged = mergeResumeVersionsById(allAccount, linkedExtra, ownedExtra)

  const extraCount = linkedExtra.length + ownedExtra.length
  if (extraCount > 0) {
    console.info(
      `[workspace] Loaded ${extraCount} linked resume(s) outside folder ${folderId.slice(0, 8)}…`,
    )
  }

  const orphaned = applications.filter((app) => {
    const resumeId = app.resumeVersionId?.trim()
    return Boolean(resumeId) && !resolveResumeForJob(app, merged)
  })
  if (orphaned.length > 0) {
    console.warn(
      `[workspace] ${orphaned.length} application(s) reference a resume_version_id that is missing or has no CV text`,
      orphaned.slice(0, 5).map((app) => ({
        applicationId: app.id.slice(0, 8),
        resumeVersionId: app.resumeVersionId?.slice(0, 8),
        company: app.company?.slice(0, 40),
      })),
    )
  }

  return merged
}

/** After a successful cloud workspace load, replace stale empty local resume shells. */
export function cacheResumeVersionsFromCloud(resumes: ResumeVersion[]): void {
  if (typeof window === "undefined") return
  const result = upsertResumeSnapshotsFromCloud(resumes.map(normalizeResumeVersion))
  if (!result.ok) {
    console.warn("[resume] Could not refresh local resume cache from cloud:", result.warning)
  }
}

/** Load all resumes for a workspace folder (remote + local, merged by id). */
export async function loadResumes(folderId?: string): Promise<ResumeVersion[]> {
  if (typeof window === "undefined") return []

  migrateLocalResumeStorageIfNeeded()
  const localForFolder = readAllResumesLocal(folderId)

  if (shouldUseLocalFallback()) {
    return localForFolder.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return localForFolder.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  try {
    await ensureSupabaseAuthSession()

    let query = supabase.from("resume_versions").select("*").order("created_at", { ascending: false })
    if (folderId) {
      query = query.eq("folder_id", folderId)
    }
    const { data, error } = await supabaseWithAbort(
      (signal) => query.abortSignal(signal),
      "Resume versions query",
    )
    if (error) {
      console.error("[resume] load error:", formatSupabaseErrorMessage(error), serializeSupabaseError(error))
      return localForFolder.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const remote = (data ?? []).map((row) => mapResumeVersionRow(row as Record<string, unknown>))
    return mergeResumeLists(remote, localForFolder, folderId).filter((r) =>
      folderId ? r.folderId === folderId : !r.folderId,
    )
  } catch (e) {
    console.error("[resume] load failed:", formatSupabaseErrorMessage(e), serializeSupabaseError(e))
    markSupabaseOffline(e instanceof Error ? e.message : "loadResumes failed")
    return localForFolder.sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

export type SaveResumeResult = {
  id: string
  localSaved: boolean
  remoteSynced: boolean
  remoteError?: string
  localWarning?: string
}

function localFailureMessage(result: { ok: boolean; warning?: string }): string {
  return result.warning ?? STORAGE_FULL_MESSAGE
}

/** Autosave: local draft first, then best-effort remote sync (remote failure never throws). */
export async function saveResumeDraft(resume: ResumeVersion): Promise<SaveResumeResult> {
  if (typeof window === "undefined") {
    return { id: resume.id, localSaved: false, remoteSynced: false }
  }

  const normalized = normalizeResumeForRemoteSave(
    normalizeResumeVersion({
      ...resume,
      updatedAt: Date.now(),
    }),
  )

  const localResult = saveResumeDraftLocal(normalized)

  if (!localResult.ok) {
    const localMsg = localFailureMessage(localResult)
    console.error("[resume] Draft local save failed:", localMsg)
    throw new Error(localMsg)
  }

  if (localResult.warning) {
    console.warn("[resume] Draft save warning:", localResult.warning)
  } else {
    console.log("[resume] Draft saved locally:", normalized.id, normalized.name)
  }

  const remote = await syncResumeRemote(normalized)

  if (!remote.remoteSynced && remote.remoteError) {
    console.warn("[resume] Remote sync failed, local draft preserved:", remote.remoteError)
  }

  return {
    id: normalized.id,
    localSaved: true,
    remoteSynced: remote.remoteSynced,
    remoteError: remote.remoteError,
    localWarning: localResult.warning,
  }
}

/** Manual save: local snapshot first, then best-effort remote sync. */
export async function saveResume(resume: ResumeVersion): Promise<SaveResumeResult> {
  if (typeof window === "undefined") {
    return { id: resume.id, localSaved: false, remoteSynced: false }
  }

  const normalized = normalizeResumeForRemoteSave(
    normalizeResumeVersion({
      ...resume,
      updatedAt: Date.now(),
    }),
  )

  const localResult = saveResumeSnapshotLocal(normalized)

  if (!localResult.ok) {
    const localMsg = localFailureMessage(localResult)
    console.error("[resume] Local snapshot save failed:", localMsg)
    throw new Error(localMsg)
  }

  if (localResult.warning) {
    console.warn("[resume] Local save warning:", localResult.warning)
  } else {
    console.log("[resume] Saved to local storage:", normalized.id, normalized.name)
  }

  const remote = await syncResumeRemote(normalized)

  if (!remote.remoteSynced && remote.remoteError) {
    console.warn("[resume] Remote sync failed, local snapshot preserved:", remote.remoteError)
  }

  return {
    id: normalized.id,
    localSaved: true,
    remoteSynced: remote.remoteSynced,
    remoteError: remote.remoteError,
    localWarning: localResult.warning,
  }
}

/** Replace all resumes for one folder in storage (keeps other folders intact). */
export async function saveResumes(versions: ResumeVersion[], folderId?: string): Promise<{
  count: number
  localSaved: boolean
  remoteSynced: boolean
  remoteError?: string
}> {
  if (typeof window === "undefined") {
    return { count: 0, localSaved: false, remoteSynced: false }
  }

  const normalized = versions.map((v) =>
    normalizeResumeVersion({
      ...v,
      folderId: folderId ?? v.folderId,
      updatedAt: Date.now(),
    }),
  )

  const localResult = writeResumeSnapshotsForFolder(folderId, normalized)
  if (!localResult.ok) {
    throw new Error(localResult.warning ?? "Could not save resumes locally.")
  }

  if (shouldUseLocalFallback()) {
    await refreshSupabaseReachability()
  }
  if (shouldUseLocalFallback()) {
    return {
      count: normalized.length,
      localSaved: true,
      remoteSynced: false,
      remoteError: describeSupabaseSyncBlocker(),
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      count: normalized.length,
      localSaved: true,
      remoteSynced: false,
      remoteError: "Supabase client is not available.",
    }
  }

  if (normalized.length === 0) {
    return { count: 0, localSaved: true, remoteSynced: true }
  }

  try {
    await ensureSupabaseAuthSession()
    const userId = await getAuthenticatedSupabaseUserId()
    if (!userId) {
      console.warn("[resume] saveResumes skipped cloud sync — Supabase auth user id unavailable")
      return {
        count: normalized.length,
        localSaved: true,
        remoteSynced: false,
        remoteError: "Supabase auth session has no user id — resumes saved locally only.",
      }
    }
    const rows = normalized.map((v) =>
      resumeToDbRow(
        v,
        new Date(v.createdAt).toISOString(),
        new Date(v.updatedAt).toISOString(),
        userId,
      ),
    )
    const { error } = await supabase.from("resume_versions").upsert(rows, { onConflict: "id" })
    if (error) throw error
    return { count: normalized.length, localSaved: true, remoteSynced: true }
  } catch (e) {
    const message = formatSupabaseErrorMessage(e)
    console.error("[resume] saveResumes failed:", message, serializeSupabaseError(e))
    if (/42501|row-level security/i.test(message)) {
      console.warn(
        "[resume] RLS blocked resume sync — existing cloud rows may belong to an old Supabase Auth user. Run scripts/014_reassign_data_to_new_auth_user.sql in Supabase (include resume_versions).",
      )
    }
    return {
      count: normalized.length,
      localSaved: true,
      remoteSynced: false,
      remoteError: message,
    }
  }
}

export async function deleteResume(id: string, folderId?: string): Promise<void> {
  if (typeof window === "undefined") return

  removeResumeFromLocalStores(id)

  if (shouldUseLocalFallback()) return

  const supabase = getSupabaseClient()
  if (!supabase) return

  try {
    let query = supabase.from("resume_versions").delete().eq("id", id)
    if (folderId) query = query.eq("folder_id", folderId)
    await query
  } catch (e) {
    console.error("[resume] delete failed:", formatSupabaseErrorMessage(e), serializeSupabaseError(e))
  }
}

export function createNewResumeId(): string {
  return crypto.randomUUID()
}

/** Re-attempt Supabase sync for a resume that was saved locally only. */
export async function retryResumeRemoteSync(
  resume: ResumeVersion,
): Promise<Pick<SaveResumeResult, "remoteSynced" | "remoteError">> {
  const normalized = normalizeResumeVersion(resume)
  return syncResumeRemote(normalized)
}

/** Stable id for upsert — never reuse another resume's id. */
export function ensureResumeId(id?: string | null): string {
  if (typeof id === "string" && id.trim()) return id.trim()
  return createNewResumeId()
}

/** Default title for a resume that has not been named yet. */
export function defaultResumeTitle(
  contactInfo?: { targetRole?: string; name?: string },
  applicationName = "",
): string {
  const app = applicationName.trim()
  if (app) return app
  const role = contactInfo?.targetRole?.trim()
  if (role) return role
  const name = contactInfo?.name?.trim()
  if (name) return `${name} — Resume`
  return "Untitled Resume"
}
