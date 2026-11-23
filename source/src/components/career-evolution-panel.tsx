"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
import { CareerEvolutionErrorBoundary } from "@/components/career-evolution-error-boundary"
import {
  CAREER_EVOLUTION_ALIGNMENT_SYNTAX_HELP,
  CAREER_EVOLUTION_CAPABILITY_DEFAULT,
  CAREER_EVOLUTION_CAPABILITY_MAX,
  CAREER_EVOLUTION_CAPABILITY_MIN,
  CAREER_EVOLUTION_LAYOUTS,
  CAREER_EVOLUTION_SYNTAX_HELP,
  acceptPendingCareerEvolution,
  applySuggestedDisplayLabels,
  buildCareerEvolutionSuggestion,
  capabilitiesForRender,
  careerEvolutionLayoutPreviewSvg,
  emptyAlignmentSourceText,
  ensureAlignmentSourceText,
  extractCareerEvolution,
  filterValidConnections,
  hasCareerEvolutionAlignmentContent,
  hasMeaningfulCareerEvolutionNarrative,
  hasParallelTrackContent,
  hasUserProtectedCareerEvolutionEdits,
  mergeCareerEvolutionOnRegenerate,
  newCareerEvolutionId,
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionAlignmentText,
  parseCareerEvolutionText,
  prepareCareerEvolutionParallelVisibility,
  isUserProtectedConvergenceTarget,
  proposeMilestoneDisplayLabels,
  resolveCareerEvolutionConfig,
  serializeCareerEvolutionAlignmentText,
  serializeCareerEvolutionText,
  suggestCentralOutcomeLabel,
  type CareerEvolutionCapability,
  type CareerEvolutionConfig,
  type CareerEvolutionDateDisplay,
  type CareerEvolutionLayout,
  type CareerEvolutionMilestone,
  type DisplayLabelProposal,
} from "@/lib/career-evolution"

/** Keep short display labels (and their origin) when graph text is re-parsed. */
function mergeMilestoneDisplayLabels(
  parsed: CareerEvolutionMilestone[],
  previous: CareerEvolutionMilestone[],
): CareerEvolutionMilestone[] {
  if (!previous.length) return parsed
  return parsed.map((m) => {
    const prev =
      previous.find((p) => p.id === m.id) ||
      previous.find(
        (p) =>
          p.label === m.label &&
          (p.start || "") === (m.start || "") &&
          (p.end || "") === (m.end || ""),
      )
    if (!prev) return m
    // Preserve user edits including intentional empties; never rewrite Graph-text label.
    if (prev.displayLabelOrigin === "user") {
      return {
        ...m,
        displayLabel: prev.displayLabel?.trim() || undefined,
        displayLabelOrigin: "user",
      }
    }
    if (prev.displayLabel?.trim()) {
      return {
        ...m,
        displayLabel: prev.displayLabel.trim(),
        displayLabelOrigin: prev.displayLabelOrigin || "user",
      }
    }
    return m
  })
}
import {
  isParallelExperienceWorkType,
  listExperienceRolesForEditor,
} from "@/lib/experience-work-modifier"
import {
  FormatterDarkInput,
  FormatterPopoverSection,
  FormatterToggleRow,
} from "@/components/formatter-popover-shell"
import { toast } from "@/components/ui/use-toast"
import type { FormatterContactInfo } from "@/components/resume-formatter-sidebar"

type CareerEvolutionPanelProps = {
  resumeText: string
  onResumeTextChange?: (next: string) => void
  contactInfo: FormatterContactInfo
  setContactInfo: (info: FormatterContactInfo) => void
  targetRole?: string
  targetCompany?: string
  jobDescription?: string
  careerPositioning?: string
  language?: "en" | "de"
}

type StatusTone = "info" | "success" | "error" | "warn"

