"use client"

import { CareerNextStepCard } from "@/components/application-intelligence/career-next-step-card"
import { RoleMatchSection } from "@/components/application-intelligence/role-match-section"
import { Illustration } from "@/components/illustrations/illustration"
import type { CareerJourneyGuide } from "@/lib/career-journey-guide"
import type { CareerRecommendationDirectAction } from "@/lib/career-journey-guide"
import type { WorkspaceNavId } from "@/lib/workspace-navigation"
import { usePageTitle } from "@/hooks/use-page-title"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { WorkspaceJourneyProgress } from "@/lib/workspace-journey-progress"
import {
  DASHBOARD_HERO_COPY,
  firstNameFromUserName,
  pageTitleForSection,
} from "@/lib/workspace-shell-copy"
import "./career-dashboard.css"

export type CareerDashboardProps = {
  folderId: string
  folderName?: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  userName?: string
  onNavigateOpportunities: () => void
  onNavigateApplications: () => void
  onNavigateAiCoach: () => void
  onStartApplication: () => void
  onOpenApplication: (jobId: string) => void
  onCareerAction?: (card: unknown) => void
  onOpenProgramme?: () => void
  journeyProgress?: WorkspaceJourneyProgress
  careerJourneyGuide?: CareerJourneyGuide
  onJourneyNavigate?: (id: WorkspaceNavId, directAction?: CareerRecommendationDirectAction) => void
}

export function CareerDashboard({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  userName,
  careerJourneyGuide,
  onJourneyNavigate,
}: CareerDashboardProps) {
  usePageTitle(pageTitleForSection("careerHome"))

  const firstName = firstNameFromUserName(userName)

  return (
    <div className="ai-career-dashboard career-dashboard min-h-full">
      <header className="career-dashboard__header">
        <div className="career-dashboard__header-inner">
          <div className="career-dashboard__header-copy">
            <p className="career-dashboard__welcome">
              {DASHBOARD_HERO_COPY.welcomeEyebrow(firstName)}
            </p>
            <h1 className="career-dashboard__headline">{DASHBOARD_HERO_COPY.headline}</h1>
            <p className="career-dashboard__subtext">{DASHBOARD_HERO_COPY.subtext}</p>
          </div>
          <div className="career-dashboard__header-visual" aria-hidden>
            <Illustration slot="home.nextStep" size="hero" />
          </div>
        </div>
      </header>

      {careerJourneyGuide && onJourneyNavigate ? (
        <div className="career-dashboard__next-step">
          <CareerNextStepCard
            guide={careerJourneyGuide}
            onNavigate={onJourneyNavigate}
            variant="strip"
          />
        </div>
      ) : null}

      <div className="career-dashboard__main">
        {onJourneyNavigate ? (
          <RoleMatchSection
            folderId={folderId}
            jobApplications={jobApplications}
            versions={versions}
            strategicProfile={strategicProfile}
            onNavigateCareerBrain={() => onJourneyNavigate("careerBrain")}
          />
        ) : null}
      </div>
    </div>
  )
}
