"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { polishCareerStorySection } from "@/app/actions/polish-career-story-section"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import {
  CAREER_STORY_SECTIONS,
  storySectionValue,
  type CareerStoryFieldKey,
} from "@/lib/career-story-sections"
import type { CareerStoryInputMode } from "@/lib/career-story-mode-storage"
import type { CareerStoryQuestionDraft } from "@/lib/career-story-flow-storage"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { cn } from "@/lib/utils"
import { Loader2, Mic } from "lucide-react"

type CareerStoryQuestionCardProps = {
  sectionIndex: number
  profile: StrategicProfile
  inputMode: CareerStoryInputMode
  onInputModeChange: (mode: CareerStoryInputMode) => void
  onComplete: (key: CareerStoryFieldKey, narrative: string) => void
  onSkip: () => void
  onBack: () => void
  canBack: boolean
  draft?: CareerStoryQuestionDraft
  onDraftChange?: (draft: CareerStoryQuestionDraft) => void
  onPermissionDenied: () => void
  voiceSupported: boolean
}

type QuestionState =
  | "ready"
  | "recording"
  | "review_transcript"
  | "processing"
  | "review_paragraph"

type AnswerMode = "voice" | "type" | null

type HygieneResult = { cleaned: string; removed?: string }

const TRAILING_NAV_PHRASES = [
  "next question",
  "next",
  "done",
  "finished",
  "that's it",
  "nächste frage",
  "weiter",
  "fertig",
  "das war's",
] as const

