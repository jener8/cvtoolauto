"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { WorkspaceLoadingSkeleton } from "@/components/workspace-loading-skeleton"
import { setPendingWorkspaceSlug } from "@/lib/cv-workspace-routing"

export default function WorkspaceEntryPage() {
  const router = useRouter()
  const params = useParams()
  const slug = typeof params.slug === "string" ? params.slug : ""

  useEffect(() => {
    if (slug) {
      setPendingWorkspaceSlug(slug)
    }
    router.replace("/app")
  }, [slug, router])

  return (
    <WorkspaceLoadingSkeleton
      stage="Opening workspace…"
      progress={20}
    />
  )
}
