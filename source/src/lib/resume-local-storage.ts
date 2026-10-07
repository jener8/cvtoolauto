import { normalizeContactInfo } from "./contact-info"
import {
  clearAllCvLocalStorage,
  enforceLocalStorageBudget,
  readLocalJsonSafe,
  writeJsonWithQuotaRecovery,
} from "./local-storage-budget"
import type { ResumeEmbeddedCoverLetter, ResumeVersion } from "./types"
import { LOCAL_STORE_KEYS } from "./supabase/local-store"

/** Manual named snapshots per folder (autosave never writes here). */
export const MAX_RESUME_SNAPSHOTS_PER_FOLDER = 8

export const STORAGE_FULL_MESSAGE =
  "Storage is full. Please export your data, then clear saved versions."

const MAX_SNAPSHOT_RESUME_TEXT = 45_000
const MAX_DRAFT_RESUME_TEXT = 70_000
const MAX_JOB_DESCRIPTION_CHARS = 100_000
const MAX_COVER_LETTER_BODY_CHARS = 24_000
const MAX_COVER_LETTER_IMAGE_CHARS = 12_000
const MAX_RESUME_IMAGE_CHARS = 100_000

const WIRE_VERSION = 2 as const

/** Minimized JSON on disk (short keys). */
type WireSnapshot = {
  v: typeof WIRE_VERSION
  i: string
  n: string
  u: number
  a: number
  f?: string
  t: string
  j?: string
  c?: Record<string, unknown>
  ac?: string
  ah?: string
  pb?: boolean
  bg?: string
  bc?: string
  pi?: string
  lg?: string
  aid?: string
  cl?: {
    i: string
    n: string
    u: number
    p?: string
    h?: string
    en?: string
    de?: string
    rc?: string
    pi?: string
    lg?: string
    an?: string
    adr?: string
    em?: string
    ph?: string
  }
}

export type CompactResumeRecord = {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  folderId?: string
  applicationId?: string
  resumeText: string
  contactInfo: ResumeVersion["contactInfo"]
  accentColor?: string
  accentColorHex?: string
  profilePhotoBorder?: boolean
  targetBoxBgColor?: string
  targetBoxBorderColor?: string
  jobDescription?: string
  profileImage?: string
  companyLogo?: string
  coverLetterMeta?: {
    id: string
    name: string
    updatedAt: number
    createdAt?: number
    contactPersonName?: string
    hiringManager?: string
    contentEn?: string
    contentDe?: string
    recipientCompany?: string
    profileImage?: string
    companyLogo?: string
    applicantName?: string
    applicantAddress?: string
    applicantEmail?: string
    applicantPhone?: string
  } | null
}

export type ResumeDraftRecord = {
  resumeId: string
  folderId?: string
  updatedAt: number
  compact: CompactResumeRecord
}

export type LocalResumeWriteResult = {
  ok: boolean
  warning?: string
}

function truncate(value: string | undefined, max: number): string {
  if (!value) return ""
  return value.length <= max ? value : value.slice(0, max)
}

function minimalContact(contact: ResumeVersion["contactInfo"]): Record<string, unknown> {
  const c = normalizeContactInfo(contact)
  const out: Record<string, unknown> = {}
  const put = (key: string, val: unknown) => {
    if (val === undefined || val === null || val === "") return
    if (Array.isArray(val) && val.length === 0) return
    out[key] = val
  }
  put("e", c.email)
  put("li", c.linkedin)
  put("p", c.phone)
  put("ad", c.address)
  put("cz", c.citizenship)
  const portfolioUrls = c.portfolios?.filter(Boolean).slice(0, 3) ?? []
  put("pf", portfolioUrls)
  if (portfolioUrls.length > 0) {
    out.sp = c.showPortfolio !== false
  } else if (c.showPortfolio === true) {
    out.sp = true
  }
  if (c.showLinkedInOnCv === false) {
    out.sli = false
  }
  if (portfolioUrls[0]) put("po", portfolioUrls[0])
  put("pt", c.professionalTitle)
  put("nm", c.name)
  put("l", c.language)
  put("tc", c.targetCompany)
  put("tr", c.targetRole)
  put("ja", c.jobAdvertSource)
  return out
}

