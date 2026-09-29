"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { ResumePreview } from "@/components/resume-preview"
import type { ResumeVersion } from "@/lib/types"
import { getSupabaseClient } from "@/lib/supabase/client"

export default function PrintResumePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [version, setVersion] = useState<ResumeVersion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const autoprint = searchParams.get("autoprint") === "1"

  useEffect(() => {
    async function loadResume() {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) {
          setIsLoading(false)
          return
        }

        const { data, error } = await supabase.from("resume_versions").select("*").eq("id", params.id).single()

        if (error) throw error

        if (data) {
          setVersion(data as ResumeVersion)
        }
      } catch (error) {
        console.error("Error loading resume:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadResume()
  }, [params.id])

  useEffect(() => {
    if (!isLoading && version && autoprint) {
      // Wait for fonts and images to load
      const waitForAssetsAndPrint = async () => {
        // Wait for fonts
        await document.fonts.ready

        // Wait for images
        const images = Array.from(document.images)
        await Promise.all(
          images.map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) {
                  resolve(null)
                } else {
                  img.onload = () => resolve(null)
                  img.onerror = () => resolve(null)
                }
              }),
          ),
        )

        // Add a small delay to ensure layout is stable
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Trigger print
        window.print()
      }

      waitForAssetsAndPrint()
    }
  }, [isLoading, version, autoprint])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading resume...</div>
      </div>
    )
  }

  if (!version) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Resume not found</div>
      </div>
    )
  }

  return (
    <div className="print-page">
      <div className="no-print p-4 bg-gray-100 border-b">
        <p className="text-sm text-gray-600">
          Ready to print. Use your browser's print dialog (Ctrl+P / Cmd+P) to save as PDF or print.
        </p>
      </div>
      <div className="print-container">
        <ResumePreview version={version} variant="export" />
      </div>
    </div>
  )
}
