"use client"

import { OutcomeOptionGrid } from "@/components/application-pipeline-status-control"
import { PipelineStageOutcomeBadge } from "@/components/pipeline-stage-outcome-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  APPLICATION_STAGES,
  getPipeline,
  nextStage,
  updateStageRecord,
  type ApplicationStage,
  type StageOutcome,
} from "@/lib/application-pipeline"
import { formatDateInputValue, parseDateInputValue } from "@/lib/application-dates"
import { formatApplicationDate } from "@/lib/job-application-display"
import { getStageLabel, type Language } from "@/lib/translations"
import type { ApplicationStageRecord, JobApplication } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

function toDateInputValue(timestamp?: number) {
  return formatDateInputValue(timestamp)
}

export interface ApplicationPipelineEditorProps {
  job: JobApplication
  language: Language
  onUpdateJob: (id: string, updates: Partial<JobApplication>) => void
  compact?: boolean
}

export function ApplicationPipelineEditor({
  job,
  language,
  onUpdateJob,
  compact = false,
}: ApplicationPipelineEditorProps) {
  const pipeline = getPipeline(job)
  const [expandedStages, setExpandedStages] = useState<Set<ApplicationStage>>(
    () => new Set([pipeline[pipeline.length - 1]?.stage ?? "applied"]),
  )

  const savePipeline = (nextPipeline: ApplicationStageRecord[]) => {
    onUpdateJob(job.id, { pipeline: nextPipeline })
  }

  const updateRecord = (
    stage: ApplicationStage,
    updates: Partial<ApplicationStageRecord>,
  ) => {
    savePipeline(updateStageRecord(pipeline, stage, updates))
  }

  const addNextStage = () => {
    const current = pipeline[pipeline.length - 1]
    const following = nextStage(current.stage)
    if (!following) return
    savePipeline([...pipeline, { stage: following, outcome: "pending" }])
    setExpandedStages((prev) => new Set([...prev, following]))
  }

  const toggleExpanded = (stage: ApplicationStage) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  const visibleStages = APPLICATION_STAGES.filter((stage) =>
    pipeline.some((record) => record.stage === stage),
  )

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Track each hiring stage with an outcome. Mark a stage as Passed to advance to the next
          stage. Terminal outcomes stop the pipeline.
        </p>
      )}

      <div className="space-y-2">
        {visibleStages.map((stage, index) => {
          const record = pipeline.find((entry) => entry.stage === stage)!
          const expanded = expandedStages.has(stage)
          const isCurrent = index === visibleStages.length - 1

          return (
            <div
              key={stage}
              className={cn(
                "rounded-lg border",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                onClick={() => toggleExpanded(stage)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">{getStageLabel(language, stage)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <PipelineStageOutcomeBadge
                        stage={record.stage}
                        outcome={record.outcome}
                        language={language}
                      />
                      {record.date && (
                        <span className="text-xs text-muted-foreground">
                          {formatApplicationDate(record.date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="border-t px-3 py-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <OutcomeOptionGrid
                        stage={stage}
                        outcome={record.outcome}
                        language={language}
                        onOutcomeChange={(outcome) => updateRecord(stage, { outcome })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {stage === "applied" ? "Application date" : "Interview / stage date"}
                      </Label>
                      <Input
                        type="date"
                        value={toDateInputValue(record.date)}
                        onChange={(e) => {
                          const value = e.target.value
                          if (!value) {
                            updateRecord(stage, { date: undefined })
                            return
                          }
                          const parsed = parseDateInputValue(value)
                          if (parsed != null) {
                            updateRecord(stage, { date: parsed })
                            if (stage === "applied") {
                              onUpdateJob(job.id, { appliedDate: parsed })
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={record.notes ?? ""}
                      onChange={(e) => updateRecord(stage, { notes: e.target.value })}
                      placeholder="Interview feedback, contacts, follow-up actions…"
                      rows={compact ? 2 : 3}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {nextStage(pipeline[pipeline.length - 1]?.stage ?? "applied") && (
        <Button type="button" variant="outline" size="sm" onClick={addNextStage}>
          Add next stage
        </Button>
      )}
    </div>
  )
}
