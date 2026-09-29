"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionEmptyState } from "@/components/application-intelligence/section-empty-state"
import {
  QualificationProfileSummary,
  QualificationWizard,
} from "@/components/qualification-wizard/qualification-wizard"
import { QualificationTabletsPanel } from "@/components/qualification-wizard/qualification-tablets-panel"
import { usePageTitle } from "@/hooks/use-page-title"
import type { IntegrationSectionConfig, IntegrationSectionId } from "@/lib/career-integration-platform"
import {
  hasQualificationProfileContent,
  isQualificationWizardComplete,
  loadQualificationProfile,
} from "@/lib/qualification-profile/storage"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import {
  pageTitleForSection,
  SECTION_EMPTY_STATES,
  SECTION_PAGE_H1,
  type SectionEmptyStateId,
} from "@/lib/workspace-shell-copy"
import { SECTION_ILLUSTRATION_SLOTS } from "@/components/illustrations/section-illustrations"
import type { IllustrationSlot } from "@/lib/illustration-slots"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { usePhraseLibrary } from "@/components/phrase-library/phrase-library-context"
import { PhraseLibraryEmbedded } from "@/components/phrase-library/phrase-library-panel"
import { PhraseAwareTextarea } from "@/components/phrase-library/phrase-aware-field"
import { DocumentTaskChecklist } from "@/components/career-integration/document-task-checklist"
import { SupportDirectoryPage } from "@/components/career-integration/support-directory-page"
import { cn } from "@/lib/utils"
import type { StrategicProfile } from "@/lib/strategic-profile"

type IntegrationSectionPageProps = {
  config: IntegrationSectionConfig
  onBack: () => void
  children?: ReactNode
  qualificationProfile?: QualificationProfile
  onQualificationProfileChange?: (profile: QualificationProfile) => void
  onNavigateCareerBrain?: () => void
  folderId?: string
  onNavigateAiCoach?: () => void
  strategicProfile?: StrategicProfile | null
}

const INTEGRATION_EMPTY_MAP: Record<IntegrationSectionId, SectionEmptyStateId> = {
  recognitionPathways: "recognitionPathways",
  workplaceGerman: "workplaceGerman",
  mentoringSupport: "mentoringSupport",
  bureaucracyNavigator: "bureaucracyNavigator",
  aiJobSearchGuide: "workplaceGerman",
}

const INTEGRATION_ILLUSTRATION_SLOTS: Partial<Record<IntegrationSectionId, IllustrationSlot>> = {
  aiJobSearchGuide: "section.aiJobSearchGuide",
}

