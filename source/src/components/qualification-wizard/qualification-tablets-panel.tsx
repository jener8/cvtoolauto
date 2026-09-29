"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { QualificationProfileSummary } from "@/components/qualification-wizard/qualification-wizard"
import {
  ALL_QUALIFICATION_TABLETS,
  findTabletById,
  isSuggestionTabletId,
  QUALIFICATION_TABLET_GROUPS,
  type QualificationTablet,
} from "@/lib/qualification-profile/tablet-suggestions"
import { saveQualificationProfile } from "@/lib/qualification-profile/storage"
import type { QualificationAbility, QualificationProfile } from "@/lib/qualification-profile/types"
import { cn } from "@/lib/utils"
import { Check, Plus, X } from "lucide-react"
import "./qualification-tablets-panel.css"

type QualificationTabletsPanelProps = {
  profile: QualificationProfile
  onProfileChange: (profile: QualificationProfile) => void
  onOpenWizard?: () => void
  showFormalSummary?: boolean
}

function abilityFromTablet(tablet: QualificationTablet): QualificationAbility {
  return {
    id: tablet.id,
    name: tablet.label,
    category: tablet.category,
    evidenceAchievementIds: [],
  }
}

export function QualificationTabletsPanel({
  profile,
  onProfileChange,
  onOpenWizard,
  showFormalSummary,
}: QualificationTabletsPanelProps) {
  const abilities = profile.abilities ?? []
  const [customLabel, setCustomLabel] = useState("")

  const selectedIds = useMemo(
    () => new Set(abilities.map((ability) => ability.id)),
    [abilities],
  )

  const customAbilities = useMemo(
    () => abilities.filter((ability) => !isSuggestionTabletId(ability.id)),
    [abilities],
  )

  const persistAbilities = useCallback(
    (nextAbilities: QualificationAbility[]) => {
      const updated = saveQualificationProfile({
        ...profile,
        abilities: nextAbilities,
      })
      onProfileChange(updated)
    },
    [onProfileChange, profile],
  )

  const toggleTablet = useCallback(
    (tablet: QualificationTablet) => {
      if (selectedIds.has(tablet.id)) {
        persistAbilities(abilities.filter((ability) => ability.id !== tablet.id))
        return
      }
      persistAbilities([...abilities, abilityFromTablet(tablet)])
    },
    [abilities, persistAbilities, selectedIds],
  )

  const removeAbility = useCallback(
    (id: string) => {
      persistAbilities(abilities.filter((ability) => ability.id !== id))
    },
    [abilities, persistAbilities],
  )

  const addCustomAbility = useCallback(() => {
    const label = customLabel.trim()
    if (!label) return
    const duplicate = abilities.some(
      (ability) => ability.name.trim().toLowerCase() === label.toLowerCase(),
    )
    if (duplicate) {
      setCustomLabel("")
      return
    }
    const next: QualificationAbility = {
      id: `ab-${Date.now().toString(36)}`,
      name: label,
      category: "other",
      evidenceAchievementIds: [],
    }
    persistAbilities([...abilities, next])
    setCustomLabel("")
  }, [abilities, customLabel, persistAbilities])

  const collectedCount = abilities.length

  return (
    <div className="qual-tablets">
      <section className="qual-tablets__collected" aria-labelledby="qual-collected-heading">
        <div className="qual-tablets__collected-header">
          <h2 id="qual-collected-heading" className="qual-tablets__collected-title">
            Your qualifications
          </h2>
          <p className="qual-tablets__collected-hint">
            {collectedCount === 0
              ? "Tap the ideas below that sound like you — there’s no right number."
              : `${collectedCount} collected — tap again to remove.`}
          </p>
        </div>

        {collectedCount > 0 ? (
          <div className="qual-tablets__collected-grid" role="list">
            {abilities.map((ability) => {
              const tablet = findTabletById(ability.id)
              const label = tablet?.label ?? ability.name
              return (
                <button
                  key={ability.id}
                  type="button"
                  role="listitem"
                  className="qual-tablet qual-tablet--collected"
                  onClick={() => removeAbility(ability.id)}
                  aria-label={`Remove ${label}`}
                >
                  <Check className="qual-tablet__check" aria-hidden />
                  <span>{label}</span>
                  <X className="qual-tablet__remove" aria-hidden />
                </button>
              )
            })}
          </div>
        ) : (
          <p className="qual-tablets__collected-empty">
            Nothing selected yet. Start with anything that feels true — certificates optional.
          </p>
        )}
      </section>

      {QUALIFICATION_TABLET_GROUPS.map((group) => (
        <section key={group.label} className="qual-tablets__group" aria-labelledby={`qual-group-${group.label}`}>
          <h3 id={`qual-group-${group.label}`} className="qual-tablets__group-title">
            {group.label}
          </h3>
          <div className="qual-tablets__grid">
            {group.tablets.map((tablet) => {
              const selected = selectedIds.has(tablet.id)
              return (
                <button
                  key={tablet.id}
                  type="button"
                  className={cn("qual-tablet", selected && "qual-tablet--selected")}
                  onClick={() => toggleTablet(tablet)}
                  aria-pressed={selected}
                >
                  {selected ? <Check className="qual-tablet__check" aria-hidden /> : null}
                  <span>{tablet.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <section className="qual-tablets__custom" aria-labelledby="qual-custom-heading">
        <h3 id="qual-custom-heading" className="qual-tablets__group-title">
          Something else?
        </h3>
        <div className="qual-tablets__custom-row">
          <input
            type="text"
            className="qual-tablets__custom-input"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addCustomAbility()
            }}
            placeholder="Add your own qualification…"
            aria-label="Add your own qualification"
          />
          <Button
            type="button"
            variant="outline"
            className="qual-tablets__custom-btn"
            onClick={addCustomAbility}
            disabled={!customLabel.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </div>
        {customAbilities.length > 0 ? (
          <p className="qual-tablets__custom-note">
            Your own additions appear in the collection above.
          </p>
        ) : null}
      </section>

      <section className="qual-tablets__formal" aria-labelledby="qual-formal-heading">
        <h3 id="qual-formal-heading" className="qual-tablets__group-title">
          Degrees &amp; certificates
        </h3>
        <p className="qual-tablets__formal-copy">
          Have a degree, vocational certificate or training from abroad? Add the details here — we&apos;ll
          help you prepare for recognition conversations.
        </p>
        {showFormalSummary ? (
          <QualificationProfileSummary profile={profile} onEdit={onOpenWizard} />
        ) : onOpenWizard ? (
          <Button type="button" variant="outline" onClick={onOpenWizard}>
            Add formal qualification
          </Button>
        ) : null}
      </section>
    </div>
  )
}

/** Count tablets selected from the suggestion list (for analytics / empty checks). */
export function countSelectedTablets(profile: QualificationProfile): number {
  const ids = new Set(ALL_QUALIFICATION_TABLETS.map((tablet) => tablet.id))
  return (profile.abilities ?? []).filter((ability) => ids.has(ability.id)).length
}
