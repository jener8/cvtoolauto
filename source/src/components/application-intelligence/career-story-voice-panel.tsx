"use client"

import { useEffect, useMemo, useState } from "react"
import { polishCareerStorySection } from "@/app/actions/polish-career-story-section"
import {
  CAREER_STORY_SECTIONS,
  storySectionValue,
  type CareerStoryFieldKey,
} from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { cn } from "@/lib/utils"
import { Loader2, Lock, Mic } from "lucide-react"

type CareerStoryVoicePanelProps = {
  profile: StrategicProfile
  activeSectionIndex: number
  onSectionIndexChange: (index: number) => void
  onSaveSection: (key: CareerStoryFieldKey, narrative: string) => void
  onPermissionDenied: () => void
}

type VoiceStep = "listen" | "review" | "follow-up"

export function CareerStoryVoicePanel({
  profile,
  activeSectionIndex,
  onSectionIndexChange,
  onSaveSection,
  onPermissionDenied,
}: CareerStoryVoicePanelProps) {
  const section = CAREER_STORY_SECTIONS[activeSectionIndex] ?? CAREER_STORY_SECTIONS[0]!
  const [step, setStep] = useState<VoiceStep>("listen")
  const [polishedDraft, setPolishedDraft] = useState("")
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null)
  const [followUpTranscript, setFollowUpTranscript] = useState("")
  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    [],
  )

  const speech = useSpeechRecognition({
    onPermissionDenied,
  })

  const displayTranscript = useMemo(() => {
    const base = step === "follow-up" ? followUpTranscript : speech.transcript
    const interim = speech.interimTranscript
    return `${base}${interim ? (base ? " " : "") + interim : ""}`.trim()
  }, [step, followUpTranscript, speech.transcript, speech.interimTranscript])

  useEffect(() => {
    setStep("listen")
    setPolishedDraft("")
    setFollowUpQuestion(null)
    setFollowUpTranscript("")
    setPolishError(null)
    speech.resetTranscript()
    speech.stopListening()
  }, [activeSectionIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => {
    if (speech.listening) {
      speech.stopListening()
      if (step === "listen" && speech.transcript.trim()) {
        void runPolish(speech.transcript)
      }
      return
    }
    speech.startListening()
  }

  const runPolish = async (raw: string) => {
    setPolishing(true)
    setPolishError(null)
    const result = await polishCareerStorySection({
      fieldKey: section.key,
      sectionLabel: section.cardLabel,
      question: section.question,
      rawTranscript: raw,
      strategicProfile: profile,
      conversationHistory: conversation,
    })
    setPolishing(false)

    if (!result.success || !result.narrative) {
      setPolishError(result.error ?? "Could not rewrite your answer. You can edit it by hand.")
      setPolishedDraft(raw)
      setStep("review")
      return
    }

    setPolishedDraft(result.narrative)
    setFollowUpQuestion(result.followUpQuestion ?? null)
    setConversation((prev) => [
      ...prev,
      { role: "user", content: raw },
      { role: "assistant", content: result.narrative! },
    ])
    setStep("review")
  }

  const confirmSave = () => {
    const narrative = polishedDraft.trim()
    if (!narrative) return
    onSaveSection(section.key, narrative)
    if (followUpQuestion) {
      setStep("follow-up")
      speech.resetTranscript()
      setFollowUpTranscript("")
      return
    }
    advanceSection()
  }

  const advanceSection = () => {
    const next = Math.min(activeSectionIndex + 1, CAREER_STORY_SECTIONS.length - 1)
    if (activeSectionIndex < CAREER_STORY_SECTIONS.length - 1) {
      onSectionIndexChange(next)
    }
    setStep("listen")
    setPolishedDraft("")
    setFollowUpQuestion(null)
    setFollowUpTranscript("")
    speech.resetTranscript()
  }

  const skipFollowUp = () => {
    advanceSection()
  }

  const saveFollowUp = async () => {
    const extra = displayTranscript.trim()
    if (!extra) {
      skipFollowUp()
      return
    }
    const merged = `${storySectionValue(profile, section.key)} ${extra}`.trim()
    const result = await polishCareerStorySection({
      fieldKey: section.key,
      sectionLabel: section.cardLabel,
      question: followUpQuestion ?? section.question,
      rawTranscript: merged,
      strategicProfile: { ...profile, [section.key]: storySectionValue(profile, section.key) },
      conversationHistory: conversation,
    })
    if (result.success && result.narrative) {
      onSaveSection(section.key, result.narrative)
    } else {
      onSaveSection(section.key, merged)
    }
    advanceSection()
  }

  const questionLabel =
    step === "follow-up" && followUpQuestion ? followUpQuestion : section.question

  return (
    <div className="career-story-voice">
      <div className="career-story-voice__panel">
        <p className="career-story-voice__progress">
          Question {activeSectionIndex + 1} of {CAREER_STORY_SECTIONS.length}
        </p>
        <p className="career-story-voice__question">{questionLabel}</p>

        {step === "review" ? (
          <div className="career-story-voice__review">
            <p className="career-story-voice__review-label">Review before saving</p>
            <textarea
              className="career-story-card__textarea career-story-voice__review-input"
              value={polishedDraft}
              onChange={(event) => setPolishedDraft(event.target.value)}
              rows={5}
              aria-label="Polished story paragraph"
            />
            {polishError ? <p className="career-story-voice__error">{polishError}</p> : null}
            <div className="career-story-voice__review-actions">
              <button
                type="button"
                className="career-story-voice__primary-btn"
                onClick={confirmSave}
              >
                Save this section
              </button>
              <button
                type="button"
                className="career-story-voice__secondary-btn"
                onClick={() => {
                  setStep("listen")
                  speech.resetTranscript()
                }}
              >
                Record again
              </button>
            </div>
          </div>
        ) : step === "follow-up" ? (
          <div className="career-story-voice__follow-up">
            <button
              type="button"
              className={cn(
                "career-story-voice__mic",
                speech.listening && "career-story-voice__mic--listening",
              )}
              onClick={toggleMic}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? "Stop listening" : "Answer follow-up"}
            >
              <span className="career-story-voice__mic-ring" aria-hidden />
              <Mic className="h-5 w-5" aria-hidden />
            </button>
            <p className="career-story-voice__hint">
              {speech.listening ? "Listening… speak whenever you're ready" : "Tap to answer, or skip"}
            </p>
            <div className="career-story-voice__transcript-box">
              <p className="career-story-voice__transcript-label">Live transcript</p>
              <p className="career-story-voice__transcript" aria-live="polite">
                {displayTranscript || "Your words will appear here as you speak."}
              </p>
            </div>
            <div className="career-story-voice__review-actions">
              <button
                type="button"
                className="career-story-voice__primary-btn"
                onClick={() => void saveFollowUp()}
                disabled={polishing}
              >
                {polishing ? "Saving…" : "Save and continue"}
              </button>
              <button type="button" className="career-story-voice__secondary-btn" onClick={skipFollowUp}>
                Skip to next question
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="career-story-voice__mic-wrap">
              <button
                type="button"
                className={cn(
                  "career-story-voice__mic",
                  speech.listening && "career-story-voice__mic--listening",
                )}
                onClick={toggleMic}
                disabled={polishing}
                aria-pressed={speech.listening}
                aria-label={speech.listening ? "Stop listening" : "Start listening"}
              >
                <span className="career-story-voice__mic-ring" aria-hidden />
                {polishing ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Mic className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
            <p className="career-story-voice__hint">
              {polishing
                ? "Turning your words into a story paragraph…"
                : speech.listening
                  ? "Listening… speak whenever you're ready"
                  : "Tap the microphone when you're ready — no perfect answers needed"}
            </p>
          </>
        )}
      </div>

      {step !== "review" && step !== "follow-up" ? (
        <div className="career-story-voice__transcript-box">
          <p className="career-story-voice__transcript-label">Live transcript</p>
          <p className="career-story-voice__transcript" aria-live="polite">
            {displayTranscript || "Your words will appear here as you speak."}
          </p>
        </div>
      ) : null}

      {speech.error ? <p className="career-story-voice__error">{speech.error}</p> : null}

      <div className="career-story-voice__privacy">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          Speech is converted to text in your browser (your device may use a cloud speech service).
          EquitAI does not store audio — only the written story you choose to save.
        </p>
      </div>
    </div>
  )
}
