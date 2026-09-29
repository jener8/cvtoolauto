"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Sparkles } from "lucide-react"
import { useOptionalPhraseLibrary } from "@/components/phrase-library/phrase-library-context"
import { suggestPhrases } from "@/lib/phrase-library/suggestions"
import type { CareerPhrase } from "@/lib/phrase-library/types"
import { cn } from "@/lib/utils"
import "./phrase-library.css"

type PhraseAwareFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  rows?: number
  placeholder?: string
}

export function PhraseAwareTextarea({
  id,
  label,
  value,
  onChange,
  className,
  rows = 3,
  placeholder,
}: PhraseAwareFieldProps) {
  const phraseLibrary = useOptionalPhraseLibrary()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [highlight, setHighlight] = useState(false)
  const [focused, setFocused] = useState(false)

  const register = useCallback(() => {
    if (!phraseLibrary || !textareaRef.current) return
    phraseLibrary.registerField({
      id,
      label,
      value,
      onChange,
      element: textareaRef.current,
    })
  }, [phraseLibrary, id, label, value, onChange])

  useEffect(() => {
    if (!focused || !phraseLibrary) return
    phraseLibrary.registerField({
      id,
      label,
      value,
      onChange,
      element: textareaRef.current,
    })
  }, [focused, phraseLibrary, id, label, value, onChange])

  const suggestions =
    focused && phraseLibrary && value.trim().length >= 3
      ? suggestPhrases({
          fieldText: value,
          fieldLabel: label,
          strategicProfile: phraseLibrary.strategicProfile,
          qualificationProfile: phraseLibrary.qualificationProfile,
        })
      : null

  const handleInsertSuggestion = (phrase: CareerPhrase) => {
    if (!phraseLibrary || !textareaRef.current) return
    const ok = phraseLibrary.insertPhrase(phrase)
    if (ok) {
      setHighlight(true)
      window.setTimeout(() => setHighlight(false), 1600)
    }
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        id={id}
        className={cn(className, highlight && "phrase-aware-field__input--highlight")}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true)
          register()
        }}
        onBlur={() => {
          setFocused(false)
          phraseLibrary?.clearActiveField(id)
        }}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={suggestions ? `${id}-phrase-suggestions` : undefined}
      />

      {phraseLibrary ? (
        <div className="phrase-aware-field__toolbar">
          <button
            type="button"
            className="phrase-aware-field__browse"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => phraseLibrary.openPhraseLibrary()}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Browse phrases
          </button>
        </div>
      ) : null}

      {suggestions && suggestions.phrases.length > 0 ? (
        <div
          id={`${id}-phrase-suggestions`}
          className="phrase-aware-field__suggestions"
          role="region"
          aria-label="Suggested phrases"
        >
          <p className="phrase-aware-field__suggestions-reason">{suggestions.reason}</p>
          <div className="phrase-aware-field__suggestion-list">
            {suggestions.phrases.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                className="phrase-aware-field__suggestion-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsertSuggestion(phrase)}
              >
                <Check className="h-3 w-3 text-[var(--color-primary-light)]" aria-hidden />
                {phrase.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
