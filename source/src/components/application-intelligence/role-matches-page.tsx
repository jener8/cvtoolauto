"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { storySectionsCompleted } from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { hasQualificationProfileContent } from "@/lib/qualification-profile/storage"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { usePageTitle } from "@/hooks/use-page-title"
import { cn } from "@/lib/utils"
import {
  Bookmark,
  Briefcase,
  Check,
  Compass,
  Copy,
  Scale,
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { HomeRoleSearch } from "@/components/application-intelligence/home-role-search"
import {
  buildExploreKeywordCluster,
  extractKeywordClusters,
  toKeywordCardModels,
} from "@/lib/search-keywords/extract"
import type { KeywordCardModel, KeywordCluster } from "@/lib/search-keywords/types"
import {
  isKeywordSaved,
  loadSavedKeywords,
  saveSavedKeywords,
  toggleSavedKeyword,
} from "@/lib/search-keywords/saved-storage"
import "./role-match-section.css"
import "./role-matches-page.css"

const CARD_ICONS = [Scale, Briefcase, Target, Compass, Sparkles] as const

function exploreStorageKey(folderId: string): string {
  return `keyword-explore:${folderId}`
}

type RoleMatchesPageProps = {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  onNavigateCareerBrain: () => void
}

export function RoleMatchesPage({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  qualificationProfile,
  onNavigateCareerBrain,
}: RoleMatchesPageProps) {
  usePageTitle(pageTitleForSection("roleMatches"))

  const storySectionsFilled = strategicProfile ? storySectionsCompleted(strategicProfile) : 0
  const showConfidencePrompt = storySectionsFilled < 4
  const hasKeywordSources =
    storySectionsFilled > 0 ||
    hasQualificationProfileContent(qualificationProfile) ||
    jobApplications.length > 0
  const isStoryEmpty = !hasKeywordSources

  const [exploreQuery, setExploreQuery] = useState("")
  const [exploreCluster, setExploreCluster] = useState<KeywordCluster | null>(null)

  const [saved, setSaved] = useState<import("@/lib/search-keywords/types").SavedKeywordCluster[]>(
    [],
  )

  useEffect(() => {
    setSaved(loadSavedKeywords(folderId))
  }, [folderId])

  const tipDismissKey = useMemo(() => `search-keywords-tip-dismissed:${folderId}`, [folderId])
  const [tipDismissed, setTipDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      setTipDismissed(localStorage.getItem(tipDismissKey) === "1")
    } catch {
      setTipDismissed(false)
    }
  }, [tipDismissKey])

  const dismissTip = useCallback(() => {
    setTipDismissed(true)
    try {
      localStorage.setItem(tipDismissKey, "1")
    } catch {
      // ignore persistence failures
    }
  }, [tipDismissKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const pending = sessionStorage.getItem(exploreStorageKey(folderId))
      if (pending?.trim()) {
        setExploreQuery(pending.trim())
        const cluster = buildExploreKeywordCluster(pending.trim())
        setExploreCluster(cluster)
        sessionStorage.removeItem(exploreStorageKey(folderId))
      }
    } catch {
      // ignore
    }
  }, [folderId])

  const derivedCards = useMemo(() => {
    if (!hasKeywordSources) return [] as KeywordCardModel[]
    const clusters = extractKeywordClusters({
      folderId,
      strategicProfile,
      jobApplications,
      qualificationProfile,
      maxCards: 10,
    })
    return toKeywordCardModels(clusters)
  }, [folderId, strategicProfile, jobApplications, qualificationProfile, hasKeywordSources])

  const exploreCard = useMemo(() => {
    if (!exploreCluster) return null
    return toKeywordCardModels([exploreCluster])[0] ?? null
  }, [exploreCluster])

  const currentCards = useMemo(() => {
    const combined = exploreCard ? [exploreCard, ...derivedCards] : derivedCards
    // keep at most 10 cards visible
    return combined.slice(0, 10)
  }, [derivedCards, exploreCard])

  const savedOnlyCards = useMemo(() => {
    if (saved.length === 0) return [] as KeywordCardModel[]
    const currentIds = new Set(currentCards.map((c) => c.id))
    const orphaned = saved.filter((k) => !currentIds.has(k.id))
    return toKeywordCardModels(orphaned)
  }, [saved, currentCards])

  const hasCardSections = currentCards.length > 0 || savedOnlyCards.length > 0

  const handleExplore = useCallback(async () => {
    const cluster = buildExploreKeywordCluster(exploreQuery)
    setExploreCluster(cluster)
  }, [exploreQuery])

  const toggleSaved = useCallback(
    (keyword: KeywordCluster) => {
      setSaved((prev) => {
        const next = toggleSavedKeyword(prev, keyword)
        saveSavedKeywords(folderId, next)
        return next
      })
    },
    [folderId],
  )

  const isSaved = useCallback((keywordId: string) => isKeywordSaved(saved, keywordId), [saved])

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

  return (
    <div className="role-matches-page">
      <header className="role-matches-page__header">
        <h1 className="role-matches-page__title">Keyword matches</h1>
        <p className="role-matches-page__subtitle">
          Find jobs that need your skills — not just a job title. Search with keywords like
          {" "}
          <em>workshop facilitation</em>
          {" "}
          or
          {" "}
          <em>Barrierefreiheit</em>
          {" "}
          on LinkedIn, Indeed, or StepStone to uncover roles title searches miss.
        </p>
      </header>

      {!tipDismissed ? (
        <div className="role-matches-page__tip" role="note" aria-label="Search tip">
          <div className="role-matches-page__tip-body">
            <strong>Tip: search by skill, not title.</strong> The same work can be called
            {" "}
            <span className="role-matches-page__tip-example">
              &quot;Workshop Facilitator&quot;, &quot;Agile Coach&quot; or &quot;Change Manager&quot;
            </span>
            {" "}
            — but they all need workshop facilitation. Keywords find them all.
          </div>
          <button
            type="button"
            className="role-matches-page__tip-dismiss"
            onClick={dismissTip}
            aria-label="Dismiss tip"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="role-matches-page__toolbar">
        <HomeRoleSearch
          value={exploreQuery}
          onChange={setExploreQuery}
          onSubmit={handleExplore}
          placeholder="Try a skill — e.g. workshop facilitation, Figma, Barrierefreiheit"
          ariaLabel="Try a skill keyword"
          buttonLabel="Search keyword"
        />
      </div>

      {hasCardSections ? (
        <p className="role-matches-page__instruction">
          Copy a keyword or open a job board — search in German and English to see more roles.
        </p>
      ) : null}

      <div className="role-matches-page__toast" role="status" aria-live="polite">
        {toast ?? ""}
      </div>

      {!isStoryEmpty && savedOnlyCards.length > 0 ? (
        <section className="role-matches-page__section" aria-labelledby="saved-matches-heading">
          <h2 id="saved-matches-heading" className="role-matches-page__section-title">
            Saved keywords
          </h2>
          <div className="home-role-match__grid role-matches-page__grid">
            {savedOnlyCards.map((card, index) => (
              <KeywordCard
                key={card.id}
                card={card}
                index={index}
                saved
                onToggleSaved={() => toggleSaved(card)}
                onToast={showToast}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!isStoryEmpty && currentCards.length > 0 ? (
        <section className="role-matches-page__section" aria-labelledby="current-matches-heading">
          {savedOnlyCards.length > 0 ? (
            <h2 id="current-matches-heading" className="role-matches-page__section-title">
              Your keywords
            </h2>
          ) : null}
          <div className="home-role-match__grid role-matches-page__grid">
            {currentCards.map((card, index) => (
              <KeywordCard
                key={card.id}
                card={card}
                index={index}
                saved={isSaved(card.id)}
                onToggleSaved={() => toggleSaved(card)}
                onToast={showToast}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isStoryEmpty ? (
        <div className="role-matches-page__empty">
          <h2 className="role-matches-page__empty-title">Your keywords come from your story</h2>
          <p className="role-matches-page__empty-body">
            Tell us what you can do — we&apos;ll turn it into search keywords (German and English)
            so you can find jobs that need your skills, not just a specific title.
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

      {showConfidencePrompt ? (
        <div className="home-confidence-card role-matches-page__confidence">
          <p className="home-confidence-card__title">Build your confidence</p>
          <p className="home-confidence-card__body">
            {`${storySectionsFilled} of 4 sections filled — add more to your career story for sharper keyword matches.`}
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

function KeywordCard({
  card,
  index,
  saved,
  onToggleSaved,
  onToast,
}: {
  card: KeywordCardModel
  index: number
  saved?: boolean
  onToggleSaved?: () => void
  onToast: (message: string) => void
}) {
  const Icon = CARD_ICONS[index % CARD_ICONS.length]!
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(card.searchString)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      onToast("Copied — paste this into LinkedIn, Indeed or StepStone.")
    } catch {
      // Clipboard unavailable — no-op
    }
  }, [card.searchString, onToast])

  const openSearch = useCallback((site: "linkedin" | "indeed" | "stepstone") => {
    const q = encodeURIComponent(card.searchString)
    const url =
      site === "linkedin"
        ? `https://www.linkedin.com/jobs/search/?keywords=${q}`
        : site === "indeed"
          ? `https://de.indeed.com/jobs?q=${q}`
          : `https://www.stepstone.de/jobs?keywords=${q}`
    window.open(url, "_blank", "noopener,noreferrer")
  }, [card.searchString])

  return (
    <article
      className={cn("home-role-card", `home-role-card--${card.accent}`)}
      aria-label={`${card.displayTitle}, ${card.fitLabel}`}
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
        <p className="home-role-card__title keyword-card__title">{card.displayTitle}</p>

        <div className="keyword-card__actions">
          <div className="keyword-card__actions-icons">
            <button
              type="button"
              className={cn("home-role-card__icon-btn", copied && "home-role-card__icon-btn--copied")}
              onClick={() => void handleCopy()}
              aria-label={copied ? `Copied search string for ${card.displayTitle}` : `Copy search string for ${card.displayTitle}`}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
            {onToggleSaved ? (
              <button
                type="button"
                className={cn(
                  "home-role-card__icon-btn",
                  saved && "home-role-card__icon-btn--saved",
                )}
                onClick={onToggleSaved}
                aria-label={saved ? `Unsave ${card.displayTitle}` : `Save ${card.displayTitle}`}
                aria-pressed={saved}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="keyword-card__sites">
            <button
              type="button"
              className="keyword-card__site-btn"
              onClick={() => openSearch("linkedin")}
              aria-label={`Search ${card.displayTitle} on LinkedIn`}
            >
              LinkedIn
            </button>
            <button
              type="button"
              className="keyword-card__site-btn"
              onClick={() => openSearch("indeed")}
              aria-label={`Search ${card.displayTitle} on Indeed`}
            >
              Indeed
            </button>
            <button
              type="button"
              className="keyword-card__site-btn"
              onClick={() => openSearch("stepstone")}
              aria-label={`Search ${card.displayTitle} on StepStone`}
            >
              StepStone
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
