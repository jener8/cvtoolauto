import { createJobApplicationFromVersion } from "@/lib/application-reconcile"
import { emptyJobApplicationFields } from "@/lib/application-flow-complete"
import { normalizeJobApplication } from "@/lib/application-outcome"
import { coerceApplicationTimestamp } from "@/lib/application-dates"
import { resolveApplicationRole } from "@/lib/job-application-display"
import { isValidJobApplicationId } from "@/lib/job-applications-normalize"
import { readResumeSnapshotsForFolder } from "@/lib/resume-local-storage"
import { normalizeResumeVersion, loadResumes } from "@/lib/resume-persistence"
import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"
import { LOCAL_STORE_KEYS, readLocalStore } from "@/lib/supabase/local-store"
import type { Folder, JobApplication, ResumeVersion } from "@/lib/types"

export type ApplicationRecordSource =
  | "supabase"
  | "local_cache"
  | "resume_version"
  | "resume_snapshot"
  | "reconciled_candidate"

export type RecoveredApplicationRecord = {
  id: string
  source: ApplicationRecordSource
  jobTitle: string
  company: string
  folderId: string | null
  folderName: string | null
  appliedDate: number | null
  lastModified: number | null
  resumeVersionId: string | null
  resumeVersionName: string | null
  inCurrentWorkspace: boolean
  inCurrentList: boolean
  matchFields: string[]
  recoverable: boolean
  recoveryNote: string | null
  application: JobApplication | null
}

export type ApplicationRecoverySearchResult = {
  query: string
  searchedAt: number
  supabaseAvailable: boolean
  localFallback: boolean
  currentWorkspaceId: string | null
  currentListCount: number
  records: RecoveredApplicationRecord[]
  summary: {
    totalMatches: number
    inSupabase: number
    inLocalOnly: number
    missingFromCurrentList: number
    recoverable: number
  }
}

function appendMatch(fields: string[], label: string, value: string | null | undefined) {
  if (!value?.trim()) return
  if (fields.includes(label)) return
  fields.push(label)
}

