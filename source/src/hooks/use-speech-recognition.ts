"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type UseSpeechRecognitionOptions = {
  lang?: string
  onPermissionDenied?: () => void
}

export type UseSpeechRecognitionResult = {
  supported: boolean
  listening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const { lang = "en-US", onPermissionDenied } = options
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()))
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
    setError(null)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError("Voice input is not supported in this browser.")
      return
    }

    setError(null)
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked.")
        onPermissionDenied?.()
        return
      }
      if (event.error !== "aborted") {
        setError("Voice input was interrupted. You can try again or type instead.")
      }
    }

    recognition.onresult = (event) => {
      let interim = ""
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript ?? ""
        if (event.results[i]?.isFinal) finalText += piece
        else interim += piece
      }
      if (finalText) {
        setTranscript((prev) => `${prev}${finalText}`.trim())
      }
      setInterimTranscript(interim)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setError("Could not start voice input. Try typing instead.")
      setListening(false)
    }
  }, [lang, onPermissionDenied])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return {
    supported,
    listening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  }
}
