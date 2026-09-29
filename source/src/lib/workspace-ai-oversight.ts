import { mergeAiActivityLog, type AiActivityEntry } from "@/lib/ai-activity-log"
import { providerDisplayName } from "@/lib/ai-transparency"
import type { ResumeVersion } from "@/lib/types"

const FEATURE_LABELS: Record<string, string> = {
  cover_letter_generation: "Cover Letter Generation",
  cover_letter_edit: "Cover Letter Editing",
  "CV edit": "CV Tailoring",
  "Selection rewrite": "Selection Rewrite",
}

export type WorkspaceAiOversight = {
  hasActivity: boolean
  recentActions: string[]
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  allSuggestionsReviewed: boolean
  providerLabel: string | null
  model: string | null
  featuresUsed: string[]
}

function humanizeFeature(feature?: string): string | null {
  if (!feature?.trim()) return null
  const trimmed = feature.trim()
  return FEATURE_LABELS[trimmed] ?? trimmed
}

function collectRecentActions(log: AiActivityEntry[], limit = 6): string[] {
  const seen = new Set<string>()
  const actions: string[] = []

  for (const entry of [...log].reverse()) {
    const label = entry.action?.trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    actions.push(label)
    if (actions.length >= limit) break
  }

  return actions
}

function collectFeaturesUsed(log: AiActivityEntry[]): string[] {
  const seen = new Set<string>()
  const features: string[] = []

  for (const entry of log) {
    const label = humanizeFeature(entry.feature)
    if (!label || seen.has(label)) continue
    seen.add(label)
    features.push(label)
  }

  return features
}

function latestModelEntry(log: AiActivityEntry[]): AiActivityEntry | null {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].model?.trim() && log[i].model !== "Unknown") return log[i]
  }
  return log.length > 0 ? log[log.length - 1] : null
}

export function buildWorkspaceAiOversight(
  folderId: string | null | undefined,
  resumes: ResumeVersion[],
): WorkspaceAiOversight {
  if (!folderId) {
    return {
      hasActivity: false,
      recentActions: [],
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      allSuggestionsReviewed: false,
      providerLabel: null,
      model: null,
      featuresUsed: [],
    }
  }

  const log = mergeAiActivityLog(resumes, folderId)

  let approvedCount = 0
  let rejectedCount = 0
  let pendingCount = 0

  for (const entry of log) {
    if (entry.approvalStatus === "approved") approvedCount++
    else if (entry.approvalStatus === "rejected") rejectedCount++
    else pendingCount++
  }

  const latest = latestModelEntry(log)
  const featuresFromLog = collectFeaturesUsed(log)
  const featuresUsed =
    featuresFromLog.length > 0
      ? featuresFromLog
      : approvedCount > 0
        ? ["CV Tailoring"]
        : []

  return {
    hasActivity: log.length > 0,
    recentActions: collectRecentActions(log),
    approvedCount,
    rejectedCount,
    pendingCount,
    allSuggestionsReviewed: log.length > 0 && pendingCount === 0 && approvedCount > 0,
    providerLabel:
      latest?.providerLabel ??
      (latest?.provider ? providerDisplayName(latest.provider) : null),
    model: latest?.model && latest.model !== "Unknown" ? latest.model : null,
    featuresUsed,
  }
}
