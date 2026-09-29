"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useJobSearchTitles } from "@/hooks/use-job-search-titles"
import {
  buildRoleMatchCards,
  buildSearchKeywordChips,
  type RoleMatchCardModel,
} from "@/lib/role-match-present"
import {
  loadSavedRoleTitles,
  saveSavedRoleTitles,
} from "@/lib/saved-role-titles-storage"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Bookmark,
  Briefcase,
  Compass,
  Loader2,
  Scale,
  Sparkles,
  Target,
} from "lucide-react"
import "./role-match-section.css"

const CARD_ICONS = [Scale, Briefcase, Target, Compass, Sparkles] as const

type RoleMatchSectionProps = {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  onNavigateCareerBrain: () => void
}

export function RoleMatchSection({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  onNavigateCareerBrain,
}: RoleMatchSectionProps) {
  const { jobTitles, titlesLoading, titlesSource } = useJobSearchTitles({
    folderId,
    jobApplications,
    versions,
    strategicProfile,
  })

  const [exploreQuery, setExploreQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("")
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null)

  useEffect(() => {
    setSavedTitles(loadSavedRoleTitles(folderId))
  }, [folderId])

  const filteredTitles = useMemo(() => {
    const needle = activeFilter.trim().toLowerCase()
    if (!needle) return jobTitles
    return jobTitles.filter((title) => title.toLowerCase().includes(needle))
  }, [jobTitles, activeFilter])

  const cards = useMemo(
    () =>
      buildRoleMatchCards({
        titles: filteredTitles,
        folderId,
        jobs: jobApplications,
        versions,
        strategicProfile,
        titlesSource,
      }),
    [
      filteredTitles,
      folderId,
      jobApplications,
      versions,
      strategicProfile,
      titlesSource,
    ],
  )

  const keywordChips = useMemo(
    () =>
      buildSearchKeywordChips({
        titles: jobTitles,
        folderId,
        jobs: jobApplications,
        versions,
        strategicProfile,
      }),
    [jobTitles, folderId, jobApplications, versions, strategicProfile],
  )

  const toggleSaved = useCallback(
    (title: string) => {
      setSavedTitles((prev) => {
        const next = prev.includes(title)
          ? prev.filter((item) => item !== title)
          : [...prev, title]
        saveSavedRoleTitles(folderId, next)
        return next
      })
    },
    [folderId],
  )

  const handleFindMatches = () => {
    setActiveFilter(exploreQuery.trim())
  }

  return (
    <section className="home-role-match" aria-labelledby="role-matches-heading">
      <div className="home-role-match__search">
        <Sparkles className="home-role-match__search-icon" aria-hidden />
        <input
          type="search"
          className="home-role-match__search-input"
          value={exploreQuery}
          onChange={(event) => setExploreQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleFindMatches()
          }}
          placeholder="What kind of role are you exploring?"
          aria-label="What kind of role are you exploring?"
        />
        <button type="button" className="home-role-match__search-btn" onClick={handleFindMatches}>
          Find matches
        </button>
      </div>

      <div className="home-role-match__header">
        <h2 id="role-matches-heading" className="home-role-match__title">
          Role matches
        </h2>
        <p className="home-role-match__subtitle">
          {titlesSource === "ai"
            ? "Titles to search on job boards — not live postings. Use them to build confidence about where you fit."
            : "Starter titles from your story and applications — we refine these when more of your profile is in place."}
        </p>
      </div>

      {titlesLoading ? (
        <div className="home-role-match__loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Finding roles that fit your experience…
        </div>
      ) : cards.length > 0 ? (
        <div className="home-role-match__grid">
          {cards.map((card, index) => (
            <RoleMatchCard
              key={card.title}
              card={card}
              index={index}
              saved={savedTitles.includes(card.title)}
              expanded={expandedTitle === card.title}
              onToggleSaved={() => toggleSaved(card.title)}
              onToggleExpanded={() =>
                setExpandedTitle((current) => (current === card.title ? null : card.title))
              }
            />
          ))}
        </div>
      ) : (
        <p className="home-role-match__empty">
          Complete your career story and CV — then we can suggest titles to search for.
        </p>
      )}

      {keywordChips.length > 0 ? (
        <div className="home-role-match__keywords">
          <h3 className="home-role-match__keywords-title">Keywords worth searching</h3>
          <div className="home-role-match__chips" role="list">
            {keywordChips.map((chip) => (
              <button
                key={chip}
                type="button"
                role="listitem"
                className="home-role-match__chip"
                onClick={() => {
                  setExploreQuery(chip)
                  setActiveFilter(chip)
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="home-confidence-card">
        <p className="home-confidence-card__title">Build your confidence</p>
        <p className="home-confidence-card__body">
          Add more to your career story and your fit picture gets sharper — and so does your sense
          of where you stand out.
        </p>
        <button type="button" className="home-confidence-card__cta" onClick={onNavigateCareerBrain}>
          Tell my story
        </button>
      </div>
    </section>
  )
}

function RoleMatchCard({
  card,
  index,
  saved,
  expanded,
  onToggleSaved,
  onToggleExpanded,
}: {
  card: RoleMatchCardModel
  index: number
  saved: boolean
  expanded: boolean
  onToggleSaved: () => void
  onToggleExpanded: () => void
}) {
  const Icon = CARD_ICONS[index % CARD_ICONS.length]!

  return (
    <article
      className={cn("home-role-card", `home-role-card--${card.accent}`)}
      aria-label={`${card.title}, ${card.fitLabel}`}
    >
      <div className="home-role-card__header">
        <Icon className="home-role-card__header-icon" aria-hidden />
        <span className="home-role-card__badge">{card.fitLabel}</span>
      </div>
      <div className="home-role-card__body">
        <p className="home-role-card__title">{card.title}</p>
        <p className="home-role-card__instruction">
          Search this title on LinkedIn, Indeed, StepStone
        </p>
        <p className="home-role-card__summary">{card.summary}</p>
        {expanded ? (
          <p className="home-role-card__detail">{card.detail}</p>
        ) : null}
        <div className="home-role-card__actions">
          <button
            type="button"
            className={cn("home-role-card__save", saved && "home-role-card__save--active")}
            onClick={onToggleSaved}
            aria-label={saved ? `Unsave ${card.title}` : `Save ${card.title}`}
            aria-pressed={saved}
          >
            <Bookmark className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="home-role-card__fit-btn" onClick={onToggleExpanded}>
            {expanded ? "Hide" : "Why I'm a fit"}
          </button>
        </div>
      </div>
    </article>
  )
}