function expandContact(raw: Record<string, unknown> | undefined): ResumeVersion["contactInfo"] {
  if (!raw) return normalizeContactInfo(null)
  return normalizeContactInfo({
    email: (raw.e as string) ?? "",
    linkedin: (raw.li as string) ?? "",
    phone: (raw.p as string) ?? "",
    address: (raw.ad as string) ?? "",
    citizenship: (raw.cz as string) ?? "",
    portfolios: (raw.pf as string[]) ?? [],
    showPortfolio: raw.sp,
    showLinkedInOnCv: raw.sli === false ? false : true,
    professionalTitle: (raw.pt as string) ?? "",
    name: (raw.nm as string) ?? "",
    language: (raw.l as "en" | "de") ?? "en",
    targetCompany: (raw.tc as string) ?? "",
    targetRole: (raw.tr as string) ?? "",
    jobAdvertSource: (raw.ja as string) ?? "",
    portfolio: (raw.po as string) ?? "",
  })
}

function lightNormalizeResume(v: ResumeVersion): ResumeVersion {
  const createdAt = v.createdAt ?? v.timestamp ?? Date.now()
  const updatedAt = v.updatedAt ?? v.timestamp ?? createdAt
  const rawContact = v.contactInfo ?? (v as { contact_info?: unknown }).contact_info
  return {
    ...v,
    profileImage: v.profileImage ?? null,
    companyLogo: v.companyLogo ?? null,
    timestamp: v.timestamp ?? createdAt,
    createdAt,
    updatedAt,
    contactInfo: normalizeContactInfo(
      rawContact as ResumeVersion["contactInfo"] | Record<string, unknown> | null,
    ),
    coverLetter: v.coverLetter ? { ...v.coverLetter } : null,
  }
}

function compactCoverLetterMeta(
  cl: ResumeEmbeddedCoverLetter | null | undefined,
): CompactResumeRecord["coverLetterMeta"] {
  if (!cl) return null
  return {
    id: cl.id,
    name: cl.name,
    updatedAt: cl.updatedAt,
    createdAt: cl.createdAt,
    contactPersonName: cl.contactPersonName || undefined,
    hiringManager: cl.hiringManager || undefined,
    contentEn: truncate(cl.contentEn, MAX_COVER_LETTER_BODY_CHARS) || undefined,
    contentDe: truncate(cl.contentDe, MAX_COVER_LETTER_BODY_CHARS) || undefined,
    recipientCompany: truncate(cl.recipientCompany, 200) || undefined,
    profileImage: truncate(cl.profileImage ?? undefined, MAX_COVER_LETTER_IMAGE_CHARS) || undefined,
    companyLogo: truncate(cl.companyLogo ?? undefined, MAX_COVER_LETTER_IMAGE_CHARS) || undefined,
    applicantName: truncate(cl.applicantName, 120) || undefined,
    applicantAddress: truncate(cl.applicantAddress, 300) || undefined,
    applicantEmail: truncate(cl.applicantEmail, 120) || undefined,
    applicantPhone: truncate(cl.applicantPhone, 40) || undefined,
  }
}

