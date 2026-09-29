import { buildDefaultDocumentTasks } from "@/lib/document-tasks/default-task-guidance"
import type { DocumentTasksState, DocumentTask } from "@/lib/document-tasks/types"

const STORAGE_PREFIX = "document-tasks"

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function loadDocumentTasks(folderId: string): DocumentTask[] {
  if (typeof window === "undefined" || !folderId) {
    return buildDefaultDocumentTasks()
  }
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return buildDefaultDocumentTasks()
    const parsed = JSON.parse(raw) as Partial<DocumentTasksState>
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return buildDefaultDocumentTasks()
    }
    return parsed.tasks.filter(
      (task): task is DocumentTask =>
        typeof task === "object" &&
        task !== null &&
        typeof task.id === "string" &&
        typeof task.label === "string" &&
        typeof task.done === "boolean" &&
        typeof task.isSystem === "boolean",
    )
  } catch {
    return buildDefaultDocumentTasks()
  }
}

export function saveDocumentTasks(folderId: string, tasks: DocumentTask[]): void {
  if (typeof window === "undefined" || !folderId) return
  const state: DocumentTasksState = { version: 1, tasks }
  localStorage.setItem(storageKey(folderId), JSON.stringify(state))
}