export function IntegrationSectionPage({
  config,
  onBack,
  children,
  qualificationProfile: qualificationProfileProp,
  onQualificationProfileChange,
  onNavigateCareerBrain,
  folderId,
  onNavigateAiCoach,
  strategicProfile,
}: IntegrationSectionPageProps) {
  const Icon = config.icon
  const emptyKey = INTEGRATION_EMPTY_MAP[config.id]
  const emptyCopy = SECTION_EMPTY_STATES[emptyKey]
  const pageH1 = SECTION_PAGE_H1[config.id] ?? config.title
  const isRecognition = config.id === "recognitionPathways"
  const isBureaucracyNavigator = config.id === "bureaucracyNavigator"
  const isMentoringSupport = config.id === "mentoringSupport"
  const isPhraseLibrarySection =
    config.id === "workplaceGerman" || config.id === "aiJobSearchGuide"
  const isPhraseLibraryHome = config.id === "workplaceGerman"
  const { openPhraseLibrary } = usePhraseLibrary()

  const [qualificationProfile, setQualificationProfile] = useState<QualificationProfile>(
    () => qualificationProfileProp ?? loadQualificationProfile(),
  )
  const [wizardOpen, setWizardOpen] = useState(false)
  const [practiceText, setPracticeText] = useState("")

  useEffect(() => {
    if (qualificationProfileProp) {
      setQualificationProfile(qualificationProfileProp)
    }
  }, [qualificationProfileProp])

  const openWizard = useCallback(() => {
    setWizardOpen(true)
  }, [])

  const handleProfileChange = useCallback(
    (profile: QualificationProfile) => {
      setQualificationProfile(profile)
      onQualificationProfileChange?.(profile)
    },
    [onQualificationProfileChange],
  )

  usePageTitle(pageTitleForSection(config.id))

  if (isMentoringSupport) {
    return (
      <SupportDirectoryPage
        folderId={folderId ?? "local"}
        onBack={onBack}
        strategicProfile={strategicProfile}
        qualificationProfile={qualificationProfile}
      />
    )
  }

  const showQualificationSummary =
    isRecognition &&
    hasQualificationProfileContent(qualificationProfile) &&
    isQualificationWizardComplete(qualificationProfile)

  if (isRecognition) {
    return (
      <div className="min-h-full bg-background">
        <header className="border-b border-border/60 px-6 py-6 lg:px-8">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)]/10 text-[var(--color-primary-light)]">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{pageH1}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Tap the ideas that sound like you — skills, experience and strengths all count.
              </p>
            </div>
          </div>
        </header>

        <div className="p-6 lg:max-w-3xl lg:p-8">
          <QualificationTabletsPanel
            profile={qualificationProfile}
            onProfileChange={handleProfileChange}
            onOpenWizard={openWizard}
            showFormalSummary={showQualificationSummary}
          />
          {children}
        </div>

        <QualificationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onComplete={handleProfileChange}
          onContinueCareerProfile={onNavigateCareerBrain}
          onSeeRecognitionPathways={() => setWizardOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)]/10 text-[var(--color-primary-light)]">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pageH1}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {config.subtitle}
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-6 p-6 lg:p-8",
          isPhraseLibraryHome ? "max-w-[80rem]" : "lg:max-w-3xl",
        )}
      >
        {config.disclaimer ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            {config.disclaimer}
          </p>
        ) : null}

        {isPhraseLibraryHome ? (
          <PhraseLibraryEmbedded />
        ) : showQualificationSummary ? (
          <QualificationProfileSummary profile={qualificationProfile} onEdit={openWizard} />
        ) : (
          <SectionEmptyState
            heading={emptyCopy.heading}
            body={emptyCopy.body}
            note={emptyCopy.note}
            cta={emptyCopy.cta}
            layout={isBureaucracyNavigator ? "side" : "stacked"}
            illustrationSize={isBureaucracyNavigator ? "large" : undefined}
            className={cn(
              "equit-empty-state--integration",
              isBureaucracyNavigator && "equit-empty-state--integration-compact",
            )}
            slot={
              INTEGRATION_ILLUSTRATION_SLOTS[config.id] ?? SECTION_ILLUSTRATION_SLOTS[emptyKey]
            }
            onCta={
              emptyCopy.cta
                ? isRecognition
                  ? openWizard
                  : isPhraseLibrarySection
                    ? () => openPhraseLibrary()
                    : () => {
                        document
                          .getElementById(
                            isBureaucracyNavigator
                              ? "document-task-checklist"
                              : "integration-checklist",
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                          })
                      }
                : undefined
            }
          />
        )}

        {isPhraseLibrarySection && !isPhraseLibraryHome ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Try it now</CardTitle>
              <CardDescription>
                Click in the box below, browse phrases, and edit anything before you use it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PhraseAwareTextarea
                id="phrase-library-practice"
                label="Practice field"
                value={practiceText}
                onChange={setPracticeText}
                className="min-h-[7rem] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                placeholder="Start typing or browse to find words that sound like you..."
              />
            </CardContent>
          </Card>
        ) : null}

        {isBureaucracyNavigator && folderId ? (
          <DocumentTaskChecklist folderId={folderId} onNavigateAiCoach={onNavigateAiCoach} />
        ) : !isPhraseLibraryHome ? (
          <Card id="integration-checklist" className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Prepare now</CardTitle>
              <CardDescription>
                Use this checklist to get ready — strength-based, at your own pace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {config.checklist.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-light)]"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {config.prepareForAdvisor && config.prepareForAdvisor.length > 0 ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Questions for advisors</CardTitle>
              <CardDescription>
                Bring these to conversations with Jobcenter staff, recognition bodies, or mentors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {config.prepareForAdvisor.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">{config.futureNote}</p>

        {children}
      </div>

      {isRecognition ? (
        <QualificationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onComplete={handleProfileChange}
          onContinueCareerProfile={onNavigateCareerBrain}
          onSeeRecognitionPathways={() => setWizardOpen(false)}
        />
      ) : null}
    </div>
  )
}