export function compactResumeForLocal(
  resume: ResumeVersion,
  textLimit = MAX_SNAPSHOT_RESUME_TEXT,
): CompactResumeRecord {
  const v = lightNormalizeResume(resume)
  return {
    id: v.id,
    name: v.name || "Untitled Resume",
    updatedAt: v.updatedAt,
    createdAt: v.createdAt,
    folderId: v.folderId,
    applicationId: v.applicationId?.trim() || undefined,
    resumeText: truncate(v.resumeText, textLimit),
    contactInfo: v.contactInfo,
    accentColor: v.accentColor,
    accentColorHex: v.accentColorHex,
    profilePhotoBorder: v.profilePhotoBorder,
    targetBoxBgColor: v.targetBoxBgColor,
    targetBoxBorderColor: v.targetBoxBorderColor,
    jobDescription: v.jobDescription
      ? truncate(v.jobDescription, MAX_JOB_DESCRIPTION_CHARS)
      : undefined,
    profileImage: truncate(v.profileImage ?? undefined, MAX_RESUME_IMAGE_CHARS) || undefined,
    companyLogo: truncate(v.companyLogo ?? undefined, MAX_RESUME_IMAGE_CHARS) || undefined,
    coverLetterMeta: compactCoverLetterMeta(resume.coverLetter),
  }
}

function wireFromCompact(c: CompactResumeRecord): WireSnapshot {
  const wire: WireSnapshot = {
    v: WIRE_VERSION,
    i: c.id,
    n: c.name,
    u: c.updatedAt,
    a: c.createdAt,
    t: c.resumeText,
    c: minimalContact(c.contactInfo),
  }
  if (c.folderId) wire.f = c.folderId
  if (c.applicationId) wire.aid = c.applicationId
  if (c.jobDescription) wire.j = c.jobDescription
  if (c.accentColor) wire.ac = c.accentColor
  if (c.accentColorHex) wire.ah = c.accentColorHex
  if (c.profilePhotoBorder === false) wire.pb = false
  if (c.targetBoxBgColor) wire.bg = c.targetBoxBgColor
  if (c.targetBoxBorderColor) wire.bc = c.targetBoxBorderColor
  if (c.profileImage) wire.pi = c.profileImage
  if (c.companyLogo) wire.lg = c.companyLogo
  if (c.coverLetterMeta) {
    wire.cl = {
      i: c.coverLetterMeta.id,
      n: c.coverLetterMeta.name,
      u: c.coverLetterMeta.updatedAt,
      p: c.coverLetterMeta.contactPersonName,
      h: c.coverLetterMeta.hiringManager,
      en: c.coverLetterMeta.contentEn,
      de: c.coverLetterMeta.contentDe,
      rc: c.coverLetterMeta.recipientCompany,
      pi: c.coverLetterMeta.profileImage,
      lg: c.coverLetterMeta.companyLogo,
      an: c.coverLetterMeta.applicantName,
      adr: c.coverLetterMeta.applicantAddress,
      em: c.coverLetterMeta.applicantEmail,
      ph: c.coverLetterMeta.applicantPhone,
    }
  }
  return wire
}

function wireToCompact(raw: unknown): CompactResumeRecord | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>

  if (r.v === WIRE_VERSION && typeof r.i === "string" && typeof r.t === "string") {
    const w = r as unknown as WireSnapshot
    const meta = w.cl
    return {
      id: w.i,
      name: w.n || "Untitled Resume",
      updatedAt: w.u,
      createdAt: w.a,
      folderId: w.f,
      applicationId: w.aid,
      resumeText: w.t,
      contactInfo: expandContact(w.c),
      accentColor: w.ac,
      accentColorHex: w.ah,
      profilePhotoBorder: w.pb,
      targetBoxBgColor: w.bg,
      targetBoxBorderColor: w.bc,
      jobDescription: w.j,
      profileImage: w.pi,
      companyLogo: w.lg,
      coverLetterMeta: meta
        ? {
            id: meta.i,
            name: meta.n,
            updatedAt: meta.u,
            createdAt: meta.u,
            contactPersonName: meta.p,
            hiringManager: meta.h,
            contentEn: meta.en,
            contentDe: meta.de,
            recipientCompany: meta.rc,
            profileImage: meta.pi,
            companyLogo: meta.lg,
            applicantName: meta.an,
            applicantAddress: meta.adr,
            applicantEmail: meta.em,
            applicantPhone: meta.ph,
          }
        : null,
    }
  }

  if (typeof r.id === "string" && typeof r.resumeText === "string") {
    return compactResumeForLocal(raw as ResumeVersion)
  }

  return compactResumeForLocal(raw as ResumeVersion)
}

