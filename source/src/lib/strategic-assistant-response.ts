import type { StrategicProfile } from "@/lib/strategic-profile"
import { STRATEGIC_PROFILE_FIELD_KEYS } from "@/lib/strategic-assistant-prompt"

export function extractStrategicAssistantResponse(raw: string): {
  reply: string
  profilePatch: Partial<StrategicProfile>
} {
  const profilePatch: Partial<StrategicProfile> = {}
  let reply = raw.trim()

  const updateMatch = raw.match(/PROFILE_UPDATE:\s*```(?:json)?\s*([\s\S]*?)```/i)
  if (updateMatch?.[1]) {
    try {
      const parsed = JSON.parse(updateMatch[1].trim()) as Record<string, unknown>
      for (const key of STRATEGIC_PROFILE_FIELD_KEYS) {
        if (typeof parsed[key] === "string" && parsed[key].trim()) {
          profilePatch[key] = parsed[key].trim()
        }
      }
      reply = raw.slice(0, updateMatch.index).trim()
    } catch {
      console.warn("[strategic-assistant] Failed to parse PROFILE_UPDATE JSON")
    }
  }

  reply = reply.replace(/PROFILE_UPDATE:[\s\S]*$/i, "").trim()

  return { reply, profilePatch }
}
