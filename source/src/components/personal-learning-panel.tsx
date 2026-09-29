"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  clearLearningMemory,
  deleteAllPersonalLearningData,
  loadLearningMemory,
  loadLearningSettings,
  saveLearningSettings,
} from "@/lib/personal-learning/storage"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import { Brain, Trash2 } from "lucide-react"

interface PersonalLearningPanelProps {
  folderId: string
  memory: PersonalLearningMemory
  onMemoryChange: (memory: PersonalLearningMemory | null) => void
  onSettingsChange: (enabled: boolean) => void
  learningEnabled: boolean
  onOpenInsightsDashboard?: () => void
}

export function PersonalLearningPanel({
  folderId,
  memory,
  onMemoryChange,
  onSettingsChange,
  learningEnabled,
  onOpenInsightsDashboard,
}: PersonalLearningPanelProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleToggle = (enabled: boolean) => {
    const current = loadLearningSettings(folderId)
    saveLearningSettings(folderId, {
      ...current,
      enabled,
      updatedAt: Date.now(),
    })
    onSettingsChange(enabled)
  }

  const handleResetInsights = () => {
    clearLearningMemory(folderId)
    onMemoryChange(loadLearningMemory(folderId))
    setShowResetConfirm(false)
  }

  const handleDeleteAll = () => {
    deleteAllPersonalLearningData(folderId)
    onMemoryChange(loadLearningMemory(folderId))
    onSettingsChange(loadLearningSettings(folderId).enabled)
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Label htmlFor="learning-enabled" className="text-xs font-medium cursor-pointer">
              Personal learning (this workspace only)
            </Label>
          </div>
          <Switch
            id="learning-enabled"
            checked={learningEnabled}
            onCheckedChange={handleToggle}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Learns from your applications in this folder only. Never shared with other users or
          workspaces.
        </p>
        {learningEnabled && memory.insights.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View {memory.insights.length} learned insight(s)
            </summary>
            <ul className="mt-2 space-y-1.5 max-h-24 overflow-y-auto text-muted-foreground">
              {memory.insights
                .filter((i) => !i.dismissed)
                .map((i) => (
                  <li key={i.id} className="leading-snug">
                    <span className="text-foreground/70">
                      [{i.confidence}] {i.category}
                    </span>{" "}
                    {i.userCorrection?.trim() || i.text}
                  </li>
                ))}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap gap-1.5">
          {onOpenInsightsDashboard && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 text-[10px]"
              onClick={onOpenInsightsDashboard}
            >
              Open insights dashboard
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => setShowResetConfirm(true)}
          >
            Reset insights
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px] text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete AI memory
          </Button>
        </div>
      </div>

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset learned insights?</DialogTitle>
            <DialogDescription>
              Clears analyzed patterns for this workspace. Chat history is kept unless you delete
              AI memory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetInsights}>Reset insights</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all personal AI memory?</DialogTitle>
            <DialogDescription>
              Removes learned insights and this assistant&apos;s chat history for this workspace.
              Your saved resumes and applications are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              Delete memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
