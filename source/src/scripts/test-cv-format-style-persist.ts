/**
 * CV style must survive draft autosave → reopen (not snap back to Executive compact).
 * Run: npx tsx scripts/test-cv-format-style-persist.ts
 */
import assert from "node:assert/strict"
import {
  DEFAULT_CV_FORMAT_STYLE,
  normalizeCvFormatStyle,
} from "../lib/ai-transparency"
import { normalizeContactInfo } from "../lib/contact-info"
import {
  expandCompactResume,
  mergeResumesWithDraft,
  readResumeDraftAsVersion,
  readResumeSnapshotsLocal,
  saveResumeDraftLocal,
} from "../lib/resume-local-storage"
import type { ResumeVersion } from "../lib/types"

function makeResume(formatStyle: string): ResumeVersion {
  return {
    id: "resume-style-persist-test",
    name: "HelloFresh CV",
    resumeText: "## EXPERIENCE\n# Role\nCompany\n2020 – Present\n• Did things.\n",
    profileImage: null,
    companyLogo: null,
    timestamp: Date.now(),
    createdAt: Date.now() - 10_000,
    updatedAt: Date.now(),
    folderId: "folder-style-persist",
    contactInfo: normalizeContactInfo({
      name: "Test User",
      email: "test@example.com",
      formatStyle: normalizeCvFormatStyle(formatStyle),
    }),
  }
}

const originalLocalStorage = globalThis.localStorage
const store = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return store.size
  },
  clear() {
    store.clear()
  },
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null
  },
  key(index: number) {
    return [...store.keys()][index] ?? null
  },
  removeItem(key: string) {
    store.delete(key)
  },
  setItem(key: string, value: string) {
    store.set(key, String(value))
  },
}

// @ts-expect-error test shim
globalThis.localStorage = memoryStorage
// @ts-expect-error jsdom-less window for storage helpers
globalThis.window = globalThis

try {
  const styled = makeResume("modern-spacious")
  assert.equal(styled.contactInfo.formatStyle, "modern-spacious")

  const save = saveResumeDraftLocal(styled)
  assert.equal(save.ok, true, save.warning)

  const draft = readResumeDraftAsVersion()
  assert.ok(draft, "draft missing")
  assert.equal(
    draft!.contactInfo.formatStyle,
    "modern-spacious",
    "draft must keep modern-spacious",
  )

  const snapshots = readResumeSnapshotsLocal()
  const snap = snapshots.find((s) => s.id === styled.id)
  assert.ok(snap, "snapshot must be updated on draft save")
  assert.equal(
    snap!.contactInfo.formatStyle,
    "modern-spacious",
    "snapshot must keep modern-spacious (reopen path)",
  )

  // Simulate stale snapshot without fs + newer draft — merge must prefer draft style
  const stale: ResumeVersion = {
    ...styled,
    updatedAt: styled.updatedAt - 5_000,
    contactInfo: normalizeContactInfo({
      ...styled.contactInfo,
      formatStyle: DEFAULT_CV_FORMAT_STYLE,
    }),
  }
  const merged = mergeResumesWithDraft([stale], [], draft)
  assert.equal(merged.length, 1)
  assert.equal(
    merged[0]!.contactInfo.formatStyle,
    "modern-spacious",
    "draft merge must win over stale executive-compact snapshot",
  )

  // Wire round-trip: non-default style survives compact → expand
  const roundTrip = expandCompactResume({
    id: styled.id,
    name: styled.name,
    updatedAt: styled.updatedAt,
    createdAt: styled.createdAt,
    folderId: styled.folderId,
    resumeText: styled.resumeText,
    contactInfo: styled.contactInfo,
  })
  assert.equal(roundTrip.contactInfo.formatStyle, "modern-spacious")

  console.log("test-cv-format-style-persist: ok")
} finally {
  // @ts-expect-error restore
  globalThis.localStorage = originalLocalStorage
}
