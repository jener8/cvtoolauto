"use client"

import { useEffect, useState } from "react"
import { CareerStoryAnsweredSection } from "@/components/application-intelligence/career-story-answered-section"
import { CareerStoryProgressDots } from "@/components/application-intelligence/career-story-progress-dots"
import { CareerStoryQuestionCard } from "@/components/application-intelligence/career-story-question-card"
import { usePageTitle } from "@/hooks/use-page-title"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import {
  CAREER_STORY_SECTIONS,
  storySectionsCompleted,
  type CareerStoryFieldKey,
} from "@/lib/career-story-sections"
import {
  loadCareerStoryFlow,
  saveCareerStoryFlow,
  type CareerStoryFlowState,
} from "@/lib/career-story-flow-storage"
import {
  loadCareerStoryInputMode,
  saveCareerStoryInputMode,
  type CareerStoryInputMode,
} from "@/lib/career-story-mode-storage"
import {
  emptyStrategicProfile,
  loadStrategicProfile,
  saveStrategicProfile,
  type StrategicProfile,
} from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { Brain } from "lucide-react"
import "./career-brain-section.css"

export type CareerBrainSectionProps = {
  folderId: string
  versions: ResumeVersion[]
  jobApplications: JobApplication[]
  userName?: string
  userEmail?: string
}

function firstIncompleteSectionIndex(profile: StrategicProfile): number {
  const index = CAREER_STORY_SECTIONS.findIndex(
    (section) => !profile[section.key]?.trim(),
  )
  return index >= 0 ? index : CAREER_STORY_SECTIONS.length - 1
}

function sectionIndexForKey(key: CareerStoryFieldKey): number {
  return CAREER_STORY_SECTIONS.findIndex((section) => section.key === key)
}