export function CareerStoryQuestionCard({
  sectionIndex,
  profile,
  onInputModeChange,
  onComplete,
  onSkip,
  onBack,
  canBack,
  draft,
  onDraftChange,
  onPermissionDenied,
  voiceSupported,
}: CareerStoryQuestionCardProps) {
  const section = CAREER_STORY_SECTIONS[sectionIndex] ?? CAREER_STORY_SECTIONS[0]!
  const existingValue = storySectionValue(profile, section.key)

  const [state, setState] = useState<QuestionState>("ready")
  const [mode, setMode] = useState<AnswerMode>(null)
  const [transcriptDraft, setTranscriptDraft] = useState("")
  const [paragraphDraft, setParagraphDraft] = useState("")
  const [typedDraft, setTypedDraft] = useState("")
  const [stripNote, setStripNote] = useState<string | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    [],
  )

  const speech = useSpeechRecognition({ onPermissionDenied })
  const liveRegionRef = useRef<HTMLDivElement | null>(null)
  const headingRef = useRef<HTMLParagraphElement | null>(null)
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null)
  const transcriptRef = useRef<HTMLTextAreaElement | null>(null)
  const paragraphRef = useRef<HTMLTextAreaElement | null>(null)
  const typeRef = useRef<HTMLTextAreaElement | null>(null)

  const displayTranscript = useMemo(() => {
    const base = speech.transcript
    const interim = speech.interimTranscript
    return `${base}${interim ? (base ? " " : "") + interim : ""}`.trim()
  }, [speech.transcript, speech.interimTranscript])

  useEffect(() => {
    if (draft) {
      setState(draft.state)
      setMode(draft.mode)
      setTranscriptDraft(draft.transcriptDraft ?? "")
      setParagraphDraft(draft.paragraphDraft ?? "")
      setTypedDraft(draft.transcriptDraft ?? existingValue)
      setStripNote(draft.strippedNote ?? null)
    } else {
      setState("ready")
      setMode(null)
      setTranscriptDraft("")
      setParagraphDraft("")
      setTypedDraft(existingValue)
      setStripNote(null)
    }
    setPolishError(null)
    speech.resetTranscript()
    speech.stopListening()
  }, [sectionIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onDraftChange) return
    const next: CareerStoryQuestionDraft = {
      mode,
      state,
      transcriptDraft: mode === "type" ? typedDraft : transcriptDraft,
      paragraphDraft,
      strippedNote: stripNote ?? undefined,
    }
    onDraftChange(next)
  }, [mode, state, transcriptDraft, typedDraft, paragraphDraft, stripNote, onDraftChange])

  useEffect(() => {
    if (state === "ready") {
      headingRef.current?.focus?.()
      return
    }
    if (state === "recording") {
      primaryButtonRef.current?.focus()
      return
    }
    if (state === "review_transcript") {
      transcriptRef.current?.focus()
      return
    }
    if (state === "review_paragraph") {
      paragraphRef.current?.focus()
      return
    }
    if (mode === "type" && state === "review_transcript") {
      typeRef.current?.focus()
    }
  }, [state, mode])

  const announce = (message: string) => {
    const el = liveRegionRef.current
    if (!el) return
    // Force announcement even if repeated.
    el.textContent = ""
    window.setTimeout(() => {
      if (liveRegionRef.current) liveRegionRef.current.textContent = message
    }, 10)
  }

  const stripTrailingNav = (raw: string): HygieneResult => {
    const text = raw.trim()
    if (!text) return { cleaned: "" }
    const lower = text.toLowerCase()

    for (const phrase of TRAILING_NAV_PHRASES) {
      const needle = phrase.toLowerCase()
      if (!lower.endsWith(needle)) continue

      const cutIndex = text.length - needle.length
      const before = text.slice(0, cutIndex).trim()
      // Only strip when it's clearly a trailing command, not part of a sentence.
      // Accept common separators before the phrase.
      const sep = text.slice(Math.max(0, cutIndex - 2), cutIndex)
      const looksSeparated = /[.!?]$/.test(before) || /[,;:\u2014-]\s*$/.test(before) || /\s{1,}$/.test(sep)
      if (!looksSeparated && before.split(/\s+/).length <= 2) continue
      return { cleaned: before, removed: phrase }
    }

    return { cleaned: text }
  }

  const startVoice = () => {
    if (!voiceSupported) {
      onInputModeChange("type")
      return
    }
    setMode("voice")
    setState("recording")
    setStripNote(null)
    speech.resetTranscript()
    speech.startListening()
    announce("Recording started. Listening.")
  }

  const cancelVoice = () => {
    speech.stopListening()
    speech.resetTranscript()
    setTranscriptDraft("")
    setStripNote(null)
    setState("ready")
    setMode(null)
    announce("Recording cancelled.")
  }

  const finishVoice = () => {
    speech.stopListening()
    const hygiene = stripTrailingNav(displayTranscript)
    setTranscriptDraft(hygiene.cleaned)
    if (hygiene.removed) {
      setStripNote(`We removed “${hygiene.removed}” from the end — use the button below to continue.`)
    } else {
      setStripNote(null)
    }
    setState("review_transcript")
    announce("Recording stopped. Review what we heard.")
  }

  const startTyping = () => {
    setMode("type")
    setState("review_transcript")
    setStripNote(null)
    if (!typedDraft.trim()) setTypedDraft(existingValue)
    announce("Type your answer, then continue.")
  }

  const runPolish = async (raw: string) => {
    const hygiene = stripTrailingNav(raw)
    const cleaned = hygiene.cleaned
    if (hygiene.removed) {
      setStripNote(`We removed “${hygiene.removed}” from the end — use the button below to continue.`)
    }

    setPolishing(true)
    setState("processing")
    setPolishError(null)
    const result = await polishCareerStorySection({
      fieldKey: section.key,
      sectionLabel: section.cardLabel,
      question: section.question,
      rawTranscript: cleaned,
      strategicProfile: profile,
      conversationHistory: conversation,
    })
    setPolishing(false)

    if (!result.success || !result.narrative) {
      setPolishError(result.error ?? "Could not rewrite your answer. You can edit it by hand.")
      setParagraphDraft(cleaned)
      setState("review_paragraph")
      announce("Your paragraph is ready.")
      return
    }

    setParagraphDraft(result.narrative)
    setConversation((prev) => [
      ...prev,
      { role: "user", content: cleaned },
      { role: "assistant", content: result.narrative! },
    ])
    setState("review_paragraph")
    announce("Your paragraph is ready.")
  }

  const confirmParagraph = () => {
    const narrative = paragraphDraft.trim()
    if (!narrative) return
    onComplete(section.key, narrative)
  }

  const useTranscript = () => {
    const raw =
      mode === "type"
        ? typedDraft.trim()
        : transcriptDraft.trim()
    if (!raw) return
    void runPolish(raw)
  }

  const appendChip = (chip: string) => {
    const parts = typedDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.some((p) => p.toLowerCase() === chip.toLowerCase())) return
    setTypedDraft(parts.length ? `${parts.join(", ")}, ${chip}` : chip)
  }

  return (
    <div className="career-story-question-card" key={section.key}>
      <div className="career-story-question-card__surface">
        <div ref={liveRegionRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <p
          className="career-story-question-card__question"
          tabIndex={-1}
          ref={headingRef}
        >
          {section.question}
        </p>

        <div className="career-story-question-card__nav">
          {canBack ? (
            <button type="button" className="career-story-question-card__nav-link" onClick={onBack}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="career-story-question-card__nav-link" onClick={onSkip}>
            Skip this question
          </button>
        </div>

        {state === "ready" ? (
          <div className="career-story-question-card__ready">
            <div className="career-story-question-card__choice-row">
              <button
                type="button"
                className="career-story-question-card__choice career-story-question-card__choice--primary"
                onClick={startVoice}
                disabled={!voiceSupported}
                ref={primaryButtonRef}
              >
                <Mic className="h-4 w-4" aria-hidden />
                Speak my answer
              </button>
              <button
                type="button"
                className="career-story-question-card__choice"
                onClick={startTyping}
              >
                Type my answer
              </button>
            </div>
          </div>
        ) : state === "recording" ? (
          <div className="career-story-question-card__recording">
            <div className="career-story-question-card__mic-wrap">
              <div
                className={cn(
                  "career-story-question-card__mic",
                  "career-story-question-card__mic--listening",
                )}
                aria-hidden
              >
                <span className="career-story-question-card__mic-ring" aria-hidden />
                <Mic className="h-6 w-6" aria-hidden />
              </div>
            </div>
            <p className="career-story-question-card__mic-label">Listening…</p>
            <div className="career-story-question-card__transcript" aria-live="polite" aria-atomic="true">
              {displayTranscript || "Your words will appear here as you speak."}
            </div>
            <div className="career-story-question-card__recording-actions">
              <button
                type="button"
                className="career-story-question-card__confirm"
                onClick={finishVoice}
                ref={primaryButtonRef}
              >
                I&apos;m finished
              </button>
              <button type="button" className="career-story-question-card__secondary" onClick={cancelVoice}>
                Cancel
              </button>
            </div>
          </div>
        ) : state === "review_transcript" ? (
          <div className="career-story-question-card__review">
            <label className="career-story-question-card__transcript-label" htmlFor={`story-review-${section.key}`}>
              Here&apos;s what we heard — you can fix anything before we continue.
            </label>
            {stripNote ? (
              <p className="career-story-question-card__note" role="status">
                {stripNote}
              </p>
            ) : null}
            <textarea
              id={`story-review-${section.key}`}
              className="career-story-question-card__textarea"
              rows={5}
              value={mode === "type" ? typedDraft : transcriptDraft}
              placeholder={mode === "type" ? section.placeholder : undefined}
              onChange={(event) => {
                if (mode === "type") setTypedDraft(event.target.value)
                else setTranscriptDraft(event.target.value)
              }}
              ref={(el) => {
                transcriptRef.current = el
                typeRef.current = el
              }}
            />
            {section.chips && mode === "type" ? (
              <div className="career-story-question-card__chips">
                {section.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="career-story-question-card__chip"
                    onClick={() => appendChip(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="career-story-question-card__review-actions">
              <button
                type="button"
                className="career-story-question-card__confirm"
                onClick={useTranscript}
                disabled={mode === "type" ? !typedDraft.trim() : !transcriptDraft.trim()}
                ref={primaryButtonRef}
              >
                Use this answer
              </button>
              {mode === "voice" ? (
                <>
                  <button
                    type="button"
                    className="career-story-question-card__secondary"
                    onClick={() => {
                      setState("recording")
                      setMode("voice")
                      setStripNote(null)
                      speech.resetTranscript()
                      speech.startListening()
                      announce("Recording started. Listening.")
                    }}
                  >
                    Re-record
                  </button>
                  <button
                    type="button"
                    className="career-story-question-card__secondary"
                    onClick={() => {
                      setMode("type")
                      setStripNote(null)
                      setTypedDraft(transcriptDraft)
                      announce("Type your answer, then continue.")
                    }}
                  >
                    Type instead
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="career-story-question-card__secondary"
                  onClick={() => {
                    setMode("voice")
                    setStripNote(null)
                    setTranscriptDraft(typedDraft)
                    announce("Switching to transcript review.")
                  }}
                >
                  Use transcript instead
                </button>
              )}
            </div>
          </div>
        ) : state === "processing" ? (
          <div className="career-story-question-card__processing" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <div>
              <p className="career-story-question-card__processing-title">
                Turning your words into a story paragraph…
              </p>
              <p className="career-story-question-card__processing-sub">
                When it&apos;s ready, you can edit it before moving on.
              </p>
            </div>
          </div>
        ) : (
          <div className="career-story-question-card__review">
            <label className="career-story-question-card__transcript-label" htmlFor={`story-paragraph-${section.key}`}>
              Your answer, in your story
            </label>
            <p className="career-story-question-card__helper">
              Edit anything that doesn&apos;t sound like you.
            </p>
            <textarea
              id={`story-paragraph-${section.key}`}
              className="career-story-question-card__textarea"
              rows={5}
              value={paragraphDraft}
              onChange={(event) => setParagraphDraft(event.target.value)}
              ref={paragraphRef}
            />
            {polishError ? (
              <p className="career-story-question-card__error" role="status">
                {polishError}
              </p>
            ) : null}
            <div className="career-story-question-card__review-actions">
              <button
                type="button"
                className="career-story-question-card__confirm"
                onClick={confirmParagraph}
                disabled={!paragraphDraft.trim()}
                ref={primaryButtonRef}
              >
                {sectionIndex >= CAREER_STORY_SECTIONS.length - 1
                  ? "Looks good — finish my story"
                  : "Looks good — next question"}
              </button>
              <button
                type="button"
                className="career-story-question-card__secondary"
                onClick={() => {
                  setState("ready")
                  setMode(null)
                  setTranscriptDraft("")
                  setParagraphDraft("")
                  setTypedDraft(existingValue)
                  setStripNote(null)
                  speech.resetTranscript()
                  speech.stopListening()
                  announce("Start this answer again.")
                }}
              >
                Start this answer again
              </button>
            </div>
          </div>
        )}

        {state !== "processing" ? (
          <p className="career-story-question-card__reassurance">
            Speak or type, whatever&apos;s easier right now
          </p>
        ) : null}
      </div>

      {speech.error ? (
        <p className="career-story-question-card__error" role="status">
          {speech.error}
        </p>
      ) : null}
    </div>
  )
}