function haystackForRecord(input: {
  jobTitle: string
  company: string
  location?: string
  jobDescription?: string
  resumeVersionName?: string | null
  extra?: string
}): string {
  return [
    input.jobTitle,
    input.company,
    input.location,
    input.jobDescription,
    input.resumeVersionName,
    input.extra,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function matchesQuery(haystack: string, query: string): { matched: boolean; fields: string[] } {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { matched: true, fields: [] }
  if (!haystack.includes(normalizedQuery)) return { matched: false, fields: [] }
  return { matched: true, fields: ["keyword"] }
}

function mapSupabaseRow(row: Record<string, unknown>): JobApplication {
  return normalizeJobApplication({
    id: String(row.id ?? ""),
    jobTitle: String(row.role ?? ""),
    company: String(row.company ?? ""),
    jobDescription:
      (row.job_description as { content?: string } | null)?.content ||
      (typeof row.job_description === "string" ? row.job_description : "") ||
      "",
    jobDescriptionSummary: (row.job_description as { summary?: string } | null)?.summary || "",
    jobDescriptionUrl: (row.job_description as { url?: string } | null)?.url || "",
    strategySummary: (row.job_strategy as { summary?: string } | null)?.summary || "",
    why: (row.why_content as { text?: string } | null)?.text || "",
    resumeVersionId:
      String(row.resume_version_id ?? "") ||
      (row.job_description as { resumeVersionId?: string } | null)?.resumeVersionId ||
      "",
    contactPersonName: (row.job_description as { contactPerson?: string } | null)?.contactPerson || "",
    salaryExpectation: (row.job_description as { salary?: string } | null)?.salary || "",
    employmentType:
      ((row.job_description as { employmentType?: JobApplication["employmentType"] } | null)
        ?.employmentType as JobApplication["employmentType"]) || "full-time",
    jobStrategy: row.job_strategy as JobApplication["jobStrategy"],
    companyInfo: (row.company_info as JobApplication["companyInfo"]) || {
      website: "",
      researchNotes: "",
      linkedInContacts: [],
      lastModified: Date.now(),
    },
    contacts: (row.contacts as JobApplication["contacts"]) || [],
    coverLetter: (row.cover_letter as JobApplication["coverLetter"]) || {
      content: "",
      lastModified: Date.now(),
    },
    coverLetterId: String(row.cover_letter_id ?? ""),
    interviewPrep: (row.interview_prep as JobApplication["interviewPrep"]) || {
      questions: [],
      personalDescription: "",
      interviewers: [],
      generalNotes: "",
      lastModified: Date.now(),
    },
    fitScores: row.fit_scores as JobApplication["fitScores"],
    redFlags: row.red_flags as JobApplication["redFlags"],
    folderId: row.folder_id ? String(row.folder_id) : undefined,
    pipeline: Array.isArray((row.job_description as { pipeline?: unknown[] } | null)?.pipeline)
      ? ((row.job_description as { pipeline: Array<Record<string, unknown>> }).pipeline.map(
          (record) => ({
            stage: String(record.stage ?? "applied"),
            outcome: String(record.outcome ?? "pending"),
            date: coerceApplicationTimestamp(record.date),
            notes: record.notes ? String(record.notes) : undefined,
          }),
        ) as JobApplication["pipeline"])
      : [],
    status: row.status as JobApplication["status"],
    location: (row.job_description as { location?: string } | null)?.location ?? "",
    appliedDate:
      coerceApplicationTimestamp(row.applied_date) ??
      coerceApplicationTimestamp(row.created_at) ??
      0,
    firstInterviewDate: (row.job_description as { firstInterviewDate?: string } | null)
      ?.firstInterviewDate
      ? new Date(
          String(
            (row.job_description as { firstInterviewDate?: string }).firstInterviewDate,
          ),
        ).getTime()
      : undefined,
    additionalInterviewDates: Array.isArray(
      (row.job_description as { additionalInterviewDates?: string[] } | null)
        ?.additionalInterviewDates,
    )
      ? (
          (row.job_description as { additionalInterviewDates: string[] }).additionalInterviewDates
        ).map((value) => new Date(String(value)).getTime())
      : [],
    rejectionDate: (row.job_description as { rejectionDate?: string } | null)?.rejectionDate
      ? new Date(String((row.job_description as { rejectionDate?: string }).rejectionDate)).getTime()
      : undefined,
    offerDate: (row.job_description as { offerDate?: string } | null)?.offerDate
      ? new Date(String((row.job_description as { offerDate?: string }).offerDate)).getTime()
      : undefined,
    lastModified: row.updated_at ? new Date(String(row.updated_at)).getTime() : Date.now(),
  })
}

function folderNameForId(folders: Folder[], folderId: string | null): string | null {
  if (!folderId) return null
  return folders.find((folder) => folder.id === folderId)?.name ?? null
}

function buildRecordKey(source: ApplicationRecordSource, id: string, resumeVersionId?: string | null) {
  return `${source}:${id}:${resumeVersionId ?? ""}`
}

function addRecord(
  map: Map<string, RecoveredApplicationRecord>,
  record: RecoveredApplicationRecord,
) {
  const key = buildRecordKey(record.source, record.id, record.resumeVersionId)
  const existing = map.get(key)
  if (!existing) {
    map.set(key, record)
    return
  }
  if (existing.source === "local_cache" && record.source === "supabase") {
    map.set(key, {
      ...record,
      matchFields: [...new Set([...existing.matchFields, ...record.matchFields])],
      inCurrentList: existing.inCurrentList || record.inCurrentList,
      inCurrentWorkspace: existing.inCurrentWorkspace || record.inCurrentWorkspace,
    })
  }
}

export async function searchAllApplicationRecords(input: {
  query: string
  currentWorkspaceId?: string | null
  currentApplications?: JobApplication[]
  folders?: Folder[]
}): Promise<ApplicationRecoverySearchResult> {
  const query = input.query.trim()
  const currentWorkspaceId = input.currentWorkspaceId ?? null
  const currentApplications = input.currentApplications ?? []
  const folders = input.folders ?? []
  const currentIds = new Set(currentApplications.map((app) => app.id))
  const localFallback = shouldUseLocalFallback()
  const supabase = getSupabaseClient()
  const records = new Map<string, RecoveredApplicationRecord>()

  const evaluate = (
    partial: Omit<
      RecoveredApplicationRecord,
      "inCurrentWorkspace" | "inCurrentList" | "matchFields" | "recoverable" | "recoveryNote"
    > & { matchFields?: string[] },
  ) => {
    const haystack = haystackForRecord({
      jobTitle: partial.jobTitle,
      company: partial.company,
      jobDescription: partial.application?.jobDescription,
      resumeVersionName: partial.resumeVersionName,
    })
    const match = matchesQuery(haystack, query)
    if (!match.matched) return

    const matchFields = [...(partial.matchFields ?? []), ...match.fields]
    appendMatch(matchFields, "company", partial.company)
    appendMatch(matchFields, "job title", partial.jobTitle)
    appendMatch(matchFields, "resume", partial.resumeVersionName)

    const inCurrentList = currentIds.has(partial.id)
    const inCurrentWorkspace = Boolean(
      currentWorkspaceId && partial.folderId === currentWorkspaceId,
    )
    const recoverable = Boolean(partial.application) && !inCurrentList
    const recoveryNote = inCurrentList
      ? "Already in the current applications list."
      : partial.application
        ? partial.source === "supabase"
          ? "Found in Supabase — can restore to this workspace."
          : partial.source === "local_cache"
            ? "Found in browser cache only — restore and sync when online."
            : "Can recreate application from stored resume data."
        : "Match found but no full application payload available."

    addRecord(records, {
      ...partial,
      inCurrentWorkspace,
      inCurrentList,
      matchFields,
      recoverable,
      recoveryNote,
    })
  }

  if (supabase && !localFallback) {
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("updated_at", { ascending: false })

    if (error) {
      console.warn("[recovery] Supabase search failed:", error.message)
    } else {
      for (const row of data ?? []) {
        const application = mapSupabaseRow(row as Record<string, unknown>)
        evaluate({
          id: application.id,
          source: "supabase",
          jobTitle: application.jobTitle,
          company: application.company,
          folderId: application.folderId ?? null,
          folderName: folderNameForId(folders, application.folderId ?? null),
          appliedDate: application.appliedDate ?? null,
          lastModified: application.lastModified ?? null,
          resumeVersionId: application.resumeVersionId || null,
          resumeVersionName: null,
          application,
        })
      }
    }
  }

  const localApplications = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).map(
    normalizeJobApplication,
  )
  for (const application of localApplications) {
    evaluate({
      id: application.id,
      source: "local_cache",
      jobTitle: application.jobTitle,
      company: application.company,
      folderId: application.folderId ?? null,
      folderName: folderNameForId(folders, application.folderId ?? null),
      appliedDate: application.appliedDate ?? null,
      lastModified: application.lastModified ?? null,
      resumeVersionId: application.resumeVersionId || null,
      resumeVersionName: null,
      application,
    })
  }

  const resumeSources: ResumeVersion[] = []
  const resumeIds = new Set<string>()

  const addResume = (version: ResumeVersion) => {
    const normalized = normalizeResumeVersion(version)
    if (resumeIds.has(normalized.id)) return
    resumeIds.add(normalized.id)
    resumeSources.push(normalized)
  }

  for (const version of readLocalStore<ResumeVersion>(LOCAL_STORE_KEYS.resumeVersions)) {
    addResume(version)
  }
  for (const folder of folders) {
    for (const version of readResumeSnapshotsForFolder(folder.id)) {
      addResume(version)
    }
    if (supabase && !localFallback) {
      try {
        for (const version of await loadResumes(folder.id)) {
          addResume(version)
        }
      } catch (e) {
        console.warn("[recovery] Failed to load resumes for folder:", folder.id, e)
      }
    }
  }

  if (supabase && !localFallback) {
    const { data: orphanRows, error: orphanError } = await supabase
      .from("resume_versions")
      .select("*")
      .is("folder_id", null)
      .order("updated_at", { ascending: false })
    if (!orphanError) {
      for (const row of orphanRows ?? []) {
        addResume(
          normalizeResumeVersion({
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            resumeText: String(row.resume_text ?? ""),
            contactInfo: (row.contact_info as ResumeVersion["contactInfo"]) ?? {},
            folderId: row.folder_id ? String(row.folder_id) : undefined,
            timestamp: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
            createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : Date.now(),
            jobDescription: String(row.job_description ?? ""),
          } as ResumeVersion),
        )
      }
    }
  }

  const linkedResumeIds = new Set(
    [...localApplications, ...currentApplications]
      .map((app) => app.resumeVersionId)
      .filter(Boolean),
  )

  for (const version of resumeSources) {
    const role = resolveApplicationRole(
      {
        ...emptyJobApplicationFields({ resumeVersionId: version.id }),
        jobTitle: version.contactInfo?.targetRole ?? "",
        company: version.contactInfo?.targetCompany ?? "",
        jobDescription: version.jobDescription ?? "",
      },
      version,
    )
    const haystack = haystackForRecord({
      jobTitle: role.jobTitle || version.name,
      company: role.company,
      jobDescription: version.jobDescription,
      resumeVersionName: version.name,
    })
    const match = matchesQuery(haystack, query)
    if (!match.matched) continue

    const application = createJobApplicationFromVersion(version, version.folderId)
    evaluate({
      id: application.id,
      source: linkedResumeIds.has(version.id) ? "resume_snapshot" : "resume_version",
      jobTitle: role.jobTitle || version.name,
      company: role.company,
      folderId: version.folderId ?? null,
      folderName: folderNameForId(folders, version.folderId ?? null),
      appliedDate: application.appliedDate ?? null,
      lastModified: version.updatedAt ?? version.timestamp ?? null,
      resumeVersionId: version.id,
      resumeVersionName: version.name,
      application: {
        ...application,
        jobTitle: role.jobTitle || application.jobTitle,
        company: role.company || application.company,
        location: role.location || application.location,
      },
      matchFields: ["resume"],
    })

    for (const snapshot of version.versionHistory ?? []) {
      const snapshotHaystack = haystackForRecord({
        jobTitle: snapshot.label,
        company: snapshot.contactInfo?.targetCompany,
        jobDescription: snapshot.jobDescription,
        resumeVersionName: snapshot.label,
        extra: snapshot.resumeText,
      })
      if (!matchesQuery(snapshotHaystack, query).matched) continue

      const snapshotApplication = createJobApplicationFromVersion(
        {
          ...version,
          name: snapshot.label,
          resumeText: snapshot.resumeText,
          contactInfo: snapshot.contactInfo,
          jobDescription: snapshot.jobDescription ?? version.jobDescription,
        },
        version.folderId,
      )
      evaluate({
        id: `${version.id}:${snapshot.id}`,
        source: "resume_snapshot",
        jobTitle: snapshot.contactInfo?.targetRole || snapshot.label,
        company: snapshot.contactInfo?.targetCompany || "",
        folderId: version.folderId ?? null,
        folderName: folderNameForId(folders, version.folderId ?? null),
        appliedDate: snapshot.createdAt,
        lastModified: snapshot.createdAt,
        resumeVersionId: version.id,
        resumeVersionName: snapshot.label,
        application: snapshotApplication,
        matchFields: ["resume snapshot"],
      })
    }
  }

  const list = [...records.values()].sort(
    (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0),
  )

  return {
    query,
    searchedAt: Date.now(),
    supabaseAvailable: Boolean(supabase) && !localFallback,
    localFallback,
    currentWorkspaceId,
    currentListCount: currentApplications.length,
    records: list,
    summary: {
      totalMatches: list.length,
      inSupabase: list.filter((record) => record.source === "supabase").length,
      inLocalOnly: list.filter((record) => record.source === "local_cache").length,
      missingFromCurrentList: list.filter((record) => !record.inCurrentList).length,
      recoverable: list.filter((record) => record.recoverable).length,
    },
  }
}

export function applicationFromRecoveryRecord(
  record: RecoveredApplicationRecord,
  targetFolderId: string,
): JobApplication | null {
  if (!record.application) return null
  const now = Date.now()
  const id = isValidJobApplicationId(record.application.id)
    ? record.application.id
    : crypto.randomUUID()

  return normalizeJobApplication({
    ...record.application,
    id,
    folderId: targetFolderId,
    lastModified: now,
    appliedDate:
      coerceApplicationTimestamp(record.application.appliedDate) ??
      coerceApplicationTimestamp(record.appliedDate) ??
      0,
  })
}
