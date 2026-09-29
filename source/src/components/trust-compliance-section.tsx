"use client"

import { useState } from "react"
import { AiHowItWorksDialog } from "@/components/ai-how-it-works-dialog"
import { AiLiteracyGuideDialog } from "@/components/ai-literacy-guide-dialog"
import { AiTransparencyPanel } from "@/components/ai-transparency-panel"
import { CvReviewAiActivityPanel } from "@/components/cv-review-ai-activity-panel"
import { WorkspaceAiOversightPanel } from "@/components/workspace-ai-oversight-panel"
import { PrivacyCentreDialog } from "@/components/privacy-centre-dialog"
import { TrustComplianceToolbar } from "@/components/trust-compliance-toolbar"
import {
  FormatterSidebarGroup,
  FormatterSidebarRow,
} from "@/components/formatter-popover-shell"
import { useFormatterWorkspaceOptional } from "@/components/formatter-workspace-context"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Info,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export function SettingsTrustCard({
  onDataDeleted,
  folderId,
}: {
  onDataDeleted?: () => void
  folderId?: string | null
}) {
  const [showAiHowDialog, setShowAiHowDialog] = useState(false)
  const [showAiLiteracyGuide, setShowAiLiteracyGuide] = useState(false)
  const [showPrivacyCentre, setShowPrivacyCentre] = useState(false)

  const scrollToTransparency = () => {
    document.getElementById("settings-ai-transparency")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const trustButtons = [
    { icon: Sparkles, label: "AI Transparency", onClick: scrollToTransparency },
    { icon: Info, label: "How AI is used", onClick: () => setShowAiHowDialog(true) },
    { icon: BookOpen, label: "AI Literacy", onClick: () => setShowAiLiteracyGuide(true) },
    { icon: Lock, label: "Privacy", onClick: () => setShowPrivacyCentre(true) },
  ]

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Your data, your control</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            We use your information only to personalise your career support. You can edit or delete
            anything at any time. We will never share your data with employers or third parties
            without your explicit consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {trustButtons.map(({ icon: Icon, label, onClick }) => (
            <Button key={label} type="button" variant="outline" size="sm" onClick={onClick}>
              <Icon className="mr-2 h-4 w-4" aria-hidden />
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div id="settings-ai-transparency" className="sr-only" aria-hidden />

      <AiHowItWorksDialog open={showAiHowDialog} onOpenChange={setShowAiHowDialog} />
      <AiLiteracyGuideDialog open={showAiLiteracyGuide} onOpenChange={setShowAiLiteracyGuide} />
      <PrivacyCentreDialog
        open={showPrivacyCentre}
        onOpenChange={setShowPrivacyCentre}
        folderId={folderId}
        onOpenAiHowItWorks={() => {
          setShowPrivacyCentre(false)
          setShowAiHowDialog(true)
        }}
        onDataDeleted={onDataDeleted}
      />
    </>
  )
}

export function TrustComplianceSection({
  resume,
  allResumes = [],
  folderId,
  onRestoreSnapshot,
  onDataDeleted,
  defaultExpanded = false,
  variant = "default",
}: {
  resume: ResumeVersion | null
  allResumes?: ResumeVersion[]
  folderId?: string | null
  onRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
  onDataDeleted?: () => void
  /** When false (default), section shows a single disclosure row until expanded. */
  defaultExpanded?: boolean
  /** Card style for formatter centre column; settings = right drawer rows */
  variant?: "default" | "card" | "settings"
}) {
  const [showAiHowDialog, setShowAiHowDialog] = useState(false)
  const [showAiLiteracyGuide, setShowAiLiteracyGuide] = useState(false)
  const [showPrivacyCentre, setShowPrivacyCentre] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const scrollToTransparency = () => {
    document.getElementById("ai-transparency-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const collapsedChips = [
    { icon: Sparkles, label: "AI Transparency" },
    { icon: Info, label: "How AI is used" },
    { icon: BookOpen, label: "AI Literacy" },
    { icon: Lock, label: "Privacy" },
  ]

  const wrapperClass =
    variant === "card"
      ? "ui-formatter-control-card space-y-3"
      : "space-y-3"

  const trustDialogs = (
    <>
      <AiHowItWorksDialog open={showAiHowDialog} onOpenChange={setShowAiHowDialog} />
      <AiLiteracyGuideDialog open={showAiLiteracyGuide} onOpenChange={setShowAiLiteracyGuide} />
      <PrivacyCentreDialog
        open={showPrivacyCentre}
        onOpenChange={setShowPrivacyCentre}
        folderId={folderId}
        onOpenAiHowItWorks={() => {
          setShowPrivacyCentre(false)
          setShowAiHowDialog(true)
        }}
        onDataDeleted={onDataDeleted}
      />
    </>
  )

  if (variant === "settings") {
    const trustItems = [
      { icon: Sparkles, label: "AI transparency", onClick: scrollToTransparency },
      { icon: Info, label: "How AI is used", onClick: () => setShowAiHowDialog(true) },
      { icon: BookOpen, label: "AI literacy guide", onClick: () => setShowAiLiteracyGuide(true) },
      { icon: Lock, label: "Privacy centre", onClick: () => setShowPrivacyCentre(true) },
    ]

    return (
      <div className="space-y-3">
        <p className="settings-section-lbl">Trust &amp; privacy</p>
        <div className="trust-list">
          {trustItems.map(({ icon: Icon, label, onClick }) => (
            <button key={label} type="button" className="trust-item" onClick={onClick}>
              <Icon aria-hidden />
              <span>{label}</span>
              <ChevronRight className="trust-arrow" aria-hidden />
            </button>
          ))}
        </div>
        {trustDialogs}
      </div>
    )
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={wrapperClass}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full min-h-[44px] items-center justify-between gap-2 text-left",
              variant === "default" && "ui-trust-disclosure",
            )}
            aria-expanded={expanded}
            aria-controls="trust-compliance-content"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-[15px] w-[15px] shrink-0 text-[var(--brand-teal)]" aria-hidden />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Trust &amp; privacy</span>
            </span>
            <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] shrink-0">
              Details
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            </span>
          </button>
        </CollapsibleTrigger>

        {!expanded ? (
          <div className="flex flex-wrap gap-2">
            {collapsedChips.map(({ icon: Icon, label }) => (
              <span key={label} className="ui-trust-chip">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ) : null}

        <CollapsibleContent id="trust-compliance-content" className="space-y-4">
          <TrustComplianceToolbar
            onScrollToTransparency={scrollToTransparency}
            onOpenHowAiWorks={() => setShowAiHowDialog(true)}
            onOpenAiLiteracyGuide={() => setShowAiLiteracyGuide(true)}
            onOpenPrivacyCentre={() => setShowPrivacyCentre(true)}
          />
          {!resume && folderId ? (
            <WorkspaceAiOversightPanel
              folderId={folderId}
              allResumes={allResumes}
              onLearnMore={() => setShowAiLiteracyGuide(true)}
              onOpenHowAiWorks={() => setShowAiHowDialog(true)}
            />
          ) : (
            <>
              <AiTransparencyPanel
                resume={resume}
                allResumes={allResumes}
                folderId={folderId}
                onOpenHowAiWorks={() => setShowAiHowDialog(true)}
                onOpenPrivacyCentre={() => setShowPrivacyCentre(true)}
                onRestoreSnapshot={onRestoreSnapshot}
              />
              <CvReviewAiActivityPanel
                resume={resume}
                onReviewChanges={scrollToTransparency}
                onLearnMore={() => setShowAiLiteracyGuide(true)}
              />
            </>
          )}
        </CollapsibleContent>
      </div>

      {trustDialogs}
    </Collapsible>
  )
}

export type FormatterTrustPopoverId =
  | "trust-transparency"
  | "trust-how-ai"
  | "trust-literacy"
  | "trust-privacy"

function useFormatterTrustNavigation() {
  const workspace = useFormatterWorkspaceOptional()
  const open = (id: FormatterTrustPopoverId) => workspace?.openPopoverRef.current?.(id)
  return {
    openTransparency: () => open("trust-transparency"),
    openHowAi: () => open("trust-how-ai"),
    openLiteracy: () => open("trust-literacy"),
    openPrivacy: () => open("trust-privacy"),
  }
}

export function FormatterTrustSidebar({
  activeTrustPopover,
  onOpenTrustPopover,
}: {
  activeTrustPopover: FormatterTrustPopoverId | null
  onOpenTrustPopover: (id: FormatterTrustPopoverId) => void
}) {
  const trustItems: {
    icon: typeof Sparkles
    title: string
    subtitle: string
    id: FormatterTrustPopoverId
  }[] = [
    {
      icon: Sparkles,
      title: "AI transparency",
      subtitle: "Provenance, audit log, snapshots",
      id: "trust-transparency",
    },
    {
      icon: Info,
      title: "How AI is used",
      subtitle: "What the tool does with your data",
      id: "trust-how-ai",
    },
    {
      icon: BookOpen,
      title: "AI literacy guide",
      subtitle: "Working effectively with AI",
      id: "trust-literacy",
    },
    {
      icon: Lock,
      title: "Privacy centre",
      subtitle: "Export, delete, and your rights",
      id: "trust-privacy",
    },
  ]

  return (
    <FormatterSidebarGroup label="Trust & privacy">
      {trustItems.map(({ icon, title, subtitle, id }) => (
        <FormatterSidebarRow
          key={id}
          icon={icon}
          title={title}
          subtitle={subtitle}
          active={activeTrustPopover === id}
          onClick={() => onOpenTrustPopover(id)}
        />
      ))}
    </FormatterSidebarGroup>
  )
}

export function TrustTransparencyPopoverContent({
  resume,
  allResumes = [],
  folderId,
  onRestoreSnapshot,
  onOpenLiteracy,
}: {
  resume: ResumeVersion | null
  allResumes?: ResumeVersion[]
  folderId?: string | null
  onRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
  onOpenLiteracy?: () => void
}) {
  const { openHowAi, openLiteracy, openPrivacy } = useFormatterTrustNavigation()
  const openLiteracyGuide = onOpenLiteracy ?? openLiteracy

  if (!resume && folderId) {
    return (
      <WorkspaceAiOversightPanel
        folderId={folderId}
        allResumes={allResumes}
        onLearnMore={openLiteracyGuide}
        onOpenHowAiWorks={openHowAi}
      />
    )
  }

  return (
    <>
      <AiTransparencyPanel
        resume={resume}
        allResumes={allResumes}
        folderId={folderId}
        onOpenHowAiWorks={openHowAi}
        onOpenPrivacyCentre={openPrivacy}
        onRestoreSnapshot={onRestoreSnapshot}
      />
      <CvReviewAiActivityPanel
        resume={resume}
        onReviewChanges={() => {}}
        onLearnMore={openLiteracyGuide}
      />
    </>
  )
}
