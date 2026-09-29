import {
  parseVersionedResumeName,
  resumeNameFromApplicationTitle,
} from "@/lib/application-resume-naming"
import type { ResumeVersion } from "@/lib/types"

function inferEditSuffix(instruction: string): string {
  const m = instruction.toLowerCase()
  if (/ats|keyword/.test(m)) return "ATS-optimized version"
  if (/senior/.test(m)) return "Senior-focused version"
  if (/strategic/.test(m)) return "Strategy-focused version"
  if (/leadership/.test(m)) return "Leadership-focused version"
  if (/ai focus|ai-tailor|artificial intelligence/.test(m)) return "AI-focused version"
  if (/shorter|concise/.test(m)) return "Concise version"
  if (/stronger|relevant|tailor/.test(m)) return "AI-tailored version"
  return "AI-edited version"
}

export function buildAiEditVersionName(opts: {
  instruction: string
  applicationTitle?: string
  currentVersionName?: string
}): string {
  const fromTitle = opts.applicationTitle?.trim()
  const fromVersion = opts.currentVersionName?.trim()
  const base = fromTitle
    ? resumeNameFromApplicationTitle(fromTitle)
    : fromVersion
      ? parseVersionedResumeName(fromVersion).base
      : "Resume"
  const suffix = inferEditSuffix(opts.instruction)
  return `${base} — ${suffix}`
}

export function uniqueAiEditVersionName(
  proposedName: string,
  versions: ResumeVersion[],
): string {
  const names = new Set(versions.map((v) => v.name.trim()))
  if (!names.has(proposedName)) return proposedName

  const { base } = parseVersionedResumeName(proposedName)
  let n = 2
  while (names.has(`${base} v${n}`)) n++
  return `${base} v${n}`
}
