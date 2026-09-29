import { createAuditEntryId, providerDisplayName } from "@/lib/ai-transparency"
import type { CvEditChange } from "@/lib/cv-edit-types"
import type { AiExplainability } from "@/lib/ai-transparency"
import type { AiApprovalStatus, AiAuditEntry, ResumeVersion } from "@/lib/types"

const STORAGE_PREFIX = "cv_ai_activity_log:"

export type AiActivityEntry = AiAuditEntry & {
  resumeId?: string
  resumeName?: string
}

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}${folderId}`
}

export function loadFolderAiActivity(folderId: string): AiActivityEntry[] {
  if (typeof window === "undefined" || !folderId) return []
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as AiActivityEntry[]) : []
  } catch {
    return []
  }
}

export function appendFolderAiActivity(
  folderId: string,
  entry: Omit<AiActivityEntry, "id"> & { id?: string },
): AiActivityEntry[] {
  if (typeof window === "undefined" || !folderId) return []
  const next: AiActivityEntry = {
    ...entry,
    id: entry.id ?? createAuditEntryId(),
    providerLabel: entry.providerLabel ?? providerDisplayName(entry.provider),
  }
  const log = [...loadFolderAiActivity(folderId), next].slice(-200)
  try {
    localStorage.setItem(storageKey(folderId), JSON.stringify(log))
  } catch {
    /* quota */
  }
  return log
}

export function clearFolderAiActivity(folderId: string): void {
  if (typeof window === "undefined" || !folderId) return
  try {
    localStorage.removeItem(storageKey(folderId))
  } catch {
    /* ignore */
  }
}

/** Merge resume-level audit entries with folder-level session activity. */
export function mergeAiActivityLog(
  resumes: ResumeVersion[],
  folderId: string,
): AiActivityEntry[] {
  const fromResumes: AiActivityEntry[] = resumes.flatMap((resume) =>
    (resume.aiAuditLog ?? []).map((entry) => ({
      ...entry,
      resumeId: resume.id,
      resumeName: resume.name,
    })),
  )
  const fromFolder = loadFolderAiActivity(folderId)
  const combined = [...fromResumes, ...fromFolder]
  return combined.sort(
    (a, b) => (b.approvedAt ?? b.rejectedAt ?? b.createdAt) - (a.approvedAt ?? a.rejectedAt ?? a.createdAt),
  )
}

export function buildActivityFromRejection(opts: {
  action: string
  model?: string
  provider?: string
  changes?: CvEditChange[]
  explainability?: AiExplainability
  resumeId?: string
  resumeName?: string
}): Omit<AiActivityEntry, "id"> {
  const now = Date.now()
  return {
    createdAt: now,
    rejectedAt: now,
    action: opts.action,
    model: opts.model ?? "Unknown",
    provider: opts.provider ?? "unknown",
    providerLabel: providerDisplayName(opts.provider),
    approvalStatus: "rejected" satisfies AiApprovalStatus,
    changes: opts.changes,
    explainability: opts.explainability,
    resumeId: opts.resumeId,
    resumeName: opts.resumeName,
  }
}
