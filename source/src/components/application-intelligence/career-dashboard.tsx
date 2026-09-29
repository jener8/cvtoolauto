"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { HomeRoleSearch } from "@/components/application-intelligence/home-role-search"
import { ILLUSTRATION_SLOT_META, type IllustrationSlot } from "@/lib/illustration-slots"
import { storySectionsCompleted } from "@/lib/career-story-sections"
import {
  extractKeywordClusters,
  toKeywordCardModels,
} from "@/lib/search-keywords/extract"
import type { CareerJourneyGuide } from "@/lib/career-journey-guide"
import type { CareerRecommendationDirectAction } from "@/lib/career-journey-guide"
import type { WorkspaceNavId } from "@/lib/workspace-navigation"
import { usePageTitle } from "@/hooks/use-page-title"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { hasQualificationProfileContent } from "@/lib/qualification-profile/storage"
import {
  DASHBOARD_HERO_COPY,
  firstNameFromUserName,
  pageTitleForSection,
  SECTION_EMPTY_STATES,
} from "@/lib/workspace-shell-copy"
import { cn } from "@/lib/utils"
import "./career-dashboard.css"
import "./role-match-section.css"

const HOME_CARD_ILLUSTRATIONS = {
  hero: "marketing.heroPlatform",
  roleMatches: "progress.motivation",
  qualifications: "section.recognitionPathways",
  confidence: "section.careerBrain",
  findSupport: "section.mentoringSupport",
} as const satisfies Record<string, IllustrationSlot>

function HomeCardImage({
  slot,
  className,
  style,
}: {
  slot: IllustrationSlot
  className?: string
  style?: CSSProperties
}) {
  const { src } = ILLUSTRATION_SLOT_META[slot]
  return (
  // eslint-disable-next-line @next/next/no-img-element -- decorative slot art; empty alt per home spec
    <img src={src} alt="" aria-hidden="true" className={className} style={style} />
  )
}

export type CareerDashboardProps = {
  folderId: string
  folderName?: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  userName?: string
  onNavigateOpportunities: () => void
  onNavigateApplications: () => void
  onNavigateAiCoach: () => void
  onStartApplication: () => void
  onOpenApplication: (jobId: string) => void
  onCareerAction?: (card: unknown) => void
  onOpenProgramme?: () => void
  journeyProgress?: unknown
  careerJourneyGuide?: CareerJourneyGuide
  onJourneyNavigate?: (id: WorkspaceNavId, directAction?: CareerRecommendationDirectAction) => void
}