export function CareerBrainSection({ folderId }: CareerBrainSectionProps) {
  const [profile, setProfile] = useState<StrategicProfile>(emptyStrategicProfile())
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [editingKey, setEditingKey] = useState<CareerStoryFieldKey | null>(null)
  const [inputMode, setInputMode] = useState<CareerStoryInputMode>("voice")
  const [micDeniedMessage, setMicDeniedMessage] = useState<string | null>(null)
  const [transitionKey, setTransitionKey] = useState(0)
  const [flow, setFlow] = useState<CareerStoryFlowState>(() => loadCareerStoryFlow(folderId))
  const [flowLoaded, setFlowLoaded] = useState(false)

  const speechProbe = useSpeechRecognition()

  useEffect(() => {
    const loaded = loadStrategicProfile()
    setProfile(loaded)
    setActiveSectionIndex(firstIncompleteSectionIndex(loaded))
    setInputMode(loadCareerStoryInputMode())
    setFlow(loadCareerStoryFlow(folderId))
    setFlowLoaded(true)
  }, [folderId])

  useEffect(() => {
    if (!speechProbe.supported && inputMode === "voice") {
      setInputMode("type")
      saveCareerStoryInputMode("type")
    }
  }, [speechProbe.supported, inputMode])

  usePageTitle(pageTitleForSection("careerBrain"))

  const completedCount = storySectionsCompleted(profile)
  const allComplete = completedCount >= CAREER_STORY_SECTIONS.length

  useEffect(() => {
    if (!flowLoaded) return
    saveCareerStoryFlow(folderId, flow)
  }, [folderId, flow, flowLoaded])

  const handleModeChange = (mode: CareerStoryInputMode) => {
    if (mode === "voice" && !speechProbe.supported) return
    setInputMode(mode)
    saveCareerStoryInputMode(mode)
    setMicDeniedMessage(null)
  }

  const handlePermissionDenied = () => {
    setMicDeniedMessage(
      "Microphone access is blocked. You can still type your story — both ways count equally.",
    )
    setInputMode("type")
    saveCareerStoryInputMode("type")
  }

  const handleSectionComplete = (key: CareerStoryFieldKey, narrative: string) => {
    const nextProfile: StrategicProfile = {
      ...profile,
      [key]: narrative,
      updatedAt: Date.now(),
    }
    setProfile(nextProfile)
    saveStrategicProfile(nextProfile)

    // Remove from skipped when answered.
    setFlow((prev) => ({
      ...prev,
      skippedKeys: prev.skippedKeys.filter((k) => k !== key),
      visitedUpTo: Math.max(prev.visitedUpTo, activeSectionIndex),
    }))

    const nextIndex = Math.min(activeSectionIndex + 1, CAREER_STORY_SECTIONS.length - 1)
    setActiveSectionIndex(nextIndex)
    setEditingKey(null)
    setTransitionKey((value) => value + 1)
  }

  const handleEditAnswered = (key: CareerStoryFieldKey) => {
    const index = sectionIndexForKey(key)
    if (index >= 0) {
      setEditingKey(key)
      setActiveSectionIndex(index)
      setTransitionKey((value) => value + 1)
    }
  }

  const questionSectionIndex =
    editingKey !== null ? sectionIndexForKey(editingKey) : activeSectionIndex
  const showQuestionFlow = !allComplete || editingKey !== null
  const activeKey = CAREER_STORY_SECTIONS[questionSectionIndex]?.key
  const canBack = questionSectionIndex > 0
  const activeDraft = activeKey ? flow.drafts[activeKey] : undefined

  const handleNavigate = (index: number) => {
    if (index < 0 || index >= CAREER_STORY_SECTIONS.length) return
    setEditingKey(null)
    setActiveSectionIndex(index)
    setTransitionKey((value) => value + 1)
    setFlow((prev) => ({ ...prev, visitedUpTo: Math.max(prev.visitedUpTo, index) }))
  }

  const handleSkip = () => {
    if (!activeKey) return
    setFlow((prev) => ({
      ...prev,
      skippedKeys: prev.skippedKeys.includes(activeKey) ? prev.skippedKeys : [...prev.skippedKeys, activeKey],
      visitedUpTo: Math.max(prev.visitedUpTo, questionSectionIndex),
    }))
    const nextIndex = Math.min(questionSectionIndex + 1, CAREER_STORY_SECTIONS.length - 1)
    setActiveSectionIndex(nextIndex)
    setEditingKey(null)
    setTransitionKey((value) => value + 1)
  }

  const handleBack = () => {
    const prevIndex = Math.max(0, questionSectionIndex - 1)
    if (prevIndex === questionSectionIndex) return
    setEditingKey(null)
    setActiveSectionIndex(prevIndex)
    setTransitionKey((value) => value + 1)
  }

  return (
    <div className="career-brain-page career-brain-page--focused">
      <header className="career-brain-page__header career-brain-page__header--compact">
        <div className="career-brain-page__title-row">
          <div className="career-brain-page__title-icon" aria-hidden>
            <Brain className="h-6 w-6" />
          </div>
          <h1 className="career-brain-page__title">Your story</h1>
        </div>
      </header>

      <div className="career-brain-page__body career-brain-page__body--focused">
        <div className="career-brain-focus">
          <CareerStoryProgressDots
            profile={profile}
            activeIndex={questionSectionIndex}
            skippedKeys={flow.skippedKeys}
            visitedUpTo={flow.visitedUpTo}
            onNavigate={handleNavigate}
          />

          {micDeniedMessage ? (
            <p className="career-story-question-card__error" role="status">
              {micDeniedMessage}
            </p>
          ) : null}

          {showQuestionFlow ? (
            <div className="career-story-question-card__transition" key={transitionKey}>
              <CareerStoryQuestionCard
                sectionIndex={questionSectionIndex >= 0 ? questionSectionIndex : activeSectionIndex}
                profile={profile}
                inputMode={inputMode}
                onInputModeChange={handleModeChange}
                onComplete={handleSectionComplete}
                onSkip={handleSkip}
                onBack={handleBack}
                canBack={canBack}
                draft={activeDraft}
                onDraftChange={(draft) => {
                  if (!activeKey) return
                  setFlow((prev) => ({
                    ...prev,
                    drafts: { ...prev.drafts, [activeKey]: draft },
                  }))
                }}
                onPermissionDenied={handlePermissionDenied}
                voiceSupported={speechProbe.supported}
              />
            </div>
          ) : (
            <div className="career-story-question-card__complete">
              <p className="career-story-question-card__complete-title">You&apos;ve answered all four questions</p>
              <p className="career-story-question-card__complete-text">
                Your story is saved. You can edit any answer below whenever you like.
              </p>
            </div>
          )}

          <details className="career-story-how">
            <summary className="career-story-how__summary">How this works</summary>
            <div className="career-story-how__body">
              <p>No perfect answers — just what feels true for you.</p>
              <p>Only you can see this. You can update or delete anything, anytime.</p>
              <p>
                If you talk, we turn it into text in your browser. EquitAI does not store audio —
                only the written story you save.
              </p>
            </div>
          </details>

          <CareerStoryAnsweredSection profile={profile} onEdit={handleEditAnswered} />
        </div>
      </div>
    </div>
  )
}
