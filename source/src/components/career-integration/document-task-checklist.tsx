"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { generateTaskHowToGuidance } from "@/app/actions/generate-task-how-to"
import { setAiCoachPendingPrompt } from "@/lib/ai-coach-prefill"
import { getDefaultTaskGuidance } from "@/lib/document-tasks/default-task-guidance"
import { loadDocumentTasks, saveDocumentTasks } from "@/lib/document-tasks/storage"
import type { DocumentTask } from "@/lib/document-tasks/types"
import { cn } from "@/lib/utils"
import { Check, HelpCircle, Loader2, Plus, Sparkles, X } from "lucide-react"
import "./document-task-checklist.css"

const PANEL_DISCLAIMER =
  "This is general guidance, not legal or tax advice. Rules can vary by situation."

type DocumentTaskChecklistProps = {
  folderId: string
  onNavigateAiCoach?: () => void
}

function newCustomTaskId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function DocumentTaskChecklist({ folderId, onNavigateAiCoach }: DocumentTaskChecklistProps) {
  const listId = useId()
  const [tasks, setTasks] = useState<DocumentTask[]>([])
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [loadingGuidanceId, setLoadingGuidanceId] = useState<string | null>(null)
  const [guidanceError, setGuidanceError] = useState<string | null>(null)
  const [newTaskLabel, setNewTaskLabel] = useState("")

  useEffect(() => {
    setTasks(loadDocumentTasks(folderId))
  }, [folderId])

  const persist = useCallback(
    (next: DocumentTask[]) => {
      setTasks(next)
      saveDocumentTasks(folderId, next)
    },
    [folderId],
  )

  const resolveSteps = (task: DocumentTask): string[] | null => {
    if (task.isSystem && task.systemId) {
      return getDefaultTaskGuidance(task.systemId)?.steps ?? null
    }
    if (task.aiGuidance && task.aiGuidance.labelFingerprint === task.label.trim()) {
      return task.aiGuidance.steps
    }
    return null
  }

  const loadGuidanceIfNeeded = async (task: DocumentTask): Promise<string[] | null> => {
    const existing = resolveSteps(task)
    if (existing) return existing

    if (task.isSystem) return null

    setLoadingGuidanceId(task.id)
    setGuidanceError(null)
    const result = await generateTaskHowToGuidance({ taskLabel: task.label })
    setLoadingGuidanceId(null)

    if (!result.success || !result.steps) {
      setGuidanceError(result.error ?? "Could not generate guidance.")
      return null
    }

    let nextSteps: string[] | null = null
    setTasks((current) => {
      const updated = current.map((item) => {
        if (item.id !== task.id) return item
        nextSteps = result.steps!
        return {
          ...item,
          aiGuidance: {
            steps: result.steps!,
            generatedAt: Date.now(),
            labelFingerprint: task.label.trim(),
          },
        }
      })
      saveDocumentTasks(folderId, updated)
      return updated
    })
    return nextSteps
  }

  const toggleHowTo = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null)
      return
    }
    setExpandedTaskId(taskId)
    setGuidanceError(null)
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    if (!resolveSteps(task)) {
      await loadGuidanceIfNeeded(task)
    }
  }

  const toggleDone = (taskId: string) => {
    persist(tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)))
  }

  const deleteTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.isSystem) return
    persist(tasks.filter((item) => item.id !== taskId))
    if (expandedTaskId === taskId) setExpandedTaskId(null)
  }

  const addCustomTask = () => {
    const label = newTaskLabel.trim()
    if (!label) return
    persist([
      ...tasks,
      { id: newCustomTaskId(), label, done: false, isSystem: false },
    ])
    setNewTaskLabel("")
  }

  const askFollowUp = (task: DocumentTask, steps: string[]) => {
    const prompt = `I'm working through my "Things to take care of" checklist and need help with: "${task.label}".

Here's the general guidance I saw:
${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Can you help me understand what applies to my specific situation in Germany?`

    setAiCoachPendingPrompt(prompt)
    onNavigateAiCoach?.()
  }

  return (
    <section
      id="document-task-checklist"
      className="document-task-checklist"
      aria-labelledby={`${listId}-heading`}
    >
      <div className="document-task-checklist__intro">
        <h2 id={`${listId}-heading`} className="document-task-checklist__title">
          Things to take care of
        </h2>
        <p className="document-task-checklist__page-disclaimer" role="note">
          Guidance on this page is for planning only — not legal, tax, or immigration advice.
          Confirm details with official advisors for your situation.
        </p>
      </div>

      <ul className="document-task-checklist__list" role="list">
        {tasks.map((task) => {
          const expanded = expandedTaskId === task.id
          const steps = expanded ? resolveSteps(task) : null
          const loading = loadingGuidanceId === task.id

          return (
            <li key={task.id} className="document-task-checklist__item" role="listitem">
              <div
                className={cn(
                  "document-task-row",
                  expanded && "document-task-row--expanded",
                  task.done && "document-task-row--done",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "document-task-row__check",
                    task.done && "document-task-row__check--done",
                  )}
                  onClick={() => toggleDone(task.id)}
                  aria-label={task.done ? `Mark "${task.label}" as not done` : `Mark "${task.label}" as done`}
                  aria-pressed={task.done}
                >
                  {task.done ? <Check className="h-3 w-3" aria-hidden /> : null}
                </button>

                <p className="document-task-row__label">{task.label}</p>

                <button
                  type="button"
                  className={cn(
                    "document-task-row__howto",
                    expanded && "document-task-row__howto--active",
                  )}
                  onClick={() => void toggleHowTo(task.id)}
                  aria-expanded={expanded}
                  aria-controls={`${task.id}-howto-panel`}
                  aria-label={expanded ? `Hide how-to for ${task.label}` : `How do I do this: ${task.label}?`}
                >
                  {expanded ? (
                    <>
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                      How to
                    </>
                  ) : (
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  )}
                </button>

                {!task.isSystem ? (
                  <button
                    type="button"
                    className="document-task-row__delete"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete task ${task.label}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span className="document-task-row__delete-spacer" aria-hidden />
                )}
              </div>

              {expanded ? (
                <div
                  id={`${task.id}-howto-panel`}
                  className="document-task-howto-panel"
                  role="region"
                  aria-label={`How to: ${task.label}`}
                >
                  <div className="document-task-howto-panel__header">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    <p>How to get this done</p>
                  </div>

                  {loading ? (
                    <div className="document-task-howto-panel__loading">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Preparing steps for your task…
                    </div>
                  ) : steps && steps.length > 0 ? (
                    <>
                      <ol className="document-task-howto-panel__steps">
                        {steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <p className="document-task-howto-panel__disclaimer">{PANEL_DISCLAIMER}</p>
                      {onNavigateAiCoach ? (
                        <button
                          type="button"
                          className="document-task-howto-panel__followup"
                          onClick={() => askFollowUp(task, steps)}
                        >
                          Ask a follow-up
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="document-task-howto-panel__error">
                      {guidanceError ?? "No guidance available for this task yet."}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="document-task-checklist__add">
        <input
          type="text"
          className="document-task-checklist__add-input"
          placeholder="Add your own task…"
          value={newTaskLabel}
          onChange={(event) => setNewTaskLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addCustomTask()
          }}
          aria-label="Add your own task"
        />
        <button
          type="button"
          className="document-task-checklist__add-btn"
          onClick={addCustomTask}
          disabled={!newTaskLabel.trim()}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </button>
      </div>
    </section>
  )
}
