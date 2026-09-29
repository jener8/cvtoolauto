import {
  coverLetterFromStandalone,
  createEmptyResumeCoverLetter,
  hasResumeCoverLetterContent,
  hasResumeCoverLetterRecord,
} from "@/lib/resume-cover-letter"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"

export function jobCoverLetterHasContent(job: JobApplication): boolean {
  const cl = job.coverLetter as
    | { content?: string; contentEn?: string; contentDe?: string }
    | undefined
  if (!cl) return false
  const t = (v?: string) => (v ?? "").trim()
  return t(cl.content).length > 0 || t(cl.contentEn).length > 0 || t(cl.contentDe).length > 0
}

export function standaloneCoverLetterHasContent(letter?: CoverLetter | null): boolean {
  if (!letter) return false
  const t = (v?: string) => (v ?? "").trim()
  return t(letter.contentEn).length > 0 || t(letter.contentDe).length > 0
}

/** True when the application has saved cover letter body text (not just a placeholder name). */
export function hasUsableApplicationCoverLetter(
  job: JobApplication,
  coverLetters: CoverLetter[] = [],
  resumeVersion?: ResumeVersion | null,
): boolean {
  if (hasResumeCoverLetterContent(resumeVersion?.coverLetter)) return true
  if (jobCoverLetterHasContent(job)) return true
  const linked = job.coverLetterId
    ? coverLetters.find((letter) => letter.id === job.coverLetterId)
    : undefined
  return standaloneCoverLetterHasContent(linked)
}

/** Wizard when no body exists; editor when cover letter content is already saved. */
export function resolveApplicationCoverLetterMode(
  job: JobApplication,
  resumeVersion: ResumeVersion | null | undefined,
  coverLetters: CoverLetter[] = [],
): "wizard" | "editor" {
  if (hasResumeCoverLetterContent(resumeVersion?.coverLetter)) return "editor"
  if (jobCoverLetterHasContent(job)) return "editor"

  const linked = job.coverLetterId
    ? coverLetters.find((letter) => letter.id === job.coverLetterId)
    : undefined
  if (standaloneCoverLetterHasContent(linked)) return "editor"

  if (hasResumeCoverLetterRecord(resumeVersion?.coverLetter)) return "wizard"
  return "wizard"
}

/** Prefer resume-embedded letter; merge job or legacy standalone data when the resume copy is empty. */
export function mergeApplicationCoverLetterOntoResume(
  job: JobApplication,
  resume: ResumeVersion,
  coverLetters: CoverLetter[] = [],
): ResumeVersion {
  if (hasResumeCoverLetterContent(resume.coverLetter)) return resume

  if (jobCoverLetterHasContent(job) && job.coverLetter) {
    const base = resume.coverLetter ?? createEmptyResumeCoverLetter(resume.name)
    const legacyContent =
      typeof job.coverLetter.content === "string" ? job.coverLetter.content : ""
    return {
      ...resume,
      coverLetter: {
        ...base,
        contentEn: job.coverLetter.contentEn?.trim()
          ? job.coverLetter.contentEn
          : legacyContent || base.contentEn,
        contentDe: job.coverLetter.contentDe?.trim()
          ? job.coverLetter.contentDe
          : base.contentDe,
        aiMetadata: job.coverLetter.aiMetadata ?? base.aiMetadata,
        versionHistory: job.coverLetter.versionHistory ?? base.versionHistory,
        updatedAt: Date.now(),
      },
    }
  }

  const linked = job.coverLetterId
    ? coverLetters.find((letter) => letter.id === job.coverLetterId)
    : undefined
  if (linked) {
    return {
      ...resume,
      coverLetter: coverLetterFromStandalone(linked),
    }
  }

  return resume
}
