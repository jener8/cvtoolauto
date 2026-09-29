export type TaskHowToGuidance = {
  steps: string[]
  generatedAt: number
  /** Label text when guidance was generated — invalidate cache if task edited */
  labelFingerprint: string
}

export type DocumentTask = {
  id: string
  label: string
  done: boolean
  /** System-provided default task — uses static guidance config */
  isSystem: boolean
  /** Key into DEFAULT_DOCUMENT_TASK_GUIDANCE */
  systemId?: string
  /** Cached AI guidance for user-added tasks */
  aiGuidance?: TaskHowToGuidance
}

export type DocumentTasksState = {
  version: 1
  tasks: DocumentTask[]
}
