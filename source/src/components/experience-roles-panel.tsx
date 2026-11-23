"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GitMerge } from "lucide-react"
import {
  applyExperienceRoleSettings,
  experienceRoleStableKey,
  experienceWorkPresentationLabel,
  experienceWorkTypeLabel,
  listExperienceRolesForEditor,
  type ExperienceRoleEditorItem,
  type ExperienceWorkPresentation,
  type ExperienceWorkRelationship,
} from "@/lib/experience-work-modifier"
import { FormatterPopoverSection } from "@/components/formatter-popover-shell"

type ExperienceRolesPanelProps = {
  resumeText: string
  onResumeTextChange: (next: string) => void
  language?: "en" | "de"
}

const RELATIONSHIP_OPTIONS: ExperienceWorkRelationship[] = [
  "standard",
  "parallel-independent",
  "parallel-consulting",
]

const PRESENTATION_OPTIONS: ExperienceWorkPresentation[] = [
  "within-experience",
  "separate-section",
]

type RoleDraft = {
  workRelationship: ExperienceWorkRelationship
  presentation: ExperienceWorkPresentation
}

export function ExperienceRolesPanel({
  resumeText,
  onResumeTextChange,
  language = "en",
}: ExperienceRolesPanelProps) {
  const roles = useMemo(
    () => listExperienceRolesForEditor(resumeText),
    [resumeText],
  )
  const de = language === "de"
  const [drafts, setDrafts] = useState<Record<string, RoleDraft>>({})
  const [applyError, setApplyError] = useState<string | null>(null)

  // Always apply against the latest text — rapid clicks must not use a stale closure.
  const resumeTextRef = useRef(resumeText)
  resumeTextRef.current = resumeText

  // Drop optimistic drafts once resumeText reflects the change.
  useEffect(() => {
    setDrafts((prev) => {
      if (Object.keys(prev).length === 0) return prev
      const next = { ...prev }
      let changed = false
      for (const role of roles) {
        const key = experienceRoleStableKey(role)
        const draft = next[key]
        if (
          draft &&
          draft.workRelationship === role.workRelationship &&
          draft.presentation === role.presentation
        ) {
          delete next[key]
          changed = true
        }
      }
      // Drop drafts for roles that no longer exist
      for (const key of Object.keys(next)) {
        if (!roles.some((r) => experienceRoleStableKey(r) === key)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [roles])

  const resolveRole = (role: ExperienceRoleEditorItem) => {
    const draft = drafts[experienceRoleStableKey(role)]
    if (!draft) return role
    return {
      ...role,
      workRelationship: draft.workRelationship,
      workType: draft.workRelationship,
      presentation: draft.presentation,
    }
  }

  const applySettings = (
    role: ExperienceRoleEditorItem,
    next: RoleDraft,
  ) => {
    const current = resolveRole(role)
    if (
      current.workRelationship === next.workRelationship &&
      current.presentation === next.presentation
    ) {
      return
    }

    const key = experienceRoleStableKey(role)
    setApplyError(null)
    // Optimistic UI — keep until resumeText confirms (or apply fails).
    setDrafts((prev) => ({ ...prev, [key]: next }))

    const source = resumeTextRef.current
    const updated = applyExperienceRoleSettings(
      source,
      {
        sectionKey: role.sectionKey,
        title: role.title,
        company: role.company,
        jobIndex: role.jobIndex,
      },
      {
        workRelationship: next.workRelationship,
        presentation: next.presentation,
        language,
      },
    )

    if (updated === source) {
      setDrafts((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
      setApplyError(
        de
          ? "Auswahl konnte nicht gespeichert werden. Bitte erneut versuchen."
          : "Couldn’t apply that selection. Please try again.",
      )
      return
    }

    resumeTextRef.current = updated
    onResumeTextChange(updated)
  }

  return (
    <div className="formatter-experience-roles">
      <FormatterPopoverSection label={de ? "Rollen kennzeichnen" : "Mark roles"}>
        <p className="formatter-popover-hint">
          {de
            ? "Klassifizieren Sie parallele unabhängige oder Beratungsarbeit und wählen Sie, ob sie in Experience oder in einem eigenen Abschnitt erscheint. Daten und Beschreibungen bleiben unverändert. Unabhängig vom Career-Evolution-Graph."
            : "Classify independent or consulting work undertaken alongside another role, then choose whether it appears within Experience or in a separate section. Dates and descriptions stay unchanged. Independent of the Career Evolution graph."}
        </p>
        {applyError ? (
          <p className="formatter-experience-roles__error" role="alert">
            {applyError}
          </p>
        ) : null}
        {roles.length === 0 ? (
          <p className="formatter-popover-hint">
            {de
              ? "Keine Experience-Einträge gefunden. Fügen Sie Rollen unter EXPERIENCE hinzu."
              : "No experience entries found. Add roles under EXPERIENCE in Resume content."}
          </p>
        ) : (
          <ul className="formatter-experience-roles__list">
            {roles.map((rawRole) => {
              const role = resolveRole(rawRole)
              const isParallel =
                role.workRelationship === "parallel-independent" ||
                role.workRelationship === "parallel-consulting"
              return (
                <li
                  key={rawRole.id}
                  className="formatter-experience-roles__item"
                  data-role-key={experienceRoleStableKey(rawRole)}
                >
                  <div className="formatter-experience-roles__head">
                    <GitMerge
                      className="h-3.5 w-3.5 shrink-0 text-[#c7c5bf]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="formatter-experience-roles__title">
                        {role.title}
                      </div>
                      <div className="formatter-experience-roles__meta">
                        {[role.company, role.dateText].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  {role.overlapSuggested ? (
                    <p className="formatter-experience-roles__suggest" role="status">
                      {de
                        ? `Überlappende Daten mit ${role.overlapWith}. Als parallele Arbeit markieren?`
                        : `Overlapping dates with ${role.overlapWith}. Mark as parallel work?`}
                    </p>
                  ) : null}
                  <div
                    className="formatter-experience-roles__options"
                    role="radiogroup"
                    aria-label={
                      de
                        ? `Arbeitsbeziehung für ${role.title}`
                        : `Work relationship for ${role.title}`
                    }
                  >
                    <p className="formatter-experience-roles__group-label">
                      {de ? "Art der Tätigkeit" : "Work relationship"}
                    </p>
                    {RELATIONSHIP_OPTIONS.map((opt) => {
                      const active = role.workRelationship === opt
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`formatter-style-item${active ? " formatter-style-item--active" : ""}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applySettings(rawRole, {
                              workRelationship: opt,
                              presentation:
                                opt === "standard"
                                  ? "within-experience"
                                  : role.presentation,
                            })
                          }}
                        >
                          <span className="formatter-style-item__radio" aria-hidden />
                          <span className="min-w-0">
                            <span className="formatter-style-item__name">
                              {experienceWorkTypeLabel(opt, language)}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {isParallel ? (
                    <div
                      className="formatter-experience-roles__options"
                      role="radiogroup"
                      aria-label={
                        de
                          ? `Darstellung für ${role.title}`
                          : `Presentation for ${role.title}`
                      }
                    >
                      <p className="formatter-experience-roles__group-label">
                        {de ? "Darstellung" : "Show as"}
                      </p>
                      {PRESENTATION_OPTIONS.map((opt) => {
                        const active = role.presentation === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`formatter-style-item${active ? " formatter-style-item--active" : ""}`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              applySettings(rawRole, {
                                workRelationship: role.workRelationship,
                                presentation: opt,
                              })
                            }}
                          >
                            <span className="formatter-style-item__radio" aria-hidden />
                            <span className="min-w-0">
                              <span className="formatter-style-item__name">
                                {experienceWorkPresentationLabel(opt, language)}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </FormatterPopoverSection>
    </div>
  )
}