export function CareerEvolutionPanel({
  resumeText,
  onResumeTextChange,
  contactInfo,
  setContactInfo,
  targetRole,
  targetCompany,
  jobDescription,
  careerPositioning,
  language = "en",
}: CareerEvolutionPanelProps) {
  const migratedRef = useRef(false)
  /** While true, do not clobber local textarea from contactInfo sync. */
  const editorDirtyRef = useRef(false)
  const alignmentDirtyRef = useRef(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<{ tone: StatusTone; message: string } | null>(null)
  /** Suggested Skills Convergence boxes — applied only via “Use suggestions”. */
  const [capabilitySuggestions, setCapabilitySuggestions] = useState<{
    capabilities: CareerEvolutionCapability[]
    convergenceTarget: string
  } | null>(null)

  const config = useMemo(
    () => resolveCareerEvolutionConfig(contactInfo.careerEvolution, resumeText),
    [contactInfo.careerEvolution, resumeText],
  )

  const [editorText, setEditorText] = useState(() => {
    const initial = resolveCareerEvolutionConfig(contactInfo.careerEvolution, resumeText)
    return (
      initial.sourceText ??
      (initial.milestones.length ? serializeCareerEvolutionText(initial) : "")
    )
  })

  const [alignmentEditorText, setAlignmentEditorText] = useState(() => {
    const initial = ensureAlignmentSourceText(
      resolveCareerEvolutionConfig(contactInfo.careerEvolution, resumeText),
    )
    return (
      initial.alignmentSourceText?.trim() ||
      (initial.alignments && initial.alignments.length > 0
        ? serializeCareerEvolutionAlignmentText(initial.alignments)
        : "")
    )
  })

  // Sync from saved application state only when the user is not mid-edit.
  useEffect(() => {
    if (editorDirtyRef.current) return
    const saved = config.sourceText
    const next =
      typeof saved === "string"
        ? saved
        : config.milestones.length
          ? serializeCareerEvolutionText(config)
          : ""
    setEditorText((prev) => (prev === next ? prev : next))
  }, [contactInfo.careerEvolution, config.milestones.length, config.sourceText])

  useEffect(() => {
    if (alignmentDirtyRef.current) return
    const ensured = ensureAlignmentSourceText(config)
    const next =
      typeof ensured.alignmentSourceText === "string"
        ? ensured.alignmentSourceText
        : ensured.alignments && ensured.alignments.length > 0
          ? serializeCareerEvolutionAlignmentText(ensured.alignments)
          : ""
    setAlignmentEditorText((prev) => (prev === next ? prev : next))
  }, [
    contactInfo.careerEvolution,
    config.alignmentSourceText,
    config.alignments,
  ])

  useEffect(() => {
    if (migratedRef.current) return
    if (contactInfo.careerEvolution != null) {
      migratedRef.current = true
      return
    }
    const extracted = extractCareerEvolution(resumeText)
    if (!extracted.config) {
      migratedRef.current = true
      return
    }
    migratedRef.current = true
    const migrated = normalizeCareerEvolutionConfig({
      ...extracted.config,
      sourceText:
        extracted.config.sourceText?.trim() ||
        serializeCareerEvolutionText(extracted.config),
    })
    setContactInfo({ ...contactInfo, careerEvolution: migrated })
    onResumeTextChange?.(extracted.resumeWithoutBlock)
  }, [contactInfo, onResumeTextChange, resumeText, setContactInfo])

  /** Last graph that parsed cleanly — kept on the preview while the editor is mid-edit/invalid. */
  const lastValidStructuredRef = useRef<{
    tracks: CareerEvolutionConfig["tracks"]
    milestones: CareerEvolutionConfig["milestones"]
    connections: CareerEvolutionConfig["connections"]
  } | null>(
    config.milestones.length
      ? {
          tracks: config.tracks,
          milestones: config.milestones,
          connections: filterValidConnections(config.connections, config.milestones),
        }
      : null,
  )

  const parseResult = useMemo(() => {
    try {
      return parseCareerEvolutionText(editorText, config)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Graph text could not be parsed."
      console.error("[career-evolution] Graph text parse failed:", err)
      return {
        config: {
          ...config,
          sourceText: editorText,
        },
        errors: [`Graph text error: ${message}`],
        warnings: [] as string[],
      }
    }
  }, [editorText, config])

  const alignmentParseResult = useMemo(
    () => parseCareerEvolutionAlignmentText(alignmentEditorText, config.alignments),
    [alignmentEditorText, config.alignments],
  )

  const showAlignmentEditor = config.layout === "alignment"
  const showConvergenceEditor = config.layout === "convergence"

  const editableCapabilities = useMemo((): CareerEvolutionCapability[] => {
    const stored = (config.capabilities || []).filter((c) => c?.id)
    if (stored.length > 0) return stored.slice(0, CAREER_EVOLUTION_CAPABILITY_MAX)
    return []
  }, [config.capabilities])

  const editorIsEmpty = !editorText.trim()
  const hasProtectedEdits =
    hasUserProtectedCareerEvolutionEdits(config) && hasMeaningfulCareerEvolutionNarrative(config)
  const pending = config.pendingSuggestion
  const pendingPreview = pending?.sourceText?.trim() || ""
  const showPendingBanner =
    Boolean(pending) &&
    hasProtectedEdits &&
    pendingPreview.length > 0 &&
    pendingPreview !== editorText.trim()

  const persist = (next: CareerEvolutionConfig) => {
    setContactInfo({
      ...contactInfo,
      careerEvolution: normalizeCareerEvolutionConfig(next),
    })
  }

  /**
   * Presentation-only (layout, density, position, visibility, connection toggles).
   * Must not re-parse graph text or rewrite milestones/tracks — that was wiping
   * track structure and made Parallel fall back to Progression in the preview.
   */
  const updatePresentation = (patch: Partial<CareerEvolutionConfig>) => {
    persist({
      ...config,
      sourceText: editorText || config.sourceText,
      alignmentSourceText: alignmentEditorText || config.alignmentSourceText,
      tracks: config.tracks,
      milestones: config.milestones,
      connections: config.connections,
      capabilities: patch.capabilities ?? config.capabilities,
      alignments: patch.alignments ?? config.alignments,
      convergenceTarget:
        patch.convergenceTarget !== undefined
          ? patch.convergenceTarget
          : config.convergenceTarget,
      convergenceTargetOrigin:
        patch.convergenceTargetOrigin !== undefined
          ? patch.convergenceTargetOrigin
          : config.convergenceTargetOrigin,
      visible: patch.visible ?? config.visible,
      userDisabled:
        patch.userDisabled ??
        (patch.visible === false
          ? true
          : patch.visible === true
            ? false
            : config.userDisabled),
      layout: patch.layout ?? config.layout,
      density: patch.density ?? config.density,
      dateDisplay: patch.dateDisplay ?? config.dateDisplay,
      position: patch.position ?? config.position,
      showParallelWork: patch.showParallelWork ?? config.showParallelWork,
      showConnectionIcon: patch.showConnectionIcon ?? config.showConnectionIcon,
      showConnectionLabels: patch.showConnectionLabels ?? config.showConnectionLabels,
      origin: config.origin,
      userEditedAt: config.userEditedAt,
      pendingSuggestion: config.pendingSuggestion,
      omitReason: patch.visible === true ? undefined : config.omitReason,
      graphTitle: config.graphTitle,
      generatedForRole: config.generatedForRole,
      generatedAt: config.generatedAt,
      ...("alignmentSourceText" in patch
        ? { alignmentSourceText: patch.alignmentSourceText }
        : {}),
    })
  }

  const handleVisibility = (checked: boolean) => {
    updatePresentation({
      visible: checked,
      userDisabled: !checked,
    })
  }

  const handleDisplayLabelChange = (milestoneId: string, value: string) => {
    // Keep identity (id / Graph-text label / connections) untouched.
    // Persist raw text so mid-edit empties are allowed; mark origin "user"
    // even when empty so backfill / regenerate never fight the clear.
    const nextLabel = value.replace(/\s+/g, " ")
    persist({
      ...config,
      milestones: config.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              displayLabel: nextLabel.trim() ? nextLabel.trim() : undefined,
              displayLabelOrigin: "user" as const,
            }
          : m,
      ),
      sourceText: editorText,
      userEditedAt: Date.now(),
      origin: config.origin === "ai" ? "mixed" : config.origin,
    })
  }

  const [labelProposals, setLabelProposals] = useState<DisplayLabelProposal[] | null>(
    null,
  )

  const displayLabelContext = useMemo(
    () => ({
      language: language === "de" ? ("de" as const) : ("en" as const),
      layout: config.layout,
      targetRole: targetRole || contactInfo.targetRole || "",
      jobDescription: jobDescription || "",
    }),
    [language, config.layout, targetRole, contactInfo.targetRole, jobDescription],
  )

  // One-shot backfill for milestones that never received a short label.
  // Must not re-run when the user clears a field — that fought parent
  // onResumeUpdate sync and hit React error #185 (max update depth).
  const backfillDoneRef = useRef(false)
  useEffect(() => {
    if (backfillDoneRef.current) return
    if (!config.milestones.length) return
    const needsFill = config.milestones.some(
      (m) => !m.displayLabel?.trim() && m.displayLabelOrigin !== "user",
    )
    if (!needsFill) {
      backfillDoneRef.current = true
      return
    }
    backfillDoneRef.current = true
    const filled = applySuggestedDisplayLabels(config.milestones, {
      mode: "missing",
      ...displayLabelContext,
    })
    if (
      filled.every(
        (m, i) =>
          (m.displayLabel || "") === (config.milestones[i]?.displayLabel || "") &&
          m.displayLabelOrigin === config.milestones[i]?.displayLabelOrigin,
      )
    ) {
      return
    }
    persist({
      ...config,
      milestones: filled,
      sourceText: editorText || config.sourceText,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot only
  }, [config.milestones, displayLabelContext])

  // One-shot: replace a legacy dumped vacancy title in Central Outcome with a
  // capability-based label. Never touches user-edited outcomes.
  const outcomeMigrateDoneRef = useRef(false)
  useEffect(() => {
    if (outcomeMigrateDoneRef.current) return
    if (config.layout !== "convergence") return
    const role = targetRole || contactInfo.targetRole || ""
    if (isUserProtectedConvergenceTarget(config, role)) {
      outcomeMigrateDoneRef.current = true
      return
    }
    const current = config.convergenceTarget?.trim() || ""
    const looksLikeJobTitle =
      !current ||
      (role &&
        current.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ===
          role.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()) ||
      /\(f\/m\/x\)|\(m\/w\/d\)|\(w\/m\/d\)/i.test(current)
    if (!looksLikeJobTitle && config.convergenceTargetOrigin === "auto") {
      outcomeMigrateDoneRef.current = true
      return
    }
    if (!looksLikeJobTitle) {
      outcomeMigrateDoneRef.current = true
      return
    }
    outcomeMigrateDoneRef.current = true
    const next = suggestCentralOutcomeLabel({
      language: language === "de" ? "de" : "en",
      targetRole: role,
      jobDescription: jobDescription || "",
      capabilities: editableCapabilities,
    })
    if (!next || next === current) return
    persist({
      ...config,
      convergenceTarget: next,
      convergenceTargetOrigin: "auto",
      sourceText: editorText || config.sourceText,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot migrate
  }, [config.layout, config.convergenceTarget, config.convergenceTargetOrigin])

  const handleProposeRegenerateLabels = () => {
    const proposals = proposeMilestoneDisplayLabels(config.milestones, displayLabelContext)
    setLabelProposals(proposals)
    const changing = proposals.filter(
      (p) => p.proposed && p.proposed !== (p.current || "") && !p.protectedEdit,
    ).length
    const protectedCount = proposals.filter((p) => p.protectedEdit).length
    setStatus({
      tone: "info",
      message:
        language === "de"
          ? `${changing} Kurzlabel(s) vorgeschlagen${protectedCount ? ` · ${protectedCount} manuell belassen` : ""}.`
          : `${changing} label(s) proposed${protectedCount ? ` · ${protectedCount} manual kept` : ""}.`,
    })
  }

  const handleApplyLabelProposals = () => {
    if (!labelProposals?.length) return
    const byId = new Map(labelProposals.map((p) => [p.milestoneId, p]))
    const nextMilestones = config.milestones.map((m) => {
      const p = byId.get(m.id)
      if (!p?.proposed) return m
      if (p.protectedEdit) return m
      return {
        ...m,
        displayLabel: p.proposed,
        displayLabelOrigin: "auto" as const,
      }
    })
    persist({
      ...config,
      milestones: nextMilestones,
      sourceText: editorText || config.sourceText,
    })
    setLabelProposals(null)
    setStatus({
      tone: "success",
      message:
        language === "de"
          ? "Kurzlabels aktualisiert (manuelle Einträge unverändert)."
          : "Short labels updated (manual edits kept).",
    })
    toast({
      title: language === "de" ? "Kurzlabels aktualisiert" : "Short labels updated",
      description:
        language === "de"
          ? "Manuell bearbeitete Labels wurden beibehalten."
          : "Manually edited labels were preserved.",
    })
  }

  const handleDismissLabelProposals = () => {
    setLabelProposals(null)
    setStatus({
      tone: "info",
      message: language === "de" ? "Kurzlabels unverändert." : "Short labels unchanged.",
    })
  }

  const handleAlignmentEditorChange = (text: string) => {
    alignmentDirtyRef.current = true
    setAlignmentEditorText(text)
    setStatus(null)
    const parsed = parseCareerEvolutionAlignmentText(text, config.alignments)
    if (parsed.errors.length === 0) {
      persist({
        ...config,
        sourceText: editorText || config.sourceText,
        alignmentSourceText: text,
        alignments: parsed.alignments,
        tracks: config.tracks,
        milestones: config.milestones,
        connections: config.connections,
        capabilities: config.capabilities,
        layout: "alignment",
        visible:
          config.userDisabled === true
            ? false
            : config.visible === true || parsed.alignments.length > 0,
        userDisabled: config.userDisabled,
        origin: text.trim() ? "user" : config.origin,
        userEditedAt: text.trim() ? Date.now() : config.userEditedAt,
        omitReason:
          config.userDisabled === true
            ? config.omitReason
            : parsed.alignments.length > 0
              ? undefined
              : config.omitReason,
      })
    } else {
      // Keep typed text even when invalid — do not wipe structured pairs until valid.
      persist({
        ...config,
        sourceText: editorText || config.sourceText,
        alignmentSourceText: text,
        origin: text.trim() ? "user" : config.origin,
        userEditedAt: text.trim() ? Date.now() : config.userEditedAt,
      })
    }
  }

  const handleAlignmentEditorBlur = () => {
    alignmentDirtyRef.current = false
  }

  /**
   * Seed / migrate Evidence-to-Role from JD + Career Profile (never TRACK stage labels).
   */
  const seedAlignmentsFromJobContext = (): Partial<CareerEvolutionConfig> | null => {
    const jd = jobDescription?.trim() || ""
    if (!resumeText.trim()) return null
    if (!jd && !targetRole?.trim()) return null
    try {
      const suggestion = buildCareerEvolutionSuggestion({
        resumeText,
        targetRole,
        targetCompany,
        jobDescription: jd,
        careerPositioning,
        language,
      })
      const nextAlignments = suggestion.config.alignments || []
      if (nextAlignments.length === 0) return null
      return {
        alignments: nextAlignments,
        alignmentSourceText:
          suggestion.config.alignmentSourceText?.trim() ||
          serializeCareerEvolutionAlignmentText(nextAlignments),
      }
    } catch (err) {
      console.error("[career-evolution] alignment seed failed", err)
      return null
    }
  }

  const selectLayout = (layout: CareerEvolutionLayout) => {
    // Layout only — never regenerate TRACK milestones / graph text.
    const patch: Partial<CareerEvolutionConfig> = { layout }
    if (layout === "alignment") {
      // Prefer an already-authored ALIGNMENT dataset. Otherwise regenerate from
      // JD + Career Profile — never invent pairs from TRACK career-stage labels.
      const authoredText = (config.alignmentSourceText || "").trim()
      if (authoredText) {
        const parsed = parseCareerEvolutionAlignmentText(
          authoredText,
          config.alignments,
        )
        if (parsed.errors.length === 0 && parsed.alignments.length > 0) {
          patch.alignments = parsed.alignments
          patch.alignmentSourceText = authoredText
          setAlignmentEditorText(authoredText)
        } else {
          patch.alignmentSourceText = authoredText
          setAlignmentEditorText(authoredText)
        }
      } else {
        const seeded = seedAlignmentsFromJobContext()
        if (seeded?.alignments?.length) {
          patch.alignments = seeded.alignments
          patch.alignmentSourceText = seeded.alignmentSourceText
          setAlignmentEditorText(
            seeded.alignmentSourceText || emptyAlignmentSourceText(),
          )
        } else if ((config.alignments || []).length > 0) {
          // Last resort: keep structured pairs only if they already look like
          // verified evidence refs (contain @ / · / company-like text), else empty.
          const usable = (config.alignments || []).filter((a) => {
            const ev = a.evidenceLabel.trim()
            return (
              ev.length > 0 &&
              a.requirementLabel.trim().length > 0 &&
              /@|·| at | — | - /.test(ev)
            )
          })
          if (usable.length > 0) {
            const text = serializeCareerEvolutionAlignmentText(usable)
            patch.alignments = usable
            patch.alignmentSourceText = text
            setAlignmentEditorText(text)
          } else {
            patch.alignmentSourceText = emptyAlignmentSourceText()
            patch.alignments = []
            setAlignmentEditorText(emptyAlignmentSourceText())
          }
        } else {
          patch.alignmentSourceText = emptyAlignmentSourceText()
          setAlignmentEditorText(emptyAlignmentSourceText())
        }
      }
    }
    if (layout === "convergence") {
      const existing = (config.capabilities || []).filter((c) =>
        String(c.label ?? "").trim(),
      )
      // Seed only when empty — never overwrite user-authored capabilities.
      if (existing.length < CAREER_EVOLUTION_CAPABILITY_MIN) {
        const derived = capabilitiesForRender({ ...config, capabilities: [] })
        if (derived.length >= CAREER_EVOLUTION_CAPABILITY_MIN) {
          patch.capabilities = derived
            .slice(0, CAREER_EVOLUTION_CAPABILITY_DEFAULT)
            .map((c) => ({
              id: newCareerEvolutionId("cap"),
              label: c.label,
              evidenceRef: c.evidenceRef,
            }))
        }
      }
      if (!String(config.convergenceTarget ?? "").trim()) {
        const seededCaps =
          (patch.capabilities as CareerEvolutionCapability[] | undefined) ||
          editableCapabilities
        patch.convergenceTarget = suggestCentralOutcomeLabel({
          language: language === "de" ? "de" : "en",
          targetRole: targetRole || contactInfo.targetRole || "",
          jobDescription: jobDescription || "",
          capabilities: seededCaps,
        })
        patch.convergenceTargetOrigin = "auto"
      }
    }
    updatePresentation(patch)
  }

  const persistCapabilities = (
    nextCaps: CareerEvolutionCapability[],
    nextTarget?: string,
    options?: { targetOrigin?: "auto" | "user" },
  ) => {
    const cleaned = nextCaps
      .map((c) => ({
        id: c.id || newCareerEvolutionId("cap"),
        label: String(c.label ?? ""),
        evidenceRef: c.evidenceRef,
      }))
      .slice(0, CAREER_EVOLUTION_CAPABILITY_MAX)
    const targetChanged = nextTarget !== undefined
    persist({
      ...config,
      capabilities: cleaned,
      convergenceTarget: targetChanged ? nextTarget : config.convergenceTarget,
      convergenceTargetOrigin: targetChanged
        ? options?.targetOrigin || "user"
        : config.convergenceTargetOrigin,
      sourceText: editorText || config.sourceText,
      alignmentSourceText: alignmentEditorText || config.alignmentSourceText,
      tracks: config.tracks,
      milestones: config.milestones,
      connections: config.connections,
      origin: config.origin === "ai" ? "mixed" : config.origin || "user",
      userEditedAt: Date.now(),
      pendingSuggestion: config.pendingSuggestion,
    })
  }

  const updateCentralOutcomeLabel = (value: string) => {
    persistCapabilities(editableCapabilities, value, { targetOrigin: "user" })
  }

  const updateCapabilityLabel = (id: string, label: string) => {
    persistCapabilities(
      editableCapabilities.map((c) => (c.id === id ? { ...c, label } : c)),
    )
  }

  const moveCapability = (id: string, direction: -1 | 1) => {
    const idx = editableCapabilities.findIndex((c) => c.id === id)
    if (idx < 0) return
    const next = idx + direction
    if (next < 0 || next >= editableCapabilities.length) return
    const copy = [...editableCapabilities]
    const [item] = copy.splice(idx, 1)
    copy.splice(next, 0, item!)
    persistCapabilities(copy)
  }

  const removeCapability = (id: string) => {
    if (editableCapabilities.length <= CAREER_EVOLUTION_CAPABILITY_MIN) {
      setStatus({
        tone: "warn",
        message: `Skills Convergence needs at least ${CAREER_EVOLUTION_CAPABILITY_MIN} capabilities.`,
      })
      return
    }
    persistCapabilities(editableCapabilities.filter((c) => c.id !== id))
  }

  const addCapability = () => {
    if (editableCapabilities.length >= CAREER_EVOLUTION_CAPABILITY_MAX) {
      setStatus({
        tone: "warn",
        message: `At most ${CAREER_EVOLUTION_CAPABILITY_MAX} capabilities.`,
      })
      return
    }
    persistCapabilities([
      ...editableCapabilities,
      { id: newCareerEvolutionId("cap"), label: "New capability" },
    ])
  }

  const runSuggestCapabilities = () => {
    setStatus(null)
    setGenerating(true)
    try {
      const suggestion = buildCareerEvolutionSuggestion({
        resumeText,
        targetRole,
        targetCompany,
        jobDescription: jobDescription?.trim() || "",
        careerPositioning,
        language,
      })
      const caps = (suggestion.config.capabilities || [])
        .filter((c) => String(c.label ?? "").trim())
        .slice(0, CAREER_EVOLUTION_CAPABILITY_DEFAULT)
        .map((c) => ({
          id: newCareerEvolutionId("cap"),
          label: c.label,
          evidenceRef: c.evidenceRef,
        }))
      if (caps.length < CAREER_EVOLUTION_CAPABILITY_MIN) {
        const derived = capabilitiesForRender({
          ...config,
          capabilities: [],
        })
          .slice(0, CAREER_EVOLUTION_CAPABILITY_DEFAULT)
          .map((c) => ({
            id: newCareerEvolutionId("cap"),
            label: c.label,
            evidenceRef: c.evidenceRef,
          }))
        if (derived.length < CAREER_EVOLUTION_CAPABILITY_MIN) {
          const message =
            "Could not suggest capabilities from this CV and job description."
          setStatus({ tone: "warn", message })
          toast({ title: "No suggestions", description: message })
          return
        }
        const proposedOutcome = suggestCentralOutcomeLabel({
          language: language === "de" ? "de" : "en",
          targetRole: targetRole || contactInfo.targetRole || "",
          jobDescription: jobDescription || "",
          capabilities: derived,
        })
        setCapabilitySuggestions({
          capabilities: derived,
          convergenceTarget:
            suggestion.config.convergenceTarget?.trim() || proposedOutcome,
        })
      } else {
        const proposedOutcome = suggestCentralOutcomeLabel({
          language: language === "de" ? "de" : "en",
          targetRole: targetRole || contactInfo.targetRole || "",
          jobDescription: jobDescription || "",
          capabilities: caps,
        })
        setCapabilitySuggestions({
          capabilities: caps,
          convergenceTarget:
            suggestion.config.convergenceTarget?.trim() || proposedOutcome,
        })
      }
      setStatus({
        tone: "info",
        message:
          "Suggestions ready — review below, then choose Use suggestions to apply.",
      })
    } catch (err) {
      console.error("[career-evolution] capability suggest failed", err)
      const message = err instanceof Error ? err.message : "Suggestion failed."
      setStatus({ tone: "error", message })
      toast({ title: "Suggestion failed", description: message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const applyCapabilitySuggestions = () => {
    if (!capabilitySuggestions) return
    const keepOutcome = isUserProtectedConvergenceTarget(
      config,
      targetRole || contactInfo.targetRole || "",
    )
    persistCapabilities(
      capabilitySuggestions.capabilities,
      keepOutcome ? config.convergenceTarget : capabilitySuggestions.convergenceTarget,
      { targetOrigin: keepOutcome ? "user" : "auto" },
    )
    setCapabilitySuggestions(null)
    setStatus({
      tone: "success",
      message: keepOutcome
        ? "Applied capability suggestions. Central Outcome Label kept (manual edit)."
        : "Applied capability suggestions. Career TRACK history unchanged.",
    })
  }

  const dismissCapabilitySuggestions = () => {
    setCapabilitySuggestions(null)
    setStatus({ tone: "info", message: "Kept your current capabilities." })
  }

  /** Generate / refresh evidence→requirement pairs without overwriting graph text. */
  const runGenerateAlignments = () => {
    setStatus(null)
    const jd = jobDescription?.trim() || ""
    if (!resumeText.trim()) {
      const message = "Add CV experience before generating evidence mappings."
      setStatus({ tone: "error", message })
      toast({ title: "Cannot generate", description: message, variant: "destructive" })
      return
    }
    if (!jd && !targetRole?.trim()) {
      const message = "Add a job description or target role to map evidence to requirements."
      setStatus({ tone: "error", message })
      toast({ title: "Missing job context", description: message, variant: "destructive" })
      return
    }
    setGenerating(true)
    try {
      const suggestion = buildCareerEvolutionSuggestion({
        resumeText,
        targetRole,
        targetCompany,
        jobDescription: jd,
        careerPositioning,
        language,
      })
      const nextAlignments = suggestion.config.alignments || []
      if (nextAlignments.length === 0) {
        const message =
          "No verified evidence-to-requirement pairs could be built from this CV and job description."
        setStatus({ tone: "warn", message })
        toast({ title: "No mappings found", description: message })
        return
      }
      const alignmentText =
        suggestion.config.alignmentSourceText?.trim() ||
        serializeCareerEvolutionAlignmentText(nextAlignments)
      // Preserve TRACK graph text / milestones / Skills Convergence — only attach ALIGNMENT
      persist({
        ...config,
        layout: "alignment",
        alignments: nextAlignments,
        alignmentSourceText: alignmentText,
        capabilities: config.capabilities,
        convergenceTarget: config.convergenceTarget,
        sourceText: editorText || config.sourceText,
        visible: config.userDisabled === true ? false : true,
        userDisabled: config.userDisabled,
        origin: config.origin === "user" ? "mixed" : config.origin || "ai",
        generatedAt: Date.now(),
        generatedForRole: targetRole || config.generatedForRole,
        omitReason: undefined,
      })
      setAlignmentEditorText(alignmentText)
      const message = `Added ${nextAlignments.length} evidence-to-requirement pair${nextAlignments.length === 1 ? "" : "s"}. Timeline graph text unchanged.`
      setStatus({ tone: "success", message })
      toast({ title: "Evidence mappings ready", description: message })
    } catch (err) {
      console.error("[career-evolution] alignment generate failed", err)
      const message = err instanceof Error ? err.message : "Generation failed unexpectedly."
      setStatus({ tone: "error", message })
      toast({ title: "Generation failed", description: message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const handleEditorChange = (text: string) => {
    editorDirtyRef.current = true
    setEditorText(text)
    setStatus(null)

    let parsed: ReturnType<typeof parseCareerEvolutionText>
    try {
      parsed = parseCareerEvolutionText(text, config)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Graph text could not be parsed."
      console.error("[career-evolution] Graph text parse failed on edit:", err)
      setStatus({
        tone: "error",
        message: `Invalid Graph text — last valid graph kept. ${message}`,
      })
      // Preserve typed text + last valid structured graph so the CV preview never blanks.
      const last = lastValidStructuredRef.current
      persist({
        ...config,
        ...(last
          ? {
              tracks: last.tracks,
              milestones: last.milestones,
              connections: last.connections,
            }
          : {}),
        sourceText: text,
        origin: text.trim() ? "user" : config.origin,
        userEditedAt: text.trim() ? Date.now() : config.userEditedAt,
        alignments: config.alignments,
        alignmentSourceText: alignmentEditorText || config.alignmentSourceText,
      })
      return
    }

    const narrativeEmpty = !text.trim()
    const base: CareerEvolutionConfig = {
      ...config,
      sourceText: text,
      origin: narrativeEmpty ? (config.origin === "ai" ? "ai" : config.origin) : "user",
      userEditedAt: narrativeEmpty ? undefined : Date.now(),
      pendingSuggestion: narrativeEmpty ? undefined : config.pendingSuggestion,
    }
    if (parsed.errors.length === 0) {
      const mergedMilestones = mergeMilestoneDisplayLabels(
        parsed.config.milestones,
        config.milestones,
      )
      const safeConnections = filterValidConnections(
        parsed.config.connections,
        mergedMilestones,
      )
      lastValidStructuredRef.current = {
        tracks: parsed.config.tracks,
        milestones: mergedMilestones,
        connections: safeConnections,
      }
      const visible =
        config.userDisabled === true
          ? false
          : config.visible === true || mergedMilestones.length > 0
      persist({
        ...config,
        tracks: parsed.config.tracks,
        milestones: mergedMilestones,
        connections: safeConnections,
        sourceText: text,
        // Keep Evidence-to-Role dataset independent of TRACK edits
        alignments: config.alignments,
        alignmentSourceText: alignmentEditorText || config.alignmentSourceText,
        capabilities: config.capabilities,
        convergenceTarget: config.convergenceTarget,
        visible,
        userDisabled: config.userDisabled,
        layout: config.layout,
        density: config.density,
        dateDisplay: config.dateDisplay,
        position: config.position,
        showParallelWork: config.showParallelWork,
        showConnectionIcon: config.showConnectionIcon,
        showConnectionLabels: config.showConnectionLabels,
        origin: base.origin,
        userEditedAt: base.userEditedAt,
        pendingSuggestion: base.pendingSuggestion,
        graphTitle: config.graphTitle,
        generatedForRole: config.generatedForRole,
        generatedAt: config.generatedAt,
        omitReason: visible ? undefined : config.omitReason,
      })
    } else {
      // Keep typed text; retain last valid tracks/milestones/connections for the preview.
      const last = lastValidStructuredRef.current
      persist({
        ...base,
        ...(last
          ? {
              tracks: last.tracks,
              milestones: last.milestones,
              connections: last.connections,
            }
          : {}),
        alignments: config.alignments,
        alignmentSourceText: alignmentEditorText || config.alignmentSourceText,
      })
    }
  }

  const handleEditorBlur = () => {
    editorDirtyRef.current = false
  }

  const applyGenerated = (suggestionConfig: CareerEvolutionConfig, opts?: { forceVisible?: boolean }) => {
    const hasMilestones = suggestionConfig.milestones.length > 0
    const hasAlignments = (suggestionConfig.alignments?.length || 0) > 0
    const text = suggestionConfig.sourceText?.trim() || serializeCareerEvolutionText(suggestionConfig)
    const alignmentText =
      suggestionConfig.alignmentSourceText?.trim() ||
      (hasAlignments
        ? serializeCareerEvolutionAlignmentText(suggestionConfig.alignments || [])
        : "")
    const visible =
      config.userDisabled === true
        ? false
        : opts?.forceVisible === true ||
          suggestionConfig.visible === true ||
          hasMilestones ||
          (suggestionConfig.layout === "alignment" && hasAlignments)
    // Never silently overwrite Skills Convergence boxes / user central outcome.
    const existingCaps = (config.capabilities || []).filter((c) =>
      String(c.label ?? "").trim(),
    )
    const keepCapabilities = existingCaps.length >= CAREER_EVOLUTION_CAPABILITY_MIN
    const keepTarget = isUserProtectedConvergenceTarget(
      config,
      targetRole || contactInfo.targetRole || suggestionConfig.generatedForRole || "",
    )
    const next: CareerEvolutionConfig = {
      ...suggestionConfig,
      sourceText: text,
      alignmentSourceText: alignmentText || suggestionConfig.alignmentSourceText,
      capabilities: keepCapabilities ? config.capabilities : suggestionConfig.capabilities,
      convergenceTarget: keepTarget
        ? config.convergenceTarget
        : suggestionConfig.convergenceTarget,
      convergenceTargetOrigin: keepTarget
        ? "user"
        : suggestionConfig.convergenceTargetOrigin || "auto",
      visible,
      userDisabled: config.userDisabled === true,
      pendingSuggestion: undefined,
      origin: keepCapabilities || keepTarget ? (config.origin === "user" ? "user" : "mixed") : "ai",
      userEditedAt: keepCapabilities || keepTarget ? config.userEditedAt : undefined,
      omitReason: visible ? undefined : suggestionConfig.omitReason,
    }
    editorDirtyRef.current = false
    alignmentDirtyRef.current = false
    setEditorText(text)
    if (alignmentText) setAlignmentEditorText(alignmentText)
    persist(next)
    return next
  }

  const runGenerate = () => {
    setStatus(null)
    const jd = jobDescription?.trim() || ""
    const hasCvEvidence = /EXPERIENCE|BERUFSERFAHRUNG|WERDEGANG/i.test(resumeText)

    if (!resumeText.trim()) {
      const message = "Add CV experience before generating Career Evolution."
      setStatus({ tone: "error", message })
      toast({ title: "Cannot generate", description: message, variant: "destructive" })
      return
    }
    if (!jd && !targetRole?.trim()) {
      const message = "Add a job description or target role for this application."
      setStatus({ tone: "error", message })
      toast({ title: "Missing job context", description: message, variant: "destructive" })
      return
    }
    if (!hasCvEvidence) {
      const message = "No EXPERIENCE section found in this CV — generation needs verified career evidence."
      setStatus({ tone: "error", message })
      toast({ title: "Missing career evidence", description: message, variant: "destructive" })
      return
    }

    setGenerating(true)
    try {
      const suggestion = buildCareerEvolutionSuggestion({
        resumeText,
        targetRole,
        targetCompany,
        jobDescription: jd,
        careerPositioning,
        language,
      })

      if (!suggestion.config.milestones.length) {
        const message =
          suggestion.omitReason ||
          "Could not build a meaningful graph from the available evidence."
        setStatus({ tone: "warn", message })
        toast({ title: "Nothing to generate", description: message })
        return
      }

      const text =
        suggestion.config.sourceText?.trim() ||
        serializeCareerEvolutionText(suggestion.config)
      if (!text) {
        setStatus({
          tone: "error",
          message: "Generation produced milestones but no graph text — please try again.",
        })
        toast({
          title: "Generation failed",
          description: "No graph text was produced.",
          variant: "destructive",
        })
        return
      }

      // Empty editor / no protected narrative → apply immediately
      if (editorIsEmpty || !hasProtectedEdits) {
        const applied = applyGenerated(suggestion.config, { forceVisible: true })
        if (applied.visible && applied.milestones.length === 0) {
          setStatus({
            tone: "error",
            message: "Graph was saved but has no milestones to render.",
          })
          return
        }
        const message = applied.visible
          ? `Generated ${applied.milestones.length} milestones and showed the graph in your CV preview.`
          : `Generated ${applied.milestones.length} milestones (graph kept off because you disabled it).`
        setStatus({ tone: "success", message })
        toast({ title: "Career Evolution generated", description: message })
        return
      }

      // Meaningful user edits → pending approval only
      const merged = mergeCareerEvolutionOnRegenerate(config, {
        ...suggestion.config,
        sourceText: text,
      })
      persist(merged)
      if (merged.pendingSuggestion) {
        const message = "New suggestion ready — apply it or keep your current version."
        setStatus({ tone: "info", message })
        toast({ title: "Suggestion ready", description: message })
      } else {
        const applied = applyGenerated(suggestion.config, { forceVisible: true })
        setStatus({
          tone: "success",
          message: `Updated graph with ${applied.milestones.length} milestones.`,
        })
        toast({ title: "Career Evolution updated", description: "Graph refreshed." })
      }
    } catch (err) {
      console.error("[career-evolution] generate failed", err)
      const message = err instanceof Error ? err.message : "Generation failed unexpectedly."
      setStatus({ tone: "error", message })
      toast({ title: "Generation failed", description: message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const handleAcceptPending = () => {
    const next = acceptPendingCareerEvolution(config)
    const text = next.sourceText?.trim() || serializeCareerEvolutionText(next)
    const alignmentText =
      next.alignmentSourceText?.trim() ||
      ((next.alignments?.length || 0) > 0
        ? serializeCareerEvolutionAlignmentText(next.alignments || [])
        : "")
    editorDirtyRef.current = false
    alignmentDirtyRef.current = false
    setEditorText(text)
    if (alignmentText) setAlignmentEditorText(alignmentText)
    persist({
      ...next,
      sourceText: text,
      alignmentSourceText: alignmentText || next.alignmentSourceText,
      pendingSuggestion: undefined,
    })
    const message = next.visible
      ? "Applied suggestion — graph updated in preview."
      : "Applied suggestion (graph remains hidden)."
    setStatus({ tone: "success", message })
    toast({ title: "Suggestion applied", description: message })
  }

  const handleDismissPending = () => {
    persist({ ...config, pendingSuggestion: undefined })
    setStatus({ tone: "info", message: "Kept your current Career Evolution text." })
  }

  const insertExample = () => {
    if (editorText.trim()) return
    handleEditorChange(CAREER_EVOLUTION_SYNTAX_HELP.trim() + "\n")
  }

  const generateLabel = editorIsEmpty
    ? "Generate Career Evolution"
    : "Regenerate Career Evolution"

  return (
    <CareerEvolutionErrorBoundary
      variant="panel"
      resetKey={`${editorText.length}:${config.layout}:${config.milestones.length}`}
    >
    <div className="formatter-career-evolution">
      <FormatterPopoverSection label="Visibility">
        <FormatterToggleRow
          label="Show Career Evolution graph"
          description="Off: hidden from preview and Standard/High PDFs. ATS Optimized export always omits the graph. Content is kept either way."
          checked={config.visible === true}
          onChange={handleVisibility}
        />
        {config.omitReason && !config.visible ? (
          <p className="formatter-popover-hint">{config.omitReason}</p>
        ) : null}
        {config.origin === "ai" && hasMeaningfulCareerEvolutionNarrative(config) ? (
          <p className="formatter-popover-hint">Source: generated from verified CV evidence.</p>
        ) : config.origin === "user" && hasMeaningfulCareerEvolutionNarrative(config) ? (
          <p className="formatter-popover-hint">Source: edited by you.</p>
        ) : config.origin === "mixed" && hasMeaningfulCareerEvolutionNarrative(config) ? (
          <p className="formatter-popover-hint">Source: generated suggestion with your edits.</p>
        ) : null}
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Generate">
        <p className="formatter-popover-hint">
          Uses this application’s job description and verified CV experience
          {targetRole ? ` for “${targetRole}”` : ""}. Does not change your Career Profile.
        </p>
        <button
          type="button"
          className="formatter-popover-btn formatter-popover-btn--full"
          onClick={runGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          )}
          {generating ? "Generating…" : generateLabel}
        </button>
        {status ? (
          <p
            className={`formatter-career-evolution__status formatter-career-evolution__status--${status.tone}`}
            role="status"
          >
            {status.message}
          </p>
        ) : null}
      </FormatterPopoverSection>

      {showPendingBanner && pending ? (
        <FormatterPopoverSection label="Pending suggestion">
          <p className="formatter-popover-hint">
            A new graph was generated. Your current text was kept until you choose:
          </p>
          <pre className="formatter-career-evolution__pending-preview" tabIndex={0}>
            {pendingPreview.slice(0, 600)}
            {pendingPreview.length > 600 ? "…" : ""}
          </pre>
          <div className="formatter-career-evolution__pending-actions">
            <button
              type="button"
              className="formatter-popover-btn formatter-popover-btn--full"
              onClick={handleAcceptPending}
            >
              Apply suggestion
            </button>
            <button
              type="button"
              className="formatter-popover-btn formatter-popover-btn--full"
              onClick={handleDismissPending}
            >
              Keep current version
            </button>
          </div>
        </FormatterPopoverSection>
      ) : null}

      {showAlignmentEditor ? (
        <FormatterPopoverSection label="Evidence-to-Role text">
          <p className="formatter-popover-hint">
            {language === "de"
              ? "Eigenes Dataset — unabhängig vom TRACK-Zeitverlauf. Format: ALIGNMENT + „- Evidenz | Anforderung“."
              : "Dedicated dataset — independent of TRACK timeline text. Format: ALIGNMENT + “- evidence | requirement”."}
          </p>
          <textarea
            value={alignmentEditorText}
            onChange={(e) => handleAlignmentEditorChange(e.target.value)}
            onBlur={handleAlignmentEditorBlur}
            className="formatter-career-evolution__editor"
            spellCheck={false}
            rows={12}
            placeholder={CAREER_EVOLUTION_ALIGNMENT_SYNTAX_HELP.trim()}
            aria-label="Evidence-to-Role alignment text"
            style={{
              color: "#e8e6e1",
              caretColor: "#e8e6e1",
              background: "#1f1f1f",
              WebkitTextFillColor: "#e8e6e1",
            }}
          />
          {alignmentParseResult.errors.length > 0 ? (
            <ul
              className="formatter-career-evolution__messages formatter-career-evolution__messages--error"
              role="alert"
            >
              {alignmentParseResult.errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          ) : null}
          {alignmentParseResult.warnings.length > 0 ? (
            <ul className="formatter-career-evolution__messages formatter-career-evolution__messages--warn">
              {alignmentParseResult.warnings.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          ) : null}
          {!hasCareerEvolutionAlignmentContent({
            ...config,
            alignmentSourceText: alignmentEditorText,
            alignments:
              alignmentParseResult.errors.length === 0
                ? alignmentParseResult.alignments
                : config.alignments,
          }) ? (
            <div className="formatter-career-evolution__alignment-empty">
              <p className="formatter-popover-hint">
                {language === "de"
                  ? "Keine gültigen Paare. Progression Cards werden nicht als Ersatz angezeigt."
                  : "No valid pairs yet. Progression Cards will not be shown as a substitute."}
              </p>
              <button
                type="button"
                className="formatter-popover-btn formatter-popover-btn--full"
                onClick={runGenerateAlignments}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    {language === "de" ? "Generiere…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {language === "de"
                      ? "Paare aus Stellenanzeige + Career Profile erzeugen"
                      : "Generate mappings from job description + Career Profile"}
                  </>
                )}
              </button>
              {!alignmentEditorText.trim() ? (
                <button
                  type="button"
                  className="formatter-popover-btn formatter-popover-btn--full"
                  onClick={() =>
                    handleAlignmentEditorChange(CAREER_EVOLUTION_ALIGNMENT_SYNTAX_HELP)
                  }
                >
                  {language === "de" ? "Beispielsyntax einfügen" : "Insert example syntax"}
                </button>
              ) : null}
            </div>
          ) : null}
        </FormatterPopoverSection>
      ) : (
        <>
          <FormatterPopoverSection label="Graph text">
            <p className="formatter-popover-hint">
              Separate from the main CV Markdown. Use TRACK and CONNECTION lines — no SVG or HTML.
            </p>
            <textarea
              value={editorText}
              onChange={(e) => handleEditorChange(e.target.value)}
              onBlur={handleEditorBlur}
              className="formatter-career-evolution__editor"
              spellCheck={false}
              rows={12}
              placeholder={CAREER_EVOLUTION_SYNTAX_HELP.trim()}
              aria-label="Career Evolution graph text"
              style={{
                color: "#e8e6e1",
                caretColor: "#e8e6e1",
                background: "#1f1f1f",
                WebkitTextFillColor: "#e8e6e1",
              }}
            />
            {parseResult.errors.length > 0 ? (
              <ul
                className="formatter-career-evolution__messages formatter-career-evolution__messages--error"
                role="alert"
              >
                {parseResult.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
            {parseResult.warnings.length > 0 ? (
              <ul className="formatter-career-evolution__messages formatter-career-evolution__messages--warn">
                {parseResult.warnings.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
            {!editorText.trim() ? (
              <button
                type="button"
                className="formatter-popover-btn formatter-popover-btn--full"
                onClick={insertExample}
              >
                Insert example syntax
              </button>
            ) : null}
          </FormatterPopoverSection>

          {config.milestones.length > 0 ? (
            <FormatterPopoverSection label="Short display labels">
              <p className="formatter-popover-hint">
                {language === "de"
                  ? "Automatisch aus Erfahrung und Stellenanzeige erzeugt (ca. 2–4 Wörter). Bearbeitbar — offizielle Titel bleiben unverändert."
                  : "Generated from your experience and the job description (about 2–4 words). Editable — official titles stay unchanged."}
              </p>
              <ul className="formatter-career-evolution__milestone-labels">
                {config.milestones.map((m) => (
                  <li key={m.id} className="formatter-career-evolution__milestone-label">
                    <span className="formatter-career-evolution__milestone-label-title">
                      {m.label}
                      {m.displayLabel?.trim() ? (
                        <span
                          className="formatter-career-evolution__milestone-label-origin"
                          data-origin={m.displayLabelOrigin || "auto"}
                        >
                          {m.displayLabelOrigin === "user"
                            ? language === "de"
                              ? "Bearbeitet"
                              : "Edited"
                            : language === "de"
                              ? "Generiert"
                              : "Generated"}
                        </span>
                      ) : null}
                    </span>
                    <FormatterDarkInput
                      value={m.displayLabel || ""}
                      onChange={(e) => handleDisplayLabelChange(m.id, e.target.value)}
                      placeholder={
                        language === "de" ? "Kurzlabel wird erzeugt…" : "Generating short label…"
                      }
                      maxLength={48}
                      aria-label={
                        language === "de"
                          ? `Kurzlabel für ${m.label}`
                          : `Short display label for ${m.label}`
                      }
                    />
                  </li>
                ))}
              </ul>
              <div className="formatter-career-evolution__label-actions">
                <button
                  type="button"
                  className="formatter-popover-btn formatter-popover-btn--ghost formatter-popover-btn--inline"
                  onClick={handleProposeRegenerateLabels}
                >
                  {language === "de" ? "Labels neu vorschlagen" : "Regenerate labels"}
                </button>
              </div>
              {labelProposals && labelProposals.length > 0 ? (
                <div className="formatter-career-evolution__label-preview" role="region" aria-label="Proposed short labels">
                  <p className="formatter-popover-hint">
                    {language === "de"
                      ? "Vorgeschlagene Änderungen — manuelle Labels werden nicht überschrieben."
                      : "Proposed changes — manually edited labels will not be overwritten."}
                  </p>
                  <ul className="formatter-career-evolution__label-preview-list">
                    {labelProposals.map((p) => (
                      <li key={p.milestoneId}>
                        <strong>{p.milestoneLabel}</strong>
                        <span>
                          {(p.current || "—") +
                            " → " +
                            (p.proposed || "—") +
                            (p.protectedEdit
                              ? language === "de"
                                ? " (manuell belassen)"
                                : " (keep manual)"
                              : "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="formatter-career-evolution__label-actions">
                    <button
                      type="button"
                      className="formatter-popover-btn formatter-popover-btn--inline"
                      onClick={handleApplyLabelProposals}
                    >
                      {language === "de" ? "Übernehmen" : "Apply"}
                    </button>
                    <button
                      type="button"
                      className="formatter-popover-btn formatter-popover-btn--ghost formatter-popover-btn--inline"
                      onClick={handleDismissLabelProposals}
                    >
                      {language === "de" ? "Verwerfen" : "Dismiss"}
                    </button>
                  </div>
                </div>
              ) : null}
            </FormatterPopoverSection>
          ) : null}
        </>
      )}

      <FormatterPopoverSection label="Layout">
        <p className="formatter-popover-hint">
          {language === "de"
            ? "Vorlage wählen — Inhalt und Graph-Text bleiben erhalten."
            : "Choose a template — content and graph text are preserved."}
        </p>
        <div
          className="formatter-ce-layout-gallery"
          role="radiogroup"
          aria-label="Career evolution layout"
        >
          {CAREER_EVOLUTION_LAYOUTS.map((opt) => {
            const active = config.layout === opt.id
            const name = language === "de" ? opt.nameDe : opt.name
            const desc = language === "de" ? opt.descDe : opt.desc
            const badge = language === "de" ? opt.badgeDe : opt.badge
            const preview = careerEvolutionLayoutPreviewSvg(
              opt.id,
              "#0f7b6c",
            )
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`formatter-ce-layout-card${active ? " formatter-ce-layout-card--active" : ""}`}
                onClick={() => selectLayout(opt.id as CareerEvolutionLayout)}
              >
                <span
                  className="formatter-ce-layout-card__preview"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
                <span className="formatter-ce-layout-card__body">
                  <span className="formatter-ce-layout-card__title-row">
                    <span className="formatter-ce-layout-card__name">{name}</span>
                    {badge ? (
                      <span className="formatter-ce-layout-card__badge">{badge}</span>
                    ) : null}
                  </span>
                  <span className="formatter-ce-layout-card__desc">{desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </FormatterPopoverSection>

      {showConvergenceEditor ? (
        <FormatterPopoverSection label="Converging Capabilities">
          <p className="formatter-popover-hint">
            {language === "de"
              ? "Eigene Labels für die Kästen links — unabhängig von TRACK-Meilensteinen. 2–6 Einträge."
              : "Labels for the left-hand boxes — independent of TRACK milestones. 2–6 entries."}
          </p>
          <ul className="formatter-career-evolution__capabilities" aria-label="Converging capabilities">
            {editableCapabilities.map((cap, index) => (
              <li key={cap.id} className="formatter-career-evolution__capability">
                <div className="formatter-career-evolution__capability-controls">
                  <button
                    type="button"
                    className="formatter-popover-btn formatter-popover-btn--ghost formatter-career-evolution__icon-btn"
                    aria-label={`Move ${cap.label || "capability"} up`}
                    disabled={index === 0}
                    onClick={() => moveCapability(cap.id, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="formatter-popover-btn formatter-popover-btn--ghost formatter-career-evolution__icon-btn"
                    aria-label={`Move ${cap.label || "capability"} down`}
                    disabled={index === editableCapabilities.length - 1}
                    onClick={() => moveCapability(cap.id, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <FormatterDarkInput
                  value={cap.label}
                  onChange={(e) => updateCapabilityLabel(cap.id, e.target.value)}
                  aria-label={`Capability ${index + 1}`}
                  placeholder="Capability label"
                />
                <button
                  type="button"
                  className="formatter-popover-btn formatter-popover-btn--ghost formatter-career-evolution__icon-btn"
                  aria-label={`Remove ${cap.label || "capability"}`}
                  disabled={editableCapabilities.length <= CAREER_EVOLUTION_CAPABILITY_MIN}
                  onClick={() => removeCapability(cap.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {editableCapabilities.length === 0 ? (
            <p className="formatter-popover-hint" role="status">
              {language === "de"
                ? "Noch keine Fähigkeiten. Vorschlagen oder manuell hinzufügen."
                : "No capabilities yet. Suggest from the job, or add them manually."}
            </p>
          ) : null}
          <div className="formatter-career-evolution__capability-actions">
            <button
              type="button"
              className="formatter-popover-btn formatter-popover-btn--full"
              onClick={addCapability}
              disabled={editableCapabilities.length >= CAREER_EVOLUTION_CAPABILITY_MAX}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {language === "de" ? "Fähigkeit hinzufügen" : "Add capability"}
            </button>
            <button
              type="button"
              className="formatter-popover-btn formatter-popover-btn--full"
              onClick={runSuggestCapabilities}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {language === "de" ? "Fähigkeiten vorschlagen" : "Suggest capabilities"}
            </button>
          </div>
          {capabilitySuggestions ? (
            <div className="formatter-career-evolution__cap-suggestions">
              <p className="formatter-popover-hint">
                {language === "de"
                  ? "Vorschläge (noch nicht übernommen):"
                  : "Suggestions (not applied yet):"}
              </p>
              <ul className="formatter-career-evolution__messages formatter-career-evolution__messages--warn">
                {capabilitySuggestions.capabilities.map((c) => (
                  <li key={c.id}>{c.label}</li>
                ))}
                <li>
                  {language === "de" ? "Ziel: " : "Outcome: "}
                  {capabilitySuggestions.convergenceTarget}
                </li>
              </ul>
              <div className="formatter-career-evolution__pending-actions">
                <button
                  type="button"
                  className="formatter-popover-btn formatter-popover-btn--full"
                  onClick={applyCapabilitySuggestions}
                >
                  {language === "de" ? "Vorschläge übernehmen" : "Use suggestions"}
                </button>
                <button
                  type="button"
                  className="formatter-popover-btn formatter-popover-btn--full"
                  onClick={dismissCapabilitySuggestions}
                >
                  {language === "de" ? "Behalten" : "Keep current"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="formatter-dark-field" style={{ marginTop: 10 }}>
            <label className="formatter-dark-field__label" htmlFor="ce-central-outcome">
              {language === "de" ? "Zentrale Ergebnisbezeichnung" : "Central Outcome Label"}
            </label>
            <FormatterDarkInput
              id="ce-central-outcome"
              value={config.convergenceTarget || ""}
              onChange={(e) => updateCentralOutcomeLabel(e.target.value)}
              placeholder={
                language === "de"
                  ? "Aus Fähigkeiten und Stellenanforderungen erzeugt"
                  : "Generated from capabilities and role requirements"
              }
              aria-label="Central Outcome Label"
            />
            <p className="formatter-dark-field__hint">
              {language === "de"
                ? "Eigenes Label für den grünen Kasten — ändert nicht den Ziel-Jobtitel. Manuelle Edits bleiben bei Regenerierung erhalten."
                : "Independent label for the green box — does not change the target job title. Manual edits are kept when regenerating."}
              {config.convergenceTargetOrigin === "user" ? (
                <span data-origin="user">
                  {" "}
                  {language === "de" ? "(Bearbeitet)" : "(Edited)"}
                </span>
              ) : null}
            </p>
          </div>
          {editableCapabilities.filter((c) => String(c.label).trim()).length <
          CAREER_EVOLUTION_CAPABILITY_MIN ? (
            <p className="formatter-popover-hint" role="status">
              {language === "de"
                ? `Mindestens ${CAREER_EVOLUTION_CAPABILITY_MIN} beschriftete Fähigkeiten für den Graph.`
                : `At least ${CAREER_EVOLUTION_CAPABILITY_MIN} labelled capabilities are required for the graph.`}
            </p>
          ) : null}
        </FormatterPopoverSection>
      ) : null}

      <FormatterPopoverSection label="Parallel work">
        <FormatterToggleRow
          label={
            language === "de"
              ? "Parallele Arbeit im Graph zeigen"
              : "Show parallel work in graph"
          }
          description={
            language === "de"
              ? "Bestätigte unabhängige oder Beratungsarbeit neben der Anstellung. Unabhängig von der Layout-Vorlage."
              : "Confirmed independent or consulting work alongside employment. Independent of the layout template."
          }
          checked={config.showParallelWork !== false}
          onChange={(checked) => updatePresentation({ showParallelWork: checked })}
        />
        {(() => {
          const classified = listExperienceRolesForEditor(resumeText).some((r) =>
            isParallelExperienceWorkType(r.workRelationship),
          )
          const enriched = prepareCareerEvolutionParallelVisibility(
            { ...config, showParallelWork: true },
            resumeText,
          )
          const hasParallel =
            hasParallelTrackContent(config) || hasParallelTrackContent(enriched)
          if (config.layout === "parallel" && config.showParallelWork !== false && !hasParallel) {
            return (
              <p className="formatter-popover-hint mt-2" role="status">
                {language === "de"
                  ? classified
                    ? "Parallele Rollen sind markiert — Graph aktualisiert die Vorschau. Bei Bedarf neu generieren."
                    : "Keine parallele Rolle markiert. Unter Bearbeiten → Parallele Arbeit eine Rolle als parallele unabhängige oder Beratungstätigkeit kennzeichnen. Progression Cards werden nicht als Ersatz angezeigt."
                  : classified
                    ? "Parallel roles are marked — the preview will show an independent track. Regenerate if the graph text is outdated."
                    : "No parallel role is marked yet. Under Edit → Parallel work, mark a role as parallel independent or consulting. Progression Cards will not be shown as a substitute."}
              </p>
            )
          }
          if (config.showParallelWork !== false && !classified && !hasParallel) {
            return (
              <p className="formatter-popover-hint mt-2">
                {language === "de"
                  ? "Tipp: Markieren Sie TrustAudit.tools oder ähnliche Nebenrollen unter Bearbeiten → Parallele Arbeit."
                  : "Tip: Mark TrustAudit.tools or similar side roles under Edit → Parallel work."}
              </p>
            )
          }
          return null
        })()}
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Density">
        <div className="formatter-style-list" role="radiogroup" aria-label="Density">
          {(
            [
              { id: "compact" as const, name: "Compact", desc: "Fits tight A4 space" },
              { id: "standard" as const, name: "Standard", desc: "More label room" },
            ] as const
          ).map((opt) => {
            const active = config.density === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`formatter-style-item${active ? " formatter-style-item--active" : ""}`}
                onClick={() => updatePresentation({ density: opt.id })}
              >
                <span className="formatter-style-item__radio" aria-hidden />
                <span className="min-w-0">
                  <span className="formatter-style-item__name">{opt.name}</span>
                  <span className="formatter-style-item__desc">{opt.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Date display">
        <p className="formatter-popover-hint">
          {language === "de"
            ? "Gespeicherte Daten bleiben unverändert — nur die Anzeige auf dem Graph ändert sich."
            : "Stored dates stay unchanged — only the graph label formatting changes."}
        </p>
        <div className="formatter-style-list" role="radiogroup" aria-label="Date display">
          {(
            [
              {
                id: "auto" as CareerEvolutionDateDisplay,
                name: "Auto",
                desc: "Full when space allows, else 2016–2019",
              },
              {
                id: "full" as CareerEvolutionDateDisplay,
                name: "Full",
                desc: "Dec 2016 – Aug 2019",
              },
              {
                id: "compact" as CareerEvolutionDateDisplay,
                name: "Compact",
                desc: "2016–2019 · 2023–Present",
              },
            ] as const
          ).map((opt) => {
            const active = (config.dateDisplay || "auto") === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`formatter-style-item${active ? " formatter-style-item--active" : ""}`}
                onClick={() => updatePresentation({ dateDisplay: opt.id })}
              >
                <span className="formatter-style-item__radio" aria-hidden />
                <span className="min-w-0">
                  <span className="formatter-style-item__name">{opt.name}</span>
                  <span className="formatter-style-item__desc">{opt.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Graph position">
        <div className="formatter-style-list" role="radiogroup" aria-label="Graph position">
          {(
            [
              {
                id: "before-experience" as const,
                name: "Before Experience",
                desc: "Above the experience section",
              },
              {
                id: "after-experience" as const,
                name: "After Experience",
                desc: "Below the experience section",
              },
            ] as const
          ).map((opt) => {
            const active = (config.position || "before-experience") === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`formatter-style-item${active ? " formatter-style-item--active" : ""}`}
                onClick={() => updatePresentation({ position: opt.id })}
              >
                <span className="formatter-style-item__radio" aria-hidden />
                <span className="min-w-0">
                  <span className="formatter-style-item__name">{opt.name}</span>
                  <span className="formatter-style-item__desc">{opt.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="formatter-popover-hint mt-2">
          Accent colour matches your CV accent. Experience descriptions stay unchanged for ATS.
        </p>
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Connections">
        <FormatterToggleRow
          label="Show connection icon"
          description="Merge mark on approved relationships"
          checked={config.showConnectionIcon !== false}
          onChange={(checked) => updatePresentation({ showConnectionIcon: checked })}
        />
        <FormatterToggleRow
          label="Show connection labels"
          description="Short labels on the graph"
          checked={config.showConnectionLabels !== false}
          onChange={(checked) => updatePresentation({ showConnectionLabels: checked })}
        />
      </FormatterPopoverSection>
    </div>
    </CareerEvolutionErrorBoundary>
  )
}
