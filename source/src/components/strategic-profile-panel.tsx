"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  type StrategicProfile,
  hasStrategicProfileContent,
  loadStrategicProfile,
  patchStrategicProfile,
} from "@/lib/strategic-profile"
import { ChevronDown, ChevronUp, Plus, Target } from "lucide-react"

const TONE_PLACEHOLDER =
  "e.g. executive, warm, strategic, technical, concise, visionary"

interface StrategicProfilePanelProps {
  /** Called after profile is saved so parent can refresh generation context if needed */
  onProfileChange?: (profile: StrategicProfile) => void
  defaultExpanded?: boolean
}

export function StrategicProfilePanel({
  onProfileChange,
  defaultExpanded = true,
}: StrategicProfilePanelProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const [showMore, setShowMore] = useState(false)
  const [profile, setProfile] = useState<StrategicProfile>(() =>
    typeof window !== "undefined" ? loadStrategicProfile() : {},
  )

  useEffect(() => {
    const loaded = loadStrategicProfile()
    setProfile(loaded)
    if (hasStrategicProfileContent(loaded)) {
      const hasExtended =
        loaded.professionalStrengths?.trim() ||
        loaded.strategicEmphasis?.trim() ||
        loaded.avoidDownplay?.trim() ||
        loaded.writingTone?.trim() ||
        loaded.longTermGoal?.trim()
      if (hasExtended) setShowMore(true)
    }
  }, [])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (next: StrategicProfile) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        const merged = patchStrategicProfile(next)
        onProfileChange?.(merged)
      }, 600)
    },
    [onProfileChange],
  )

  const update = (field: keyof StrategicProfile, value: string) => {
    setProfile((prev) => {
      const next = { ...prev, [field]: value }
      scheduleSave(next)
      return next
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card shadow-sm">
      <div className="p-4 space-y-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-2 text-left"
          >
            <div className="flex gap-2 min-w-0">
              <Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Improve future applications
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                  This helps tailor applications to your broader career direction, strengths
                  and positioning — not just the job description.
                </p>
              </div>
            </div>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">
            Optional — save anytime. Your next tailored CVs and cover letters can use this
            guidance. It won&apos;t appear on your resume unless you add it yourself.
          </p>

          <div className="space-y-2">
            <Label htmlFor="strategic-career-direction" className="text-xs font-medium">
              What kinds of roles are you targeting?
            </Label>
            <Textarea
              id="strategic-career-direction"
              placeholder="e.g. Head of Product, Responsible AI lead, UX leadership in enterprise SaaS"
              value={profile.careerDirection ?? ""}
              onChange={(e) => update("careerDirection", e.target.value)}
              className="min-h-[72px] text-sm resize-y bg-muted/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategic-notice-period" className="text-xs font-medium">
              Notice period
            </Label>
            <Textarea
              id="strategic-notice-period"
              placeholder="e.g. 3 months, available from 1 September 2026"
              value={profile.noticePeriod ?? ""}
              onChange={(e) => update("noticePeriod", e.target.value)}
              className="min-h-[56px] text-sm resize-y bg-muted/20"
            />
          </div>

          {!showMore ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowMore(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add more strategic guidance
            </Button>
          ) : (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="strategic-strengths" className="text-xs font-medium">
                  What makes you different professionally?
                </Label>
                <Textarea
                  id="strategic-strengths"
                  placeholder="Strengths you want highlighted across applications"
                  value={profile.professionalStrengths ?? ""}
                  onChange={(e) => update("professionalStrengths", e.target.value)}
                  className="min-h-[64px] text-sm resize-y bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategic-emphasis" className="text-xs font-medium">
                  What should applications emphasize?
                </Label>
                <Textarea
                  id="strategic-emphasis"
                  placeholder="Themes, outcomes, or domains to lean into"
                  value={profile.strategicEmphasis ?? ""}
                  onChange={(e) => update("strategicEmphasis", e.target.value)}
                  className="min-h-[64px] text-sm resize-y bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategic-avoid" className="text-xs font-medium">
                  What should applications avoid emphasizing?
                </Label>
                <Textarea
                  id="strategic-avoid"
                  placeholder="Topics, titles, or angles to downplay"
                  value={profile.avoidDownplay ?? ""}
                  onChange={(e) => update("avoidDownplay", e.target.value)}
                  className="min-h-[64px] text-sm resize-y bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategic-tone" className="text-xs font-medium">
                  How should the application sound?
                </Label>
                <Textarea
                  id="strategic-tone"
                  placeholder={TONE_PLACEHOLDER}
                  value={profile.writingTone ?? ""}
                  onChange={(e) => update("writingTone", e.target.value)}
                  className="min-h-[56px] text-sm resize-y bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategic-goal" className="text-xs font-medium">
                  What broader direction are you moving toward?
                </Label>
                <Textarea
                  id="strategic-goal"
                  placeholder="Long-term career direction or aspiration"
                  value={profile.longTermGoal ?? ""}
                  onChange={(e) => update("longTermGoal", e.target.value)}
                  className="min-h-[64px] text-sm resize-y bg-muted/20"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2 text-muted-foreground"
                onClick={() => setShowMore(false)}
              >
                Show less
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
