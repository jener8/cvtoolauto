"use client"

import { useCallback, useEffect, useState } from "react"
import {
  UnifiedAiAssistant,
  type CoverLetterApplyPayload,
  type UnifiedAiAssistantProps,
} from "@/components/unified-ai-assistant"
import type { AiResumeEditPayload, AiResumeEditResult } from "@/lib/cv-edit-types"
import {
  loadStrategicProfile,
  saveStrategicProfile,
  type StrategicProfile,
} from "@/lib/strategic-profile"
import { foldersStorage } from "@/lib/storage"

type MobileAiCoachProps = Omit<
  UnifiedAiAssistantProps,
  "folderId" | "strategicProfile" | "onStrategicProfileChange" | "jobDescription"
> & {
  folderId?: string | null
  jobDescription?: string
}

async function resolveFolderId(preferred?: string | null): Promise<string | null> {
  if (preferred?.trim()) return preferred.trim()
  try {
    const folders = await foldersStorage.list()
    if (folders[0]?.id) return folders[0].id
    const created = await foldersStorage.create("My workspace")
    return created.id
  } catch {
    return null
  }
}

/**
 * Thin mobile wrapper around UnifiedAiAssistant (FAB + drawer).
 * Positions the FAB above the mobile bottom tab bar.
 */
export function MobileAiCoach({
  folderId: preferredFolderId,
  jobDescription = "",
  fabClassName,
  ...rest
}: MobileAiCoachProps) {
  const [folderId, setFolderId] = useState<string | null>(preferredFolderId ?? null)
  const [strategicProfile, setStrategicProfile] = useState<StrategicProfile>(() =>
    typeof window !== "undefined" ? loadStrategicProfile() : {},
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = await resolveFolderId(preferredFolderId)
      if (!cancelled) setFolderId(id)
    })()
    return () => {
      cancelled = true
    }
  }, [preferredFolderId])

  const handleProfileChange = useCallback((profile: StrategicProfile) => {
    setStrategicProfile(profile)
    saveStrategicProfile(profile)
  }, [])

  if (!folderId) return null

  return (
    <UnifiedAiAssistant
      folderId={folderId}
      jobDescription={jobDescription}
      strategicProfile={strategicProfile}
      onStrategicProfileChange={handleProfileChange}
      fabClassName={["!bottom-[5.75rem] !right-4", fabClassName].filter(Boolean).join(" ")}
      showWhenEmpty
      {...rest}
    />
  )
}

export type { CoverLetterApplyPayload, AiResumeEditPayload, AiResumeEditResult }