export function expandCompactResume(compact: CompactResumeRecord): ResumeVersion {
  const meta = compact.coverLetterMeta
  const coverLetter: ResumeEmbeddedCoverLetter | null = meta
    ? {
        id: meta.id,
        name: meta.name,
        contentEn: meta.contentEn ?? "",
        contentDe: meta.contentDe ?? "",
        contactPersonName: meta.contactPersonName ?? "",
        hiringManager: meta.hiringManager,
        recipientCompany: meta.recipientCompany ?? "",
        profileImage: meta.profileImage ?? null,
        companyLogo: meta.companyLogo ?? null,
        applicantName: meta.applicantName ?? "",
        applicantAddress: meta.applicantAddress ?? "",
        applicantEmail: meta.applicantEmail ?? "",
        applicantPhone: meta.applicantPhone ?? "",
        createdAt: meta.createdAt ?? meta.updatedAt,
        updatedAt: meta.updatedAt,
      }
    : null

  return lightNormalizeResume({
    id: compact.id,
    name: compact.name,
    resumeText: compact.resumeText,
    profileImage: compact.profileImage ?? null,
    companyLogo: compact.companyLogo ?? null,
    timestamp: compact.createdAt,
    createdAt: compact.createdAt,
    updatedAt: compact.updatedAt,
    contactInfo: compact.contactInfo,
    accentColor: compact.accentColor,
    accentColorHex: compact.accentColorHex,
    profilePhotoBorder: compact.profilePhotoBorder,
    targetBoxBgColor: compact.targetBoxBgColor,
    targetBoxBorderColor: compact.targetBoxBorderColor,
    jobDescription: compact.jobDescription,
    folderId: compact.folderId,
    applicationId: compact.applicationId,
    coverLetter,
  })
}

function folderKey(folderId?: string): string {
  return folderId ?? ""
}

let migrationAttempted = false

export function migrateLocalResumeStorageIfNeeded(): void {
  if (typeof window === "undefined" || migrationAttempted) return
  migrationAttempted = true
  enforceLocalStorageBudget()

  const rows = readLocalJsonSafe<unknown>(LOCAL_STORE_KEYS.resumeVersions, true) as unknown[]
  if (!Array.isArray(rows) || rows.length === 0) return

  const compacts: WireSnapshot[] = []
  for (const row of rows) {
    const c = wireToCompact(row)
    if (c) compacts.push(wireFromCompact(c))
  }

  const pruned = pruneSnapshotWires(compacts)
  writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.resumeVersions, pruned, () => {
    enforceLocalStorageBudget({ clearSnapshots: true })
  })
}

function readSnapshotWires(): WireSnapshot[] {
  migrateLocalResumeStorageIfNeeded()
  const rows = readLocalJsonSafe<unknown>(LOCAL_STORE_KEYS.resumeVersions, true)
  if (!Array.isArray(rows)) return []
  const out: WireSnapshot[] = []
  for (const row of rows) {
    const c = wireToCompact(row)
    if (c) out.push(wireFromCompact(c))
  }
  return out
}

export function readResumeSnapshotsLocal(): CompactResumeRecord[] {
  return readSnapshotWires().map((w) => wireToCompact(w)!)
}