export function CareerDashboard({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  qualificationProfile,
  userName,
  onJourneyNavigate,
}: CareerDashboardProps) {
  usePageTitle(pageTitleForSection("careerHome"))

  const firstName = firstNameFromUserName(userName)
  const [exploreQuery, setExploreQuery] = useState("")

  const canNavigate = Boolean(onJourneyNavigate)
  const storyFilled = strategicProfile ? storySectionsCompleted(strategicProfile) : 0
  const hasKeywordSources =
    storyFilled > 0 ||
    hasQualificationProfileContent(qualificationProfile) ||
    jobApplications.length > 0
  const keywordTeasers = useMemo(() => {
    if (!hasKeywordSources) return []
    return toKeywordCardModels(
      extractKeywordClusters({
        folderId,
        strategicProfile,
        jobApplications,
        qualificationProfile,
        maxCards: 3,
      }),
    )
  }, [folderId, strategicProfile, jobApplications, qualificationProfile, hasKeywordSources])

  const hasQualifications = hasQualificationProfileContent(qualificationProfile)
  const qualificationsMotivation = SECTION_EMPTY_STATES.recognitionPathways

  const handleFindKeywordsFromHome = () => {
    if (exploreQuery.trim() && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`keyword-explore:${folderId}`, exploreQuery.trim())
      } catch {
        // ignore
      }
    }
    onJourneyNavigate?.("roleMatches")
  }

  return (
    <div className="home-dashboard">
      <div className="home-dashboard__grid">
        <section className="home-dashboard__hero home-card home-card--hero" aria-labelledby="home-hero-heading">
          <div className="home-card--hero__copy">
            <p className="home-card--hero__eyebrow">{DASHBOARD_HERO_COPY.welcomeEyebrow(firstName)}</p>
            <h1 id="home-hero-heading" className="home-card--hero__headline">
              {DASHBOARD_HERO_COPY.headline}
            </h1>
            <p className="home-card--hero__subtext">{DASHBOARD_HERO_COPY.subtext}</p>
          </div>
          <HomeCardImage
            slot={HOME_CARD_ILLUSTRATIONS.hero}
            className="home-card--hero__visual"
          />
        </section>

        <div className="home-dashboard__row home-dashboard__row--two">
        <section className="home-card home-card--role-matches" aria-labelledby="role-matches-heading">
          <HomeCardImage
            slot={HOME_CARD_ILLUSTRATIONS.roleMatches}
            className="home-card__illus home-card__illus--featured"
          />
          <div className="home-card__body">
            <h2 id="role-matches-heading" className="home-card__title">
              Keyword matches
            </h2>
            <HomeRoleSearch
              value={exploreQuery}
              onChange={setExploreQuery}
              onSubmit={handleFindKeywordsFromHome}
              placeholder="Try a skill — e.g. workshop facilitation"
              ariaLabel="Try a skill keyword"
              buttonLabel="Search keyword"
            />

            {keywordTeasers.length > 0 ? (
              <ul className="home-role-rows home-role-rows--in-card" aria-label="Top keyword matches">
                {keywordTeasers.map((card) => (
                  <li key={card.id} className="home-role-row">
                    <span className="home-role-row__title">{card.displayTitle}</span>
                    <span
                      className={cn(
                        "home-role-row__badge",
                        card.fitLevel === "strong"
                          ? "home-role-row__badge--strong"
                          : "home-role-row__badge--growing",
                      )}
                    >
                      {card.fitLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-card__copy home-card__copy--muted home-card__copy--after-search">
                Tell your story — we&apos;ll suggest keywords to search for jobs that need your skills.
              </p>
            )}

            {canNavigate ? (
              <button
                type="button"
                className="home-card__see-all home-card__see-all--cta"
                onClick={() => onJourneyNavigate!("roleMatches")}
              >
                See all keywords
              </button>
            ) : null}
          </div>
        </section>

        <section className="home-card home-card--qualifications" aria-labelledby="qualifications-heading">
          <HomeCardImage
            slot={HOME_CARD_ILLUSTRATIONS.qualifications}
            className="home-card__illus home-card__illus--featured"
          />
          <div className="home-card__body home-card__body--qualifications">
            <h2 id="qualifications-heading" className="home-card__title">
              Your qualifications
            </h2>
            {hasQualifications ? (
              <p className="home-card__copy">We use these to suggest recognition pathways.</p>
            ) : (
              <div className="home-card--qualifications__motivation">
                <p className="home-card--qualifications__motivation-heading">
                  {qualificationsMotivation.heading}
                </p>
                <p className="home-card--qualifications__motivation-body">
                  {qualificationsMotivation.body}
                </p>
              </div>
            )}
            {canNavigate ? (
              <button
                type="button"
                className="home-card__btn home-card__btn--qualifications home-card__btn--qualifications-cta"
                onClick={() => onJourneyNavigate!("recognitionPathways")}
              >
                {hasQualifications ? "View qualifications" : qualificationsMotivation.cta}
              </button>
            ) : null}
          </div>
        </section>
        </div>

        <div className="home-dashboard__row home-dashboard__row--two">
          <section className="home-card home-card--confidence" aria-labelledby="confidence-heading">
            <HomeCardImage
              slot={HOME_CARD_ILLUSTRATIONS.confidence}
              className="home-card__illus home-card__illus--compact"
            />
            <div className="home-card__body home-card__body--confidence">
              <h2 id="confidence-heading" className="home-card--confidence__title">
                Build your confidence
              </h2>
              <p className="home-card--confidence__copy">
                Add to your career story for sharper matches.
              </p>
              {canNavigate ? (
                <button
                  type="button"
                  className="home-card__btn home-card__btn--confidence"
                  onClick={() => onJourneyNavigate!("careerBrain")}
                >
                  Tell my story
                </button>
              ) : null}
            </div>
          </section>

          {canNavigate ? (
            <button
              type="button"
              className="home-card home-card--support"
              onClick={() => onJourneyNavigate!("mentoringSupport")}
            >
              <HomeCardImage
                slot={HOME_CARD_ILLUSTRATIONS.findSupport}
                className="home-card__illus home-card__illus--compact"
              />
              <div className="home-card__body home-card__body--support">
                <span className="home-card--support__title">Find support</span>
                <span className="home-card--support__subtitle">Mentors, coaches, groups</span>
              </div>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
