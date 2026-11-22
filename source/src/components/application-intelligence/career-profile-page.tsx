"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { usePageTitle } from "@/hooks/use-page-title"
import type { StrategicProfile } from "@/lib/strategic-profile"
import {
  formatLastSearchLabel,
  hasCareerProfilePrefsContent,
  loadAutomatePrefs,
  loadCareerProfilePrefs,
  saveAutomatePrefs,
  saveCareerProfilePrefs,
} from "@/lib/career-profile/storage"
import {
  automateStatusLabel,
  type AutomatePrefs,
  type CareerProfilePrefs,
  type EmploymentPreference,
  type RemotePreference,
} from "@/lib/career-profile/types"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Settings2, Sparkles } from "lucide-react"
import "./career-profile-page.css"

const EMPLOYMENT_OPTIONS: Array<{ id: EmploymentPreference; label: string }> = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "freelance", label: "Freelance" },
  { id: "internship", label: "Internship" },
]

const STORY_FIELDS: Array<{ key: keyof StrategicProfile; label: string }> = [
  { key: "careerDirection", label: "Desired direction" },
  { key: "professionalStrengths", label: "Strengths & achievements" },
  { key: "strategicEmphasis", label: "What to emphasise" },
  { key: "longTermGoal", label: "Longer-term goal" },
]

type CareerProfilePageProps = {
  strategicProfile: StrategicProfile | null
  onNavigateCareerBrain: () => void
  onNavigateRoleStrategy: () => void
}

