export const STRATEGIC_PROFILE_STORAGE_KEY = "strategic-profile"

/** User-level career positioning — persists across applications (localStorage). */
export interface StrategicProfile {
  /** What kinds of roles are you targeting? */
  careerDirection?: string
  /** What makes you different professionally? */
  professionalStrengths?: string
  /** What should applications emphasize? */
  strategicEmphasis?: string
  /** What should applications avoid emphasizing? */
  avoidDownplay?: string
  /** How should the application sound? e.g. executive, warm, strategic */
  writingTone?: string
  /** What broader direction are you moving toward? */
  longTermGoal?: string
  /** Notice period or earliest start date for application forms. */
  noticePeriod?: string
  updatedAt?: number
}

export function emptyStrategicProfile(): StrategicProfile {
  return {}
}

export function hasStrategicProfileContent(profile: StrategicProfile | null | undefined): boolean {
  if (!profile) return false
  return Boolean(
    profile.careerDirection?.trim() ||
      profile.professionalStrengths?.trim() ||
      profile.strategicEmphasis?.trim() ||
      profile.avoidDownplay?.trim() ||
      profile.writingTone?.trim() ||
      profile.longTermGoal?.trim() ||
      profile.noticePeriod?.trim(),
  )
}

export function loadStrategicProfile(): StrategicProfile {
  if (typeof window === "undefined") return emptyStrategicProfile()
  try {
    const raw = localStorage.getItem(STRATEGIC_PROFILE_STORAGE_KEY)
    if (!raw) return emptyStrategicProfile()
    const parsed = JSON.parse(raw) as Partial<StrategicProfile>
    if (typeof parsed !== "object" || parsed === null) return emptyStrategicProfile()
    return {
      careerDirection:
        typeof parsed.careerDirection === "string" ? parsed.careerDirection : undefined,
      professionalStrengths:
        typeof parsed.professionalStrengths === "string"
          ? parsed.professionalStrengths
          : undefined,
      strategicEmphasis:
        typeof parsed.strategicEmphasis === "string" ? parsed.strategicEmphasis : undefined,
      avoidDownplay:
        typeof parsed.avoidDownplay === "string" ? parsed.avoidDownplay : undefined,
      writingTone: typeof parsed.writingTone === "string" ? parsed.writingTone : undefined,
      longTermGoal:
        typeof parsed.longTermGoal === "string" ? parsed.longTermGoal : undefined,
      noticePeriod:
        typeof parsed.noticePeriod === "string" ? parsed.noticePeriod : undefined,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
    }
  } catch {
    return emptyStrategicProfile()
  }
}

export function saveStrategicProfile(profile: StrategicProfile): void {
  if (typeof window === "undefined") return
  const normalized: StrategicProfile = {
    ...profile,
    updatedAt: Date.now(),
  }
  localStorage.setItem(STRATEGIC_PROFILE_STORAGE_KEY, JSON.stringify(normalized))
}

export function patchStrategicProfile(patch: Partial<StrategicProfile>): StrategicProfile {
  const existing = loadStrategicProfile()
  const merged: StrategicProfile = { ...existing, ...patch, updatedAt: Date.now() }
  saveStrategicProfile(merged)
  return merged
}
