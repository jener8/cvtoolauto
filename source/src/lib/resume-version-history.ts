import { parseVersionedResumeName } from "@/lib/application-resume-naming"
import type { AiSnapshotMetadata } from "@/lib/ai-transparency"
import type { ContactInfo, ResumeContentSnapshot, ResumeVersion } from "@/lib/types"

export type ResumeSnapshotSource =
  | "manual"
  | "ai_edit"
  | "restore"
  | "generation"
  | "autosave"

export function createSnapshotId(): string {
  return `rvs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createSnapshotFromResume(
  resume: ResumeVersion,
  label: string,
  source: ResumeSnapshotSource,
  aiMetadata?: AiSnapshotMetadata,
): ResumeContentSnapshot {
  const now = Date.now()
  return {
    id: createSnapshotId(),
    resumeText: resume.resumeText,
    contactInfo: { ...resume.contactInfo },
    profileImage: resume.profileImage,
    companyLogo: resume.companyLogo,
    accentColor: resume.accentColor,
    accentColorHex: resume.accentColorHex,
    targetBoxBgColor: resume.targetBoxBgColor,
    targetBoxBorderColor: resume.targetBoxBorderColor,
    profilePhotoBorder: resume.profilePhotoBorder,
    jobDescription: resume.jobDescription,
    coverLetter: resume.coverLetter ?? null,
    label: label.trim() || resume.name,
    createdAt: now,
    source,
    aiMetadata,
  }
}

export function getResumeLineageBase(name: string): string {
  const trimmed = name.trim()
  const withoutSuffix = trimmed.replace(/\s+—\s+.+$/, "").trim()
  const { base } = parseVersionedResumeName(withoutSuffix)
  return base || withoutSuffix || trimmed
}

/** Update resume content in place and append previous state to version history. */
export function applyResumeContentUpdate(
  resume: ResumeVersion,
  updates: Partial<
    Pick<
      ResumeVersion,
      | "resumeText"
      | "contactInfo"
      | "profileImage"
      | "companyLogo"
      | "accentColor"
      | "accentColorHex"
      | "targetBoxBgColor"
      | "targetBoxBorderColor"
      | "profilePhotoBorder"
      | "jobDescription"
      | "coverLetter"
      | "name"
    >
  >,
  snapshot: {
    label: string
    source: ResumeSnapshotSource
    aiMetadata?: AiSnapshotMetadata
  },
): ResumeVersion {
  const historyEntry = createSnapshotFromResume(
    resume,
    snapshot.label,
    snapshot.source,
    snapshot.aiMetadata,
  )
  const history = [...(resume.versionHistory ?? []), historyEntry].slice(-50)

  return {
    ...resume,
    ...updates,
    id: resume.id,
    applicationId: resume.applicationId,
    versionHistory: history,
    updatedAt: Date.now(),
  }
}

/** Restore a historical snapshot — current state is saved to history first. */
export function restoreResumeFromSnapshot(
  resume: ResumeVersion,
  snapshotId: string,
): ResumeVersion | null {
  const target = resume.versionHistory?.find((entry) => entry.id === snapshotId)
  if (!target) return null

  const withBackup = applyResumeContentUpdate(
    resume,
    {
      resumeText: target.resumeText,
      contactInfo: target.contactInfo,
      profileImage: target.profileImage,
      companyLogo: target.companyLogo,
      accentColor: target.accentColor,
      accentColorHex: target.accentColorHex,
      targetBoxBgColor: target.targetBoxBgColor,
      targetBoxBorderColor: target.targetBoxBorderColor,
      profilePhotoBorder: target.profilePhotoBorder,
      jobDescription: target.jobDescription,
      coverLetter: target.coverLetter ?? null,
    },
    { label: `Before restore: ${target.label}`, source: "restore" },
  )

  return withBackup
}

export function snapshotToDisplayResume(
  parent: ResumeVersion,
  snapshot: ResumeContentSnapshot,
): ResumeVersion {
  return {
    ...parent,
    resumeText: snapshot.resumeText,
    contactInfo: snapshot.contactInfo,
    profileImage: snapshot.profileImage,
    companyLogo: snapshot.companyLogo,
    accentColor: snapshot.accentColor,
    accentColorHex: snapshot.accentColorHex,
    targetBoxBgColor: snapshot.targetBoxBgColor,
    targetBoxBorderColor: snapshot.targetBoxBorderColor,
    profilePhotoBorder: snapshot.profilePhotoBorder,
    jobDescription: snapshot.jobDescription,
    coverLetter: snapshot.coverLetter ?? null,
    name: snapshot.label,
    updatedAt: snapshot.createdAt,
    createdAt: snapshot.createdAt,
    timestamp: snapshot.createdAt,
  }
}

export function normalizeResumeVersionHistory(resume: ResumeVersion): ResumeVersion {
  const history = Array.isArray(resume.versionHistory)
    ? resume.versionHistory.filter(
        (entry): entry is ResumeContentSnapshot =>
          Boolean(entry && typeof entry.id === "string" && typeof entry.resumeText === "string"),
      )
    : []

  return {
    ...resume,
    versionHistory: history,
  }
}
