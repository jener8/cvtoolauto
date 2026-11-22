"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { storySectionsCompleted } from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { usePageTitle } from "@/hooks/use-page-title"
import { useHomeRoleMatch, type RoleMatchCardModel } from "@/hooks/use-home-role-match"
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
import { HomeRoleSearch } from "@/components/application-intelligence/home-role-search"
import "./role-match-section.css"
import "./role-matches-page.css"

const CARD_ICONS = [Scale, Briefcase, Target, Compass, Sparkles] as const

type RoleMatchesPageProps = {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  onNavigateCareerBrain: () => void
  onNavigateCareerProfile?: () => void
}

export function RoleMatchesPage({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  onNavigateCareerBrain,
  onNavigateCareerProfile,
}: RoleMatchesPageProps) {
  usePageTitle(pageTitleForSection("roleMatches"))

  const storySectionsFilled = strategicProfile ? storySectionsCompleted(strategicProfile) : 0
  const showConfidencePrompt = storySectionsFilled < 4
  const hasStoryOrCv =
    storySectionsFilled > 0 || versions.some((version) => Boolean(version.content?.trim()))
  const isStoryEmpty = !hasStoryOrCv

  const {
    exploreQuery,
    setExploreQuery,
    titlesLoading,
    titlesSource,
    searchError,
    cards,
    savedOnlyCards,
    keywordChips,
    handleFindMatches,
    handleRefreshMatches,
    hasMatches,
    toggleSaved,
    isSaved,
  } = useHomeRoleMatch({
    folderId,
    jobApplications,
    versions,
    strategicProfile,
  })

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500)
  }, [])

  const handleToggleSaved = useCallback(
    (card: RoleMatchCardModel) => {
      toggleSaved(card)
      showToast(isSaved(card.id) ? "Removed from saved directions" : "Saved to your Role Strategy")
    },
    [isSaved, showToast, toggleSaved],
  )

  const subtitle = useMemo(() => {
    if (titlesLoading) {
      return "Looking at your story and CV for directions where your experience creates value…"
    }
    if (titlesSource === "ai" && hasMatches) {
      return "Career directions grounded in your strengths — including adjacent and transition roles, not only titles you have already held."
    }
    if (titlesSource === "fallback" && hasMatches) {
      return "Starter directions from your story and applications. Generate again after you add more detail for sharper suggestions."
    }
    return "Discover where your experience has value — transferable strengths, adjacent roles, and problems you are well placed to solve."
  }, [hasMatches, titlesLoading, titlesSource])

  return (
    <div className="role-matches-page">
      <header className="role-matches-page__header">
        <h1 className="role-matches-page__title">Role Strategy</h1>
        <p className="role-matches-page__subtitle">{subtitle}</p>
        {onNavigateCareerProfile ? (
          <p className="role-matches-page__instruction" style={{ marginTop: "0.65rem" }}>
            Preferences and Automate live in your{" "}
            <button
              type="button"
              className="role-matches-page__empty-cta"
              style={{ display: "inline", padding: 0, minHeight: 0, border: "none", background: "none", color: "#0f7b6c", textDecoration: "underline", cursor: "pointer" }}
              onClick={onNavigateCareerProfile}
            >
              Career Profile
            </button>
            .
          </p>
        ) : null}
      </header>

      <div className="role-matches-page__toolbar">
        <HomeRoleSearch
          value={exploreQuery}
          onChange={setExploreQuery}
          onSubmit={() => void handleFindMatches()}
          placeholder="What direction are you exploring? e.g. product ops, accessibility, facilitation"
          ariaLabel="Explore a career direction"
          buttonLabel={hasMatches ? "Refresh strategy" : "Build strategy"}
        />
      </div>

      {searchError ? (
        <p className="role-matches-page__instruction" role="alert">
          {searchError}
        </p>
      ) : null}

      {hasMatches ? (
        <p className="role-matches-page__instruction">
          Save directions that resonate. Matching skills show why each path may fit — use them to
          explore jobs, companies, and conversations later.
        </p>
      ) : null}

      <div className="role-matches-page__toast" role="status" aria-live="polite">
        {toast ?? ""}
      </div>

      {titlesLoading ? (
        <div className="home-role-match__loading" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Building your Role Strategy…
        </div>
      ) : null}

      {!titlesLoading && !isStoryEmpty && savedOnlyCards.length > 0 ? (
        <section className="role-matches-page__section" aria-labelledby="saved-matches-heading">
          <h2 id="saved-matches-heading" className="role-matches-page__section-title">
            Saved directions
          </h2>
          <div className="home-role-match__grid role-matches-page__grid">
            {savedOnlyCards.map((card, index) => (
              <RoleStrategyCard
                key={card.id}
                card={card}
                index={index}
                saved
                onToggleSaved={() => handleToggleSaved(card)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!titlesLoading && !isStoryEmpty && cards.length > 0 ? (
        <section className="role-matches-page__section" aria-labelledby="current-matches-heading">
          {savedOnlyCards.length > 0 ? (
            <h2 id="current-matches-heading" className="role-matches-page__section-title">
              Suggested directions
            </h2>
          ) : null}
          <div className="home-role-match__grid role-matches-page__grid">
            {cards.map((card, index) => (
              <RoleStrategyCard
                key={card.id}
                card={card}
                index={index}
                saved={isSaved(card.id)}
                onToggleSaved={() => handleToggleSaved(card)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!titlesLoading && !isStoryEmpty && keywordChips.length > 0 ? (
        <section className="role-matches-page__section" aria-labelledby="strategy-keywords-heading">
          <h2 id="strategy-keywords-heading" className="role-matches-page__section-title">
            Capabilities worth emphasising
          </h2>
          <div className="home-role-match__chips" role="list">
            {keywordChips.map((chip) => (
              <button
                key={chip}
                type="button"
                role="listitem"
                className="home-role-match__chip"
                onClick={() => {
                  setExploreQuery(chip)
                  void handleFindMatches(chip)
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isStoryEmpty && !titlesLoading ? (
        <div className="role-matches-page__empty">
          <h2 className="role-matches-page__empty-title">Your Role Strategy starts with your story</h2>
          <p className="role-matches-page__empty-body">
            Add your CV or career story — we&apos;ll surface directions where your experience creates
            value, including adjacent roles and transition opportunities.
          </p>
          <button
            type="button"
            className="role-matches-page__empty-cta"
            onClick={onNavigateCareerBrain}
          >
            Tell my story
          </button>
        </div>
      ) : null}

      {!isStoryEmpty && !titlesLoading && !hasMatches ? (
        <div className="role-matches-page__empty">
          <h2 className="role-matches-page__empty-title">Ready when you are</h2>
          <p className="role-matches-page__empty-body">
            Build a Role Strategy from your story and CV, or refine with a direction you want to
            explore.
          </p>
          <button
            type="button"
            className="role-matches-page__empty-cta"
            onClick={() => void handleRefreshMatches()}
          >
            Build strategy
          </button>
        </div>
      ) : null}

      {showConfidencePrompt && !isStoryEmpty ? (
        <div className="home-confidence-card role-matches-page__confidence">
          <p className="home-confidence-card__title">Sharpen your strategy</p>
          <p className="home-confidence-card__body">
            {`${storySectionsFilled} of 4 story sections filled — add more detail for clearer directions and stronger evidence.`}
          </p>
          <button
            type="button"
            className="home-confidence-card__cta"
            onClick={onNavigateCareerBrain}
          >
            Tell my story
          </button>
        </div>
      ) : null}
    </div>
  )
}

function RoleStrategyCard({
  card,
  index,
  saved,
  onToggleSaved,
}: {
  card: RoleMatchCardModel
  index: number
  saved?: boolean
  onToggleSaved?: () => void
}) {
  const Icon = CARD_ICONS[index % CARD_ICONS.length]!

  return (
    <article
      className={cn("home-role-card", `home-role-card--${card.accent}`)}
      aria-label={`${card.title}, ${card.fitLabel}`}
    >
      <div className="home-role-card__header">
        <Icon className="home-role-card__header-icon" aria-hidden />
        <span
          className={cn(
            "home-role-card__badge",
            card.fitLevel === "strong"
              ? "home-role-card__badge--strong"
              : "home-role-card__badge--growing",
          )}
        >
          {card.fitLabel}
        </span>
      </div>
      <div className="home-role-card__body">
        <p className="home-role-card__title">{card.title}</p>
        {card.matchingSkills.length > 0 ? (
          <ul className="home-role-card__skills">
            {card.matchingSkills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        ) : (
          <p className="home-role-card__instruction">
            Open this direction to explore where your experience creates value.
          </p>
        )}
        <div className="home-role-card__actions">
          {onToggleSaved ? (
            <button
              type="button"
              className={cn("home-role-card__save", saved && "home-role-card__save--active")}
              onClick={onToggleSaved}
              aria-label={saved ? `Unsave ${card.title}` : `Save ${card.title}`}
              aria-pressed={saved}
            >
              <Bookmark className="h-4 w-4" aria-hidden />
              {saved ? "Saved" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
