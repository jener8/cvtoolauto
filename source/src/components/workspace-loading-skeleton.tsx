"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { WorkspaceShell } from "@/components/workspace-sidebar"

type WorkspaceLoadingSkeletonProps = {
  folderName?: string
  userName?: string
  stage: string
  progress: number
}

function CardSkeleton() {
  return (
    <div className="ui-workspace-card workspace-skeleton-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="workspace-skeleton-block h-4 w-2/5" />
          <Skeleton className="workspace-skeleton-block h-3 w-1/3" />
        </div>
        <Skeleton className="workspace-skeleton-block h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="workspace-skeleton-block h-7 w-24 rounded-full" />
        <Skeleton className="workspace-skeleton-block h-7 w-28 rounded-full" />
      </div>
    </div>
  )
}

export function WorkspaceLoadingSkeleton({
  folderName,
  userName,
  stage,
  progress,
}: WorkspaceLoadingSkeletonProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <WorkspaceShell
      workspaceName={folderName}
      userName={userName}
      activeNav="careerHome"
      footerVariant="new-application"
    >
      <div className="workspace-load p-6 space-y-6" aria-busy="true" aria-live="polite">
        <div className="workspace-load__progress" aria-hidden>
          <div
            className="workspace-load__progress-bar"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        <div className="space-y-1">
          <p className="workspace-load__title">Loading workspace…</p>
          <p className="workspace-load__stage">{stage}</p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="workspace-skeleton-block h-6 w-48" />
            <Skeleton className="workspace-skeleton-block h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="workspace-skeleton-block h-11 w-11 rounded-full shrink-0" />
        </div>

        <div className="ui-stat-grid" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ui-stat-card space-y-2">
              <Skeleton className="workspace-skeleton-block h-3 w-16" />
              <Skeleton className="workspace-skeleton-block h-7 w-10" />
            </div>
          ))}
        </div>

        <div className="ui-toolbar-row" aria-hidden>
          <Skeleton className="workspace-skeleton-block h-11 flex-1 min-w-[200px]" />
          <Skeleton className="workspace-skeleton-block h-11 w-32" />
          <Skeleton className="workspace-skeleton-block h-11 w-32" />
        </div>

        <section className="space-y-3" aria-label="Loading applications">
          <Skeleton className="workspace-skeleton-block h-4 w-28" />
          <div className="grid gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>

        <section className="space-y-3 pt-2" aria-label="Loading resumes">
          <Skeleton className="workspace-skeleton-block h-4 w-36" />
          <div className="grid gap-3 sm:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>
      </div>
    </WorkspaceShell>
  )
}
