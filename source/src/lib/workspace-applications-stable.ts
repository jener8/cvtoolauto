import type { JobApplication } from "@/lib/types"

function applicationLinkSignature(app: JobApplication): string {
  return [
    app.id,
    app.resumeVersionId?.trim() ?? "",
    app.coverLetterId?.trim() ?? "",
  ].join(":")
}

/** Stable ordering key for comparing application lists without flicker. */
export function jobApplicationListSignature(apps: JobApplication[]): string {
  return apps
    .map((app) => applicationLinkSignature(app))
    .sort()
    .join("|")
}

/**
 * When remote sync fails, never replace a populated UI with an empty or smaller list.
 * Prefer the previous stable list, then local cache, then the incoming list.
 */
export function pickStableJobApplications(
  incoming: JobApplication[],
  options: {
    previous: JobApplication[]
    localFallback: JobApplication[]
    remoteFailed: boolean
    folderId: string
  },
): JobApplication[] {
  const { previous, localFallback, remoteFailed, folderId } = options
  const scope = (apps: JobApplication[]) =>
    apps.filter((app) => !app.folderId || app.folderId === folderId)

  const scopedIncoming = scope(incoming)
  const scopedPrevious = scope(previous)
  const scopedLocal = scope(localFallback)

  if (!remoteFailed) {
    return scopedIncoming
  }

  if (scopedIncoming.length > 0) {
    return scopedIncoming
  }

  if (scopedPrevious.length > 0) {
    return scopedPrevious
  }

  if (scopedLocal.length > 0) {
    return scopedLocal
  }

  return scopedIncoming
}

export function shouldSkipApplicationsUiUpdate(
  current: JobApplication[],
  next: JobApplication[],
): boolean {
  return jobApplicationListSignature(current) === jobApplicationListSignature(next)
}
