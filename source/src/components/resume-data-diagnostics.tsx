"use client"

import type { JobApplication, ResumeVersion } from "@/lib/types"

/** Dev-only diagnostics — disabled; never shown to users. */
export function ResumeDataDiagnostics(_props: {
  application?: JobApplication | null
  resume?: ResumeVersion | null
  snapshotId?: string | null
}) {
  return null
}
