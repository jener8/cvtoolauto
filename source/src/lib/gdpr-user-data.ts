import { loadFolderAiActivity } from "@/lib/ai-activity-log"
import { AI_TOOL_NAME } from "@/lib/ai-transparency"
import { loadStatisticsChat } from "@/lib/statistics-chat-storage"
import { LOCAL_STORE_KEYS, readLocalStore, writeLocalStore } from "@/lib/supabase/local-store"
import type { CoverLetter, Folder, JobApplication, ResumeVersion } from "@/lib/types"
import { loadUserProfile, PROFILE_STORAGE_KEY, type UserProfile } from "@/lib/user-profile"
import {
  clearAllCvLocalStorage,
  deleteResume,
  loadCoverLetters,
  loadJobApplications,
  loadResumeVersions,
  saveCoverLetters,
  saveJobApplications,
  saveResumeVersions,
} from "@/lib/storage"
import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"

export type UserDataExport = {
  exportedAt: string
  tool: string
  profile: UserProfile | null
  folders: Folder[]
  resumes: ResumeVersion[]
  jobApplications: JobApplication[]
  coverLetters: CoverLetter[]
  aiActivityByFolder: Record<string, ReturnType<typeof loadFolderAiActivity>>
  statisticsChats: Record<string, unknown[]>
  sessionAiChats: Record<string, unknown[]>
}

function collectSessionAiChats(): Record<string, unknown[]> {
  const chats: Record<string, unknown[]> = {}
  if (typeof window === "undefined") return chats
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (!key) continue
    if (
      key.startsWith("unified-assistant-chat:") ||
      key.startsWith("strategic-assistant-chat:") ||
      key.startsWith("resume-assistant-chat:") ||
      key.startsWith("statistics-strategy-chat:")
    ) {
      try {
        const raw = sessionStorage.getItem(key)
        if (raw) chats[key] = JSON.parse(raw) as unknown[]
      } catch {
        /* skip */
      }
    }
  }
  return chats
}

export async function collectAllUserData(folderId?: string): Promise<UserDataExport> {
  const folders = readLocalStore<Folder>(LOCAL_STORE_KEYS.folders)
  const resumes = await loadResumeVersions(folderId)
  const jobApplications = await loadJobApplications(folderId)
  const coverLetters = await loadCoverLetters(folderId)

  const aiActivityByFolder: Record<string, ReturnType<typeof loadFolderAiActivity>> = {}
  const statisticsChats: Record<string, unknown[]> = {}

  const folderIds = folderId ? [folderId] : folders.map((f) => f.id)
  for (const fid of folderIds) {
    aiActivityByFolder[fid] = loadFolderAiActivity(fid)
    statisticsChats[fid] = loadStatisticsChat(fid) as unknown[]
  }

  return {
    exportedAt: new Date().toISOString(),
    tool: AI_TOOL_NAME,
    profile: loadUserProfile(),
    folders: folderId ? folders.filter((f) => f.id === folderId) : folders,
    resumes,
    jobApplications,
    coverLetters,
    aiActivityByFolder,
    statisticsChats,
    sessionAiChats: collectSessionAiChats(),
  }
}

export function downloadUserDataJson(data: UserDataExport, filename?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename ?? `cv-tool-data-export-${data.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/** Minimal store-only ZIP (uncompressed) for GDPR portability bundle. */
export function downloadUserDataZip(data: UserDataExport): void {
  const files: { path: string; content: string }[] = [
    { path: "export.json", content: JSON.stringify(data, null, 2) },
    { path: "README.txt", content: `${AI_TOOL_NAME} — personal data export\nExported: ${data.exportedAt}\n\nOpen export.json for machine-readable data.\n` },
  ]

  for (const resume of data.resumes) {
    files.push({
      path: `cvs/${sanitizePath(resume.name || resume.id)}.md`,
      content: resume.resumeText,
    })
  }

  for (const letter of data.coverLetters) {
    files.push({
      path: `cover-letters/${sanitizePath(letter.name || letter.id)}.txt`,
      content: [letter.contentEn, letter.contentDe].filter(Boolean).join("\n\n---\n\n"),
    })
  }

  const blob = buildStoreZip(files)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `cv-tool-data-export-${data.exportedAt.slice(0, 10)}.zip`
  link.click()
  URL.revokeObjectURL(url)
}

function sanitizePath(name: string): string {
  return name.replace(/[^\w\s-]/g, "").trim().slice(0, 80) || "untitled"
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildStoreZip(files: { path: string; content: string }[]): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.path)
    const dataBytes = encoder.encode(file.content)
    const crc = crc32(dataBytes)
    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(8, 0, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, dataBytes.length, true)
    view.setUint32(22, dataBytes.length, true)
    view.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(dataBytes, 30 + nameBytes.length)
    parts.push(local)

    const centralEntry = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralEntry.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, dataBytes.length, true)
    cv.setUint32(24, dataBytes.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    centralEntry.set(nameBytes, 46)
    central.push(centralEntry)

    offset += local.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...parts, ...central, end], { type: "application/zip" })
}

export async function deleteAllResumes(folderId?: string): Promise<number> {
  const resumes = await loadResumeVersions(folderId)
  for (const resume of resumes) {
    await deleteResume(resume.id, folderId)
  }
  if (!folderId) {
    writeLocalStore(LOCAL_STORE_KEYS.resumeVersions, [])
  } else {
    const all = await loadResumeVersions()
    writeLocalStore(
      LOCAL_STORE_KEYS.resumeVersions,
      all.filter((r) => r.folderId !== folderId),
    )
  }
  return resumes.length
}

export async function deleteAllCoverLetters(folderId?: string): Promise<number> {
  const letters = await loadCoverLetters(folderId)
  if (folderId) {
    const all = await loadCoverLetters()
    await saveCoverLetters(all.filter((l) => l.folderId !== folderId))
  } else {
    await saveCoverLetters([])
  }

  if (!shouldUseLocalFallback()) {
    const supabase = getSupabaseClient()
    if (supabase) {
      let query = supabase.from("cover_letters").delete()
      if (folderId) query = query.eq("folder_id", folderId)
      await query
    }
  }
  return letters.length
}

export async function deleteAllJobApplications(folderId?: string): Promise<number> {
  const apps = await loadJobApplications(folderId)
  if (folderId) {
    const all = await loadJobApplications()
    await saveJobApplications(all.filter((a) => a.folderId !== folderId), folderId)
  } else {
    await saveJobApplications([])
  }

  if (!shouldUseLocalFallback()) {
    const supabase = getSupabaseClient()
    if (supabase) {
      let query = supabase.from("job_applications").delete()
      if (folderId) query = query.eq("folder_id", folderId)
      await query
    }
  }
  return apps.length
}

export async function deleteAllAccountData(): Promise<void> {
  clearAllCvLocalStorage()
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith("cv_") || key?.includes("assistant-chat")) {
        sessionStorage.removeItem(key)
      }
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith("cv_ai_activity_log:")) {
        localStorage.removeItem(key)
      }
    }
  }
}