export function readResumeSnapshotsForFolder(folderId?: string): ResumeVersion[] {
  const key = folderKey(folderId)
  return readResumeSnapshotsLocal()
    .filter((r) => folderKey(r.folderId) === key)
    .map(expandCompactResume)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function readResumeDraftLocal(): ResumeDraftRecord | null {
  const raw = readLocalJsonSafe<{
    resumeId?: string
    folderId?: string
    updatedAt?: number
    compact?: unknown
  }>(LOCAL_STORE_KEYS.currentResumeDraft, false)
  if (!raw || typeof raw !== "object" || !raw.compact) return null
  const compact = wireToCompact(raw.compact)
  if (!compact) return null
  return {
    resumeId: raw.resumeId ?? compact.id,
    folderId: raw.folderId ?? compact.folderId,
    updatedAt: raw.updatedAt ?? compact.updatedAt,
    compact,
  }
}

export function readResumeDraftAsVersion(): ResumeVersion | null {
  const draft = readResumeDraftLocal()
  if (!draft?.compact) return null
  return expandCompactResume(draft.compact)
}

function pruneSnapshotWires(
  wires: WireSnapshot[],
  folderId?: string,
  max = MAX_RESUME_SNAPSHOTS_PER_FOLDER,
): WireSnapshot[] {
  const key = folderKey(folderId)
  const inFolder = wires
    .filter((r) => folderKey(r.f) === key)
    .sort((a, b) => b.u - a.u)
  const others = wires.filter((r) => folderKey(r.f) !== key)
  return [...others, ...inFolder.slice(0, max)]
}

function writeSnapshotWires(wires: WireSnapshot[]): LocalResumeWriteResult {
  const onQuota = () => enforceLocalStorageBudget({ clearSnapshots: true })

  const result = writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.resumeVersions, wires, onQuota)
  if (result.ok) {
    return result.warning
      ? { ok: true, warning: result.warning }
      : { ok: true }
  }

  const pruned = [...wires].sort((a, b) => b.u - a.u).slice(0, Math.max(3, Math.floor(wires.length / 2)))
  const retry = writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.resumeVersions, pruned, onQuota)
  if (retry.ok) {
    return {
      ok: true,
      warning:
        retry.warning ??
        "Browser storage was full. Older saved versions were removed.",
    }
  }

  return { ok: false, warning: STORAGE_FULL_MESSAGE }
}

function writeDraftRecord(draft: ResumeDraftRecord): LocalResumeWriteResult {
  const payload = {
    v: WIRE_VERSION,
    resumeId: draft.resumeId,
    folderId: draft.folderId,
    updatedAt: draft.updatedAt,
    compact: wireFromCompact(draft.compact),
  }
  const result = writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.currentResumeDraft, payload, () => {
    try {
      localStorage.removeItem(LOCAL_STORE_KEYS.currentResumeDraft)
    } catch {
      /* ignore */
    }
    enforceLocalStorageBudget({ clearSnapshots: true })
  })
  if (result.ok) return result

  const smaller = {
    ...payload,
    compact: wireFromCompact(
      compactResumeForLocal(expandCompactResume(draft.compact), 24_000),
    ),
  }
  const retry = writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.currentResumeDraft, smaller, () => {
    enforceLocalStorageBudget({ clearSnapshots: true })
  })
  return retry
}

/** Autosave only — overwrites single draft, never appends snapshot list. */
export function saveResumeDraftLocal(resume: ResumeVersion): LocalResumeWriteResult {
  enforceLocalStorageBudget()
  const compact = compactResumeForLocal(resume, MAX_DRAFT_RESUME_TEXT)
  const draft: ResumeDraftRecord = {
    resumeId: compact.id,
    folderId: compact.folderId,
    updatedAt: compact.updatedAt,
    compact,
  }
  return writeDraftRecord(draft)
}

/** Manual named save — appends/updates pruned snapshot list only (never autosave). */
export function saveResumeSnapshotLocal(resume: ResumeVersion): LocalResumeWriteResult {
  enforceLocalStorageBudget()

  const compact = compactResumeForLocal(resume, MAX_SNAPSHOT_RESUME_TEXT)
  const wire = wireFromCompact(compact)

  const existing = readSnapshotWires().filter((w) => w.i !== wire.i)
  const merged = [wire, ...existing]
  const pruned = pruneSnapshotWires(merged, compact.folderId)

  return writeSnapshotWires(pruned)
}