export function CareerProfilePage({
  strategicProfile,
  onNavigateCareerBrain,
  onNavigateRoleStrategy,
}: CareerProfilePageProps) {
  usePageTitle(pageTitleForSection("careerProfile"))

  const [prefs, setPrefs] = useState<CareerProfilePrefs>({})
  const [automate, setAutomate] = useState<AutomatePrefs | null>(null)
  const [automateOpen, setAutomateOpen] = useState(false)
  const [draftAutomate, setDraftAutomate] = useState<AutomatePrefs | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setPrefs(loadCareerProfilePrefs())
    setAutomate(loadAutomatePrefs())
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const patchPrefs = useCallback((patch: Partial<CareerProfilePrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleSavePrefs = useCallback(() => {
    const saved = saveCareerProfilePrefs(prefs)
    setPrefs(saved)
    showToast("Career Profile preferences saved")
  }, [prefs, showToast])

  const openAutomate = useCallback(() => {
    const current = automate ?? loadAutomatePrefs()
    setDraftAutomate({ ...current })
    setAutomateOpen(true)
  }, [automate])

  const handleSaveAutomate = useCallback(() => {
    if (!draftAutomate) return
    if (draftAutomate.status === "active" && !draftAutomate.consentToUseProfile) {
      showToast("Confirm consent before activating automation")
      return
    }
    if (
      draftAutomate.status === "active" &&
      !draftAutomate.discoverJobs &&
      !draftAutomate.discoverCompanies &&
      !draftAutomate.discoverPeople
    ) {
      showToast("Choose at least one discovery type, or set status to Off")
      return
    }
    const saved = saveAutomatePrefs(draftAutomate)
    setAutomate(saved)
    setAutomateOpen(false)
    showToast(
      saved.status === "active"
        ? "Automation preferences saved — discovery runs stay manual until Job Discovery ships"
        : "Automation preferences saved",
    )
  }, [draftAutomate, showToast])

  const status = automate?.status ?? "off"
  const lastSearch = formatLastSearchLabel(automate?.lastSuccessfulSearchAt)
  const newCount = automate?.newRecommendationCount ?? 0
  const prefsFilled = hasCareerProfilePrefsContent(prefs)

  const storySummary = useMemo(
    () =>
      STORY_FIELDS.map((field) => ({
        ...field,
        value: strategicProfile?.[field.key],
      })),
    [strategicProfile],
  )

  const toggleEmployment = useCallback((id: EmploymentPreference) => {
    setPrefs((prev) => {
      const current = prev.employmentPreferences ?? []
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
      return { ...prev, employmentPreferences: next }
    })
  }, [])

  return (
    <div className="career-profile-page">
      <header className="career-profile-page__header">
        <h1 className="career-profile-page__title">Career Profile</h1>
        <p className="career-profile-page__subtitle">
          One place for how you want to work, what you want to explore, and what may inform
          recommendations — without assuming your next step must match your current title.
        </p>
      </header>

      <div className="career-profile-page__toast" role="status" aria-live="polite">
        {toast ?? ""}
      </div>

      <section className="career-profile-page__automate-bar" aria-labelledby="automate-status-heading">
        <div className="career-profile-page__automate-meta">
          <p
            id="automate-status-heading"
            className="career-profile-page__automate-status"
            data-status={status}
          >
            Automate: {automateStatusLabel(status)}
          </p>
          <p className="career-profile-page__automate-detail">
            Last successful search: {lastSearch}
            {newCount > 0 ? ` · ${newCount} new recommendation${newCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="career-profile-page__automate-actions">
          <button type="button" className="career-profile-page__btn career-profile-page__btn--primary" onClick={openAutomate}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Automate
          </button>
          <button
            type="button"
            className="career-profile-page__btn"
            onClick={onNavigateRoleStrategy}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Role Strategy
          </button>
        </div>
      </section>

      <div className="career-profile-page__grid">
        <section className="career-profile-page__card" aria-labelledby="story-heading">
          <h2 id="story-heading" className="career-profile-page__card-title">
            From My story
          </h2>
          <p className="career-profile-page__card-copy">
            Narrative from My story feeds Role Strategy and applications. Edit it there — it stays
            the source of truth for your professional story.
          </p>
          <ul className="career-profile-page__story-list">
            {storySummary.map((item) => {
              const text = typeof item.value === "string" ? item.value.trim() : ""
              return (
                <li key={String(item.key)}>
                  <span className="career-profile-page__story-label">{item.label}</span>
                  <p
                    className={
                      text
                        ? "career-profile-page__story-value"
                        : "career-profile-page__story-value career-profile-page__story-value--empty"
                    }
                  >
                    {text || "Not filled yet"}
                  </p>
                </li>
              )
            })}
          </ul>
          <div className="career-profile-page__footer">
            <button type="button" className="career-profile-page__btn" onClick={onNavigateCareerBrain}>
              Edit My story
            </button>
          </div>
        </section>

        <section className="career-profile-page__card" aria-labelledby="direction-heading">
          <h2 id="direction-heading" className="career-profile-page__card-title">
            Direction & value
          </h2>
          <p className="career-profile-page__card-copy">
            Capture ambitions that may go beyond your current job title — problems to solve,
            industries, and environments that fit your values.
          </p>
          <div className="career-profile-page__fields">
            <Field
              id="currentPositioning"
              label="Current professional positioning"
              hint="How you describe where you are now — not only your formal title."
            >
              <textarea
                id="currentPositioning"
                className="career-profile-page__textarea"
                value={prefs.currentPositioning ?? ""}
                onChange={(event) => patchPrefs({ currentPositioning: event.target.value })}
              />
            </Field>
            <Field id="rolesOfInterest" label="Roles of interest">
              <textarea
                id="rolesOfInterest"
                className="career-profile-page__textarea"
                value={prefs.rolesOfInterest ?? ""}
                onChange={(event) => patchPrefs({ rolesOfInterest: event.target.value })}
                placeholder="e.g. product operations, accessibility programme lead, facilitation roles"
              />
            </Field>
            <Field id="industriesOfInterest" label="Industries of interest">
              <input
                id="industriesOfInterest"
                className="career-profile-page__input"
                value={prefs.industriesOfInterest ?? ""}
                onChange={(event) => patchPrefs({ industriesOfInterest: event.target.value })}
              />
            </Field>
            <Field id="problemsToSolve" label="Problems you want to solve">
              <textarea
                id="problemsToSolve"
                className="career-profile-page__textarea"
                value={prefs.problemsToSolve ?? ""}
                onChange={(event) => patchPrefs({ problemsToSolve: event.target.value })}
              />
            </Field>
            <Field id="preferredOrganisations" label="Preferred organisations & environments">
              <textarea
                id="preferredOrganisations"
                className="career-profile-page__textarea"
                value={prefs.preferredOrganisations ?? ""}
                onChange={(event) => patchPrefs({ preferredOrganisations: event.target.value })}
              />
            </Field>
            <Field id="professionalValues" label="Professional values & interests">
              <textarea
                id="professionalValues"
                className="career-profile-page__textarea"
                value={prefs.professionalValues ?? ""}
                onChange={(event) => patchPrefs({ professionalValues: event.target.value })}
              />
            </Field>
            <Field id="careerTransitionGoals" label="Career-transition goals">
              <textarea
                id="careerTransitionGoals"
                className="career-profile-page__textarea"
                value={prefs.careerTransitionGoals ?? ""}
                onChange={(event) => patchPrefs({ careerTransitionGoals: event.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="career-profile-page__card" aria-labelledby="work-prefs-heading">
          <h2 id="work-prefs-heading" className="career-profile-page__card-title">
            Work preferences
          </h2>
          <p className="career-profile-page__card-copy">
            Location, remote work, salary and employment preferences for future discovery — not
            shared with job boards until you run discovery.
          </p>
          <div className="career-profile-page__fields">
            <Field id="preferredLocations" label="Location preferences">
              <input
                id="preferredLocations"
                className="career-profile-page__input"
                value={prefs.preferredLocations ?? ""}
                onChange={(event) => patchPrefs({ preferredLocations: event.target.value })}
                placeholder="e.g. Berlin, remote EU, DACH"
              />
            </Field>
            <Field id="remotePreference" label="Remote preference">
              <select
                id="remotePreference"
                className="career-profile-page__select"
                value={prefs.remotePreference ?? ""}
                onChange={(event) =>
                  patchPrefs({
                    remotePreference: (event.target.value || undefined) as RemotePreference | undefined,
                  })
                }
              >
                <option value="">Not set</option>
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </Field>
            <div className="career-profile-page__row career-profile-page__row--3">
              <Field id="salaryMin" label="Salary min">
                <input
                  id="salaryMin"
                  className="career-profile-page__input"
                  inputMode="numeric"
                  value={prefs.salaryMin ?? ""}
                  onChange={(event) => patchPrefs({ salaryMin: event.target.value })}
                />
              </Field>
              <Field id="salaryMax" label="Salary max">
                <input
                  id="salaryMax"
                  className="career-profile-page__input"
                  inputMode="numeric"
                  value={prefs.salaryMax ?? ""}
                  onChange={(event) => patchPrefs({ salaryMax: event.target.value })}
                />
              </Field>
              <Field id="salaryCurrency" label="Currency">
                <input
                  id="salaryCurrency"
                  className="career-profile-page__input"
                  value={prefs.salaryCurrency ?? "EUR"}
                  onChange={(event) => patchPrefs({ salaryCurrency: event.target.value })}
                />
              </Field>
            </div>
            <Field id="workingHours" label="Working hours">
              <input
                id="workingHours"
                className="career-profile-page__input"
                value={prefs.workingHours ?? ""}
                onChange={(event) => patchPrefs({ workingHours: event.target.value })}
                placeholder="e.g. standard, flexible, 80%"
              />
            </Field>
            <div className="career-profile-page__field">
              <span className="career-profile-page__field-label">Employment preferences</span>
              <div className="career-profile-page__chips" role="group" aria-label="Employment preferences">
                {EMPLOYMENT_OPTIONS.map((option) => {
                  const pressed = (prefs.employmentPreferences ?? []).includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="career-profile-page__chip"
                      aria-pressed={pressed}
                      onClick={() => toggleEmployment(option.id)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="career-profile-page__card" aria-labelledby="use-heading">
          <h2 id="use-heading" className="career-profile-page__card-title">
            Use for recommendations
          </h2>
          <p className="career-profile-page__card-copy">
            Control which parts of your profile may inform Role Strategy and future discovery.
          </p>
          <div className="career-profile-page__toggles">
            <ToggleRow
              id="use-story"
              label="My story"
              checked={prefs.useForRecommendations?.story !== false}
              onCheckedChange={(checked) =>
                patchPrefs({
                  useForRecommendations: {
                    ...prefs.useForRecommendations,
                    story: checked,
                  },
                })
              }
            />
            <ToggleRow
              id="use-prefs"
              label="Career preferences on this page"
              checked={prefs.useForRecommendations?.preferences !== false}
              onCheckedChange={(checked) =>
                patchPrefs({
                  useForRecommendations: {
                    ...prefs.useForRecommendations,
                    preferences: checked,
                  },
                })
              }
            />
            <ToggleRow
              id="use-role-strategy"
              label="Saved Role Strategy directions"
              checked={prefs.useForRecommendations?.roleStrategy !== false}
              onCheckedChange={(checked) =>
                patchPrefs({
                  useForRecommendations: {
                    ...prefs.useForRecommendations,
                    roleStrategy: checked,
                  },
                })
              }
            />
          </div>
          <div className="career-profile-page__footer">
            <button
              type="button"
              className="career-profile-page__btn career-profile-page__btn--primary"
              onClick={handleSavePrefs}
            >
              Save preferences
            </button>
            {!prefsFilled ? (
              <span className="career-profile-page__field-hint">
                Optional — fill what helps discovery; leave the rest blank.
              </span>
            ) : null}
          </div>
        </section>
      </div>

      <Dialog open={automateOpen} onOpenChange={setAutomateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Automate opportunity discovery</DialogTitle>
            <DialogDescription>
              Configure personalised discovery. Nothing runs in the background until you confirm
              settings — and scheduled searches stay off until Job Discovery is ready.
            </DialogDescription>
          </DialogHeader>

          {draftAutomate ? (
            <div className="career-profile-page__dialog-body">
              <Field id="automate-status" label="Automation status">
                <select
                  id="automate-status"
                  className="career-profile-page__select"
                  value={draftAutomate.status}
                  onChange={(event) =>
                    setDraftAutomate((prev) =>
                      prev
                        ? { ...prev, status: event.target.value as AutomatePrefs["status"] }
                        : prev,
                    )
                  }
                >
                  <option value="off">Off</option>
                  <option value="paused">Paused</option>
                  <option value="active">Active</option>
                </select>
              </Field>

              <div className="career-profile-page__field">
                <span className="career-profile-page__field-label">What to automate</span>
                <div className="career-profile-page__toggles">
                  <ToggleRow
                    id="discover-jobs"
                    label="Job vacancy discovery"
                    checked={draftAutomate.discoverJobs}
                    onCheckedChange={(checked) =>
                      setDraftAutomate((prev) => (prev ? { ...prev, discoverJobs: checked } : prev))
                    }
                  />
                  <ToggleRow
                    id="discover-companies"
                    label="Company recommendations"
                    checked={draftAutomate.discoverCompanies}
                    onCheckedChange={(checked) =>
                      setDraftAutomate((prev) =>
                        prev ? { ...prev, discoverCompanies: checked } : prev,
                      )
                    }
                  />
                  <ToggleRow
                    id="discover-people"
                    label="Professional networking suggestions"
                    checked={draftAutomate.discoverPeople}
                    onCheckedChange={(checked) =>
                      setDraftAutomate((prev) =>
                        prev ? { ...prev, discoverPeople: checked } : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div className="career-profile-page__row career-profile-page__row--2">
                <Field id="automate-frequency" label="Search frequency">
                  <select
                    id="automate-frequency"
                    className="career-profile-page__select"
                    value={draftAutomate.frequency}
                    onChange={(event) =>
                      setDraftAutomate((prev) =>
                        prev
                          ? {
                              ...prev,
                              frequency: event.target.value as AutomatePrefs["frequency"],
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="manual">Manual only</option>
                    <option value="weekly">Weekly (when scheduled)</option>
                    <option value="daily">Daily (when scheduled)</option>
                  </select>
                </Field>
                <Field id="automate-threshold" label="Relevance threshold">
                  <select
                    id="automate-threshold"
                    className="career-profile-page__select"
                    value={draftAutomate.relevanceThreshold}
                    onChange={(event) =>
                      setDraftAutomate((prev) =>
                        prev
                          ? {
                              ...prev,
                              relevanceThreshold: event.target
                                .value as AutomatePrefs["relevanceThreshold"],
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="low">Broader</option>
                    <option value="medium">Balanced</option>
                    <option value="high">Stricter</option>
                  </select>
                </Field>
              </div>

              <Field id="automate-delivery" label="Where to receive results">
                <select
                  id="automate-delivery"
                  className="career-profile-page__select"
                  value={draftAutomate.delivery}
                  onChange={(event) =>
                    setDraftAutomate((prev) =>
                      prev
                        ? {
                            ...prev,
                            delivery: event.target.value as AutomatePrefs["delivery"],
                          }
                        : prev,
                    )
                  }
                >
                  <option value="in_app">In-app only</option>
                  <option value="in_app_and_email">In-app + email (optional later)</option>
                </select>
              </Field>

              {draftAutomate.delivery === "in_app_and_email" ? (
                <Field id="automate-email" label="Notification email">
                  <input
                    id="automate-email"
                    type="email"
                    className="career-profile-page__input"
                    value={draftAutomate.notificationEmail ?? ""}
                    onChange={(event) =>
                      setDraftAutomate((prev) =>
                        prev ? { ...prev, notificationEmail: event.target.value } : prev,
                      )
                    }
                  />
                </Field>
              ) : null}

              <label className="career-profile-page__consent">
                <input
                  type="checkbox"
                  checked={draftAutomate.consentToUseProfile}
                  onChange={(event) =>
                    setDraftAutomate((prev) =>
                      prev ? { ...prev, consentToUseProfile: event.target.checked } : prev,
                    )
                  }
                />
                <span>
                  I consent to using my Career Profile and Role Strategy for personalised opportunity
                  discovery. No automatic applications or outreach.
                </span>
              </label>

              <p className="career-profile-page__dialog-note">
                Manual searches and scheduled runs will use these settings once Live Job Discovery is
                available. Saving Active now stores your intent — it does not start background jobs.
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              className="career-profile-page__btn"
              onClick={() => setAutomateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="career-profile-page__btn career-profile-page__btn--primary"
              onClick={handleSaveAutomate}
            >
              Save automation settings
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="career-profile-page__field">
      <label className="career-profile-page__field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? <span className="career-profile-page__field-hint">{hint}</span> : null}
      {children}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="career-profile-page__toggle-row">
      <label className="career-profile-page__toggle-label" htmlFor={id}>
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
