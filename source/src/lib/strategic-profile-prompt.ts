import type { StrategicProfile } from "@/lib/strategic-profile"
import { hasStrategicProfileContent } from "@/lib/strategic-profile"

function line(label: string, value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return `- ${label}: ${trimmed}`
}

/** Block injected into AI prompts — guides emphasis/tone; must not appear verbatim in output unless relevant. */
export function formatStrategicProfilePromptBlock(
  profile: StrategicProfile | null | undefined,
  outputLanguage: "en" | "de" = "en",
): string {
  if (!hasStrategicProfileContent(profile)) return ""

  const isDe = outputLanguage === "de"
  const header = isDe
    ? `STRATEGISCHE POSITIONIERUNG (Nutzerpräferenzen — steuern Betonung und Ton; nicht wörtlich in den Lebenslauf übernehmen, außer wenn natürlich passend; keine Fakten erfinden):`
    : `STRATEGIC POSITIONING (user preferences — guide emphasis and tone; do NOT paste verbatim into the CV unless naturally relevant; do not invent facts):`

  const lines = [
    line(
      isDe ? "Zielrollen / Karriererichtung" : "Target roles / career direction",
      profile?.careerDirection,
    ),
    line(
      isDe ? "Professionelle Stärken" : "Professional strengths",
      profile?.professionalStrengths,
    ),
    line(
      isDe ? "Strategische Betonung" : "Strategic emphasis",
      profile?.strategicEmphasis,
    ),
    line(isDe ? "Vermeiden / zurücknehmen" : "Avoid / downplay", profile?.avoidDownplay),
    line(isDe ? "Schreibton" : "Writing tone", profile?.writingTone),
    line(isDe ? "Langfristiges Karriereziel" : "Long-term career goal", profile?.longTermGoal),
    line(isDe ? "Kündigungsfrist / Verfügbarkeit" : "Notice period / availability", profile?.noticePeriod),
  ].filter((l): l is string => l !== null)

  if (lines.length === 0) return ""

  const guidance = isDe
    ? "Nutze diese Hinweise zusammen mit Stellenbeschreibung und Lebenslauf, um zukünftige Bewerbungen besser auszurichten — nicht als zusätzlichen Lebenslauf-Abschnitt."
    : "Use this guidance together with the job description and CV to steer tailoring — not as an extra resume section."

  return `\n${header}\n${lines.join("\n")}\n${guidance}\n`
}

/** Appends strategic block to an existing prompt string when profile has content. */
export function appendStrategicProfileToPrompt(
  basePrompt: string,
  profile: StrategicProfile | null | undefined,
  outputLanguage: "en" | "de" = "en",
): string {
  const block = formatStrategicProfilePromptBlock(profile, outputLanguage)
  if (!block.trim()) return basePrompt
  return `${basePrompt.trim()}\n${block}`
}