export function writeResumeSnapshotsForFolder(
  folderId: string | undefined,
  resumes: ResumeVersion[],
): LocalResumeWriteResult {
  enforceLocalStorageBudget()
  const wires = resumes.map((r) => wireFromCompact(compactResumeForLocal(r)))
  const key = folderKey(folderId)
  const others = readSnapshotWires().filter((w) => folderKey(w.f) !== key)
  const pruned = pruneSnapshotWires([...wires, ...others], folderId)
  return writeSnapshotWires(pruned)
}

export function removeResumeFromLocalStores(id: string): void {
  const remaining = readSnapshotWires().filter((w) => w.i !== id)
  writeJsonWithQuotaRecovery(LOCAL_STORE_KEYS.resumeVersions, remaining, () =>
    enforceLocalStorageBudget({ clearSnapshots: true }),
  )
  const draft = readResumeDraftLocal()
  if (draft?.resumeId === id) {
    try {
      localStorage.removeItem(LOCAL_STORE_KEYS.currentResumeDraft)
    } catch {
      /* ignore */
    }
  }
}

export function clearLocalSavedResumeVersions(): { snapshots: number; hadDraft: boolean } {
  const snapshots = readResumeSnapshotsLocal().length
  const hadDraft = Boolean(readResumeDraftLocal())
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LOCAL_STORE_KEYS.resumeVersions)
      localStorage.removeItem(LOCAL_STORE_KEYS.currentResumeDraft)
    } catch {
      /* ignore */
    }
  }
  return { snapshots, hadDraft }
}

export { clearAllCvLocalStorage }

function pickNewerResume(existing: ResumeVersion, next: ResumeVersion): ResumeVersion {
  const existingHasText = Boolean(existing.resumeText?.trim())
  const nextHasText = Boolean(next.resumeText?.trim())
  if (nextHasText && !existingHasText) return next
  if (existingHasText && !nextHasText) return existing
  return next.updatedAt >= existing.updatedAt ? next : existing
}

export function mergeResumesWithDraft(
  primary: ResumeVersion[],
  secondary: ResumeVersion[],
  draft: ResumeVersion | null,
): ResumeVersion[] {
  const byId = new Map<string, ResumeVersion>()
  for (const r of secondary) {
    byId.set(r.id, lightNormalizeResume(r))
  }
  for (const r of primary) {
    const existing = byId.get(r.id)
    const next = lightNormalizeResume(r)
    byId.set(r.id, existing ? pickNewerResume(existing, next) : next)
  }
  if (draft) {
    const d = lightNormalizeResume(draft)
    const existing = byId.get(d.id)
    byId.set(d.id, existing ? pickNewerResume(existing, d) : d)
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Refresh local resume snapshots from a successful cloud load (prefer rows with CV text). */
export function upsertResumeSnapshotsFromCloud(resumes: ResumeVersion[]): LocalResumeWriteResult {
  const withText = resumes.filter((r) => r.resumeText?.trim())
  if (withText.length === 0) return { ok: true }

  const byId = new Map(readSnapshotWires().map((wire) => [wire.i, wire]))
  for (const resume of withText) {
    const normalized = lightNormalizeResume(resume)
    const existingWire = byId.get(normalized.id)
    const existingCompact = existingWire ? wireToCompact(existingWire) : null
    const existing = existingCompact ? expandCompactResume(existingCompact) : null
    const shouldWrite =
      !existing ||
      !existing.resumeText?.trim() ||
      normalized.updatedAt >= existing.updatedAt
    if (shouldWrite) {
      byId.set(normalized.id, wireFromCompact(compactResumeForLocal(normalized)))
    }
  }

  return writeSnapshotWires([...byId.values()])
}
