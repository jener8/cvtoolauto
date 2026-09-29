import type { CoverLetter, ResumeEmbeddedCoverLetter, ResumeVersion } from "./types"

/** Hiring manager / recipient name from embedded or legacy cover letter fields. */
export function getHiringManagerName(
  letter?: Partial<Pick<ResumeEmbeddedCoverLetter, "contactPersonName" | "hiringManager">> | null,
): string {
  if (!letter) return ""
  const raw = letter.hiringManager ?? letter.contactPersonName ?? ""
  return typeof raw === "string" ? raw.trim() : ""
}

export function hiringManagerFields(name: string): {
  contactPersonName: string
  hiringManager: string
} {
  const trimmed = name.trim()
  return { contactPersonName: trimmed, hiringManager: trimmed }
}

export function createEmptyResumeCoverLetter(resumeName: string): ResumeEmbeddedCoverLetter {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: `Cover Letter - ${resumeName}`,
    contentEn: "",
    contentDe: "",
    contactPersonName: "",
    hiringManager: "",
    recipientCompany: "",
    profileImage: null,
    companyLogo: null,
    applicantName: "",
    applicantAddress: "",
    applicantEmail: "",
    applicantPhone: "",
    letterDate: "",
    createdAt: now,
    updatedAt: now,
  }
}

export function coverLetterLayoutFields(
  letter: Partial<
    Pick<ResumeEmbeddedCoverLetter, "recipientCompany" | "profileImage" | "companyLogo">
  >,
): Pick<ResumeEmbeddedCoverLetter, "recipientCompany" | "profileImage" | "companyLogo"> {
  return {
    recipientCompany: (letter.recipientCompany ?? "").trim(),
    profileImage: letter.profileImage ?? null,
    companyLogo: letter.companyLogo ?? null,
  }
}

/** Sender + recipient layout stored on the cover letter record. */
export function coverLetterHeaderFields(
  letter: Partial<
    Pick<
      ResumeEmbeddedCoverLetter,
      | "recipientCompany"
      | "profileImage"
      | "companyLogo"
      | "applicantName"
      | "applicantAddress"
      | "applicantEmail"
      | "applicantPhone"
      | "letterDate"
    >
  >,
) {
  return {
    ...coverLetterLayoutFields(letter),
    applicantName: (letter.applicantName ?? "").trim(),
    applicantAddress: (letter.applicantAddress ?? "").trim(),
    applicantEmail: (letter.applicantEmail ?? "").trim(),
    applicantPhone: (letter.applicantPhone ?? "").trim(),
    letterDate: (letter.letterDate ?? "").trim(),
  }
}

export function coverLetterFromStandalone(letter: CoverLetter): ResumeEmbeddedCoverLetter {
  const manager = getHiringManagerName(letter)
  return {
    id: letter.id,
    name: letter.name,
    contentEn: letter.contentEn,
    contentDe: letter.contentDe,
    contactPersonName: manager,
    hiringManager: manager,
    recipientCompany: letter.recipientCompany ?? "",
    profileImage: letter.profileImage ?? null,
    companyLogo: letter.companyLogo ?? null,
    applicantName: letter.applicantName ?? "",
    applicantAddress: letter.applicantAddress ?? "",
    applicantEmail: letter.applicantEmail ?? "",
    applicantPhone: letter.applicantPhone ?? "",
    letterDate: letter.letterDate ?? "",
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  }
}

/** True when the embedded letter has saved body text (bilingual or legacy `content`). */
export function hasResumeCoverLetterContent(
  cl?: (ResumeEmbeddedCoverLetter & { content?: string }) | null,
): boolean {
  if (!cl) return false
  const t = (v: string | undefined) => (v ?? "").trim()
  const legacy = typeof cl.content === "string" ? cl.content : ""
  return t(legacy).length > 0 || t(cl.contentEn).length > 0 || t(cl.contentDe).length > 0
}

/** True when a cover letter record exists on the resume (even if local snapshot omitted body text). */
export function hasResumeCoverLetterRecord(
  cl?: ResumeEmbeddedCoverLetter | null,
): boolean {
  return Boolean(cl?.id?.trim())
}

/** Open editor when body text exists; otherwise entry/wizard when a record exists or not. */
export function resolveCoverLetterOpenMode(
  cl?: (ResumeEmbeddedCoverLetter & { content?: string }) | null,
): "wizard" | "editor" {
  if (hasResumeCoverLetterContent(cl)) return "editor"
  return "wizard"
}

/** Attach legacy standalone cover letters (name-matched) onto resumes once. */
/** Prefer embedded letter; fill from legacy standalone list when embedded body is empty. */
export function resolveResumeEmbeddedCoverLetter(
  resume: Pick<ResumeVersion, "name" | "coverLetter">,
  standaloneLetters: CoverLetter[] = [],
): ResumeEmbeddedCoverLetter {
  const embedded = resume.coverLetter
  if (embedded && hasResumeCoverLetterContent(embedded)) {
    return embedded
  }
  const legacy = standaloneLetters.find((l) => l.name === `Cover Letter - ${resume.name}`)
  if (legacy) {
    return coverLetterFromStandalone(legacy)
  }
  return embedded ?? createEmptyResumeCoverLetter(resume.name)
}

export function mergeLegacyCoverLettersIntoResumes(
  resumes: ResumeVersion[],
  standaloneLetters: CoverLetter[],
): ResumeVersion[] {
  return resumes.map((resume) => {
    const legacy = standaloneLetters.find((l) => l.name === `Cover Letter - ${resume.name}`)
    if (resume.coverLetter) {
      if (hasResumeCoverLetterContent(resume.coverLetter)) return resume
      if (legacy) {
        return { ...resume, coverLetter: coverLetterFromStandalone(legacy) }
      }
      return resume
    }
    if (!legacy) return resume
    return { ...resume, coverLetter: coverLetterFromStandalone(legacy) }
  })
}
