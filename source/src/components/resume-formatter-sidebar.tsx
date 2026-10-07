"use client"

import type { ChangeEvent, ReactNode, RefObject } from "react"
import {
  Upload,
  Copy,
  Check,
  HelpCircle,
  FileText,
  UserCircle,
  Palette,
  Target,
  BookUser,
  Layout,
  Download,
  Pencil,
  Settings,
  BookOpen,
  Building2,
  Link2,
  ImageIcon,
  SeparatorHorizontal,
  ExternalLink,
} from "lucide-react"
import { captureTextareaSelection } from "@/lib/assistant-selection-context"
import {
  applyPortfolioSlotUpdate,
  looksLikeJobAdvertUrl,
  portfolioHref,
  portfolioInputSlots,
  resolveJobAdvertSource,
} from "@/lib/contact-info"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useFormatterWorkspaceOptional } from "@/components/formatter-workspace-context"
import {
  FormatterPopoverShell,
  FormatterSidebarGroup,
  FormatterSidebarRow,
  FormatterPopoverSection,
  FormatterDarkField,
  FormatterDarkInput,
  FormatterDarkTextarea,
  FormatterToggleRow,
  FormatterSwatchPill,
} from "@/components/formatter-popover-shell"
import { ResumeFormattingSyntaxHelp } from "@/components/resume-formatter-syntax-help"
import { FormatterTrustSidebar } from "@/components/trust-compliance-section"
import { CvScorePopoverContent } from "@/components/cv-score-popover"
import type { CvReviewInsights } from "@/lib/cv-review-insights"
import { AiHowItWorksContent } from "@/components/ai-how-it-works-dialog"
import { AiLiteracyGuideContent } from "@/components/ai-literacy-guide-dialog"
import { PrivacyCentreContent } from "@/components/privacy-centre-dialog"
import { ResumeTranslateOverlay } from "@/components/resume-translate-overlay"

export type FormatterTab = "export" | "edit" | "settings" | "help"
export type EditPopoverId =
  | "profile-photo"
  | "contact-info"
  | "target-role"
  | "company-logo"
  | "job-advert"
  | "accent-color"
  | "target-box-style"
  | "resume-content"
export type TrustPopoverId =
  | "trust-transparency"
  | "trust-how-ai"
  | "trust-literacy"
  | "trust-privacy"
export type TabPopoverId = "export" | "cv-score" | "page-breaks"
export type FormatterPopoverId = EditPopoverId | TrustPopoverId | TabPopoverId

export type FormatterContactInfo = {
  email: string
  linkedin: string
  phone: string
  address: string
  citizenship: string
  portfolio: string
  portfolios: string[]
  showPortfolio: boolean
  showLinkedInOnCv?: boolean
  professionalTitle: string
  name: string
  language: "en" | "de"
  targetCompany: string
  targetRole: string
  jobAdvertSource: string
}

type ResumeFormatterSidebarProps = {
  resumeDisplayName: string
  targetRoleDisplay: string
  cvScore: number
  cvReviewInsights: CvReviewInsights
  activeTab: FormatterTab
  activePopover: FormatterPopoverId | null
  onTabClick: (tab: FormatterTab) => void
  onOpenRow: (id: EditPopoverId) => void
  onOpenTrustPopover: (id: TrustPopoverId) => void
  onOpenPageBreaksPopover: () => void
  onOpenScorePopover: () => void
  onClosePopover: () => void
  contactInfo: FormatterContactInfo
  setContactInfo: (info: FormatterContactInfo) => void
  /** Job posting URL from the linked application (fallback when contact field is empty). */
  linkedJobDescriptionUrl?: string | null
  isTranslatingLanguage?: boolean
  translatingToLanguage?: "en" | "de" | null
  languageError?: string | null
  onLanguageChange?: (language: "en" | "de") => void
  profilePhoto: string | null
  profilePhotoBorder: boolean
  setProfilePhotoBorder: (v: boolean) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  logoInputRef: RefObject<HTMLInputElement | null>
  onImageUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  onRemoveLogo: () => void
  accentColor: string
  setAccentColor: (v: string) => void
  currentHexValue: string
  handleHexInput: (hex: string) => void
  presetColors: { name: string; oklch: string; hex: string }[]
  targetBoxBgColor: string
  setTargetBoxBgColor: (v: string) => void
  targetBoxBorderColor: string
  setTargetBoxBorderColor: (v: string) => void
  companyLogo: string | null
  resumeText: string
  handleResumeTextChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  handleResumeTextKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  resumeHighlightRef: RefObject<HTMLPreElement | null>
  renderHighlightedResumeText: (text: string) => ReactNode
  formattingPrompt: string
  copied: boolean
  onCopyPrompt: () => void
  bgSwatches: { name: string; hex: string }[]
  borderSwatches: { name: string; hex: string }[]
}

export function ResumeFormatterSidebar(props: ResumeFormatterSidebarProps) {
  const {
    resumeDisplayName,
    targetRoleDisplay,
    cvScore,
    cvReviewInsights,
    activeTab,
    activePopover,
    onTabClick,
    onOpenRow,
    onOpenTrustPopover,
    onOpenPageBreaksPopover,
    onOpenScorePopover,
    onClosePopover,
    contactInfo,
    setContactInfo,
    linkedJobDescriptionUrl = null,
    isTranslatingLanguage = false,
    translatingToLanguage = null,
    languageError = null,
    onLanguageChange,
    profilePhoto,
    profilePhotoBorder,
    setProfilePhotoBorder,
    fileInputRef,
    logoInputRef,
    onImageUpload,
    onLogoUpload,
    onRemoveImage,
    onRemoveLogo,
    accentColor,
    setAccentColor,
    currentHexValue,
    handleHexInput,
    presetColors,
    targetBoxBgColor,
    setTargetBoxBgColor,
    targetBoxBorderColor,
    setTargetBoxBorderColor,
    companyLogo,
    resumeText,
    handleResumeTextChange,
    handleResumeTextKeyDown,
    resumeHighlightRef,
    renderHighlightedResumeText,
    formattingPrompt,
    copied,
    onCopyPrompt,
    bgSwatches,
    borderSwatches,
  } = props

  const workspace = useFormatterWorkspaceOptional()

  const jobAdvertValue = resolveJobAdvertSource(
    contactInfo.jobAdvertSource,
    linkedJobDescriptionUrl,
  )
  const jobAdvertIsUrl = looksLikeJobAdvertUrl(jobAdvertValue)
  const jobAdvertHref = jobAdvertIsUrl ? portfolioHref(jobAdvertValue) : ""
  const jobAdvertSubtitle = jobAdvertValue
    ? jobAdvertValue.replace(/^https?:\/\//i, "").slice(0, 42) +
      (jobAdvertValue.replace(/^https?:\/\//i, "").length > 42 ? "…" : "")
    : "LinkedIn, Indeed, etc."

  const activeTrustPopover =
    activePopover === "trust-transparency" ||
    activePopover === "trust-how-ai" ||
    activePopover === "trust-literacy" ||
    activePopover === "trust-privacy"
      ? activePopover
      : null

  const openRow = (id: EditPopoverId) => {
    onOpenRow(id)
  }

  const tabs: { id: FormatterTab; label: string; icon: typeof Download }[] = [
    { id: "export", label: "Export", icon: Download },
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "help", label: "Help", icon: HelpCircle },
  ]

  return (
    <aside className="formatter-sidebar" id="resume-input">
      <div className="formatter-sidebar__header">
        <p className="formatter-sidebar__name">{resumeDisplayName || "Untitled resume"}</p>
        {targetRoleDisplay ? (
          <p className="formatter-sidebar__role">{targetRoleDisplay}</p>
        ) : null}
      </div>

      <div className="formatter-sidebar__tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={cn("formatter-sidebar-tab", activeTab === id && "formatter-sidebar-tab--active")}
            onClick={() => onTabClick(id)}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="formatter-sidebar__meta">
        <div className="formatter-sidebar-lang">
          <p className="formatter-sidebar-lang__label">Resume language</p>
          <div
            className="formatter-lang-toggle"
            role="group"
            aria-label="Resume language"
            aria-busy={isTranslatingLanguage}
          >
            <button
              type="button"
              className={cn(
                "formatter-lang-toggle__btn",
                (contactInfo.language === "en" || translatingToLanguage === "en") &&
                  "formatter-lang-toggle__btn--active",
              )}
              onClick={() => {
                if (onLanguageChange) onLanguageChange("en")
                else setContactInfo({ ...contactInfo, language: "en" })
              }}
              aria-pressed={contactInfo.language === "en"}
              disabled={isTranslatingLanguage}
            >
              English
            </button>
            <button
              type="button"
              className={cn(
                "formatter-lang-toggle__btn",
                (contactInfo.language === "de" || translatingToLanguage === "de") &&
                  "formatter-lang-toggle__btn--active",
              )}
              onClick={() => {
                if (onLanguageChange) onLanguageChange("de")
                else setContactInfo({ ...contactInfo, language: "de" })
              }}
              aria-pressed={contactInfo.language === "de"}
              disabled={isTranslatingLanguage}
            >
              Deutsch
            </button>
          </div>
          {languageError ? (
            <p className="formatter-sidebar-lang__error" role="alert">
              {languageError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="formatter-score-badge"
          aria-label={`CV score ${cvScore}. Click for details.`}
          onClick={onOpenScorePopover}
        >
          {cvScore}
        </button>
      </div>

      {activeTab === "edit" ? (
        <div className="formatter-sidebar__scroll">
          <FormatterSidebarGroup label="Profile">
            <FormatterSidebarRow
              icon={UserCircle}
              title="Profile photo"
              subtitle="Upload · outline toggle"
              active={activePopover === "profile-photo"}
              onClick={() => openRow("profile-photo")}
            />
            <FormatterSidebarRow
              icon={BookUser}
              title="Contact information"
              subtitle="Name, headline, email, links"
              active={activePopover === "contact-info"}
              onClick={() => openRow("contact-info")}
            />
          </FormatterSidebarGroup>

          <FormatterSidebarGroup label="Job target">
            <FormatterSidebarRow
              icon={Target}
              title="Target company & role"
              subtitle="Shown at top of resume"
              active={activePopover === "target-role"}
              onClick={() => openRow("target-role")}
            />
            <FormatterSidebarRow
              icon={ImageIcon}
              title="Company logo"
              subtitle="Optional upload"
              active={activePopover === "company-logo"}
              onClick={() => openRow("company-logo")}
            />
            <FormatterSidebarRow
              icon={Link2}
              title="Job advert source"
              subtitle={jobAdvertSubtitle}
              active={activePopover === "job-advert"}
              onClick={() => openRow("job-advert")}
            />
          </FormatterSidebarGroup>

          <FormatterSidebarGroup label="Appearance">
            <FormatterSidebarRow
              icon={Palette}
              title="Accent colour"
              subtitle="Headings and section lines"
              active={activePopover === "accent-color"}
              onClick={() => openRow("accent-color")}
            />
            <FormatterSidebarRow
              icon={Layout}
              title="Target box style"
              subtitle="Background & border colour"
              active={activePopover === "target-box-style"}
              onClick={() => openRow("target-box-style")}
            />
          </FormatterSidebarGroup>

          <FormatterSidebarGroup label="Content">
            <FormatterSidebarRow
              icon={FileText}
              title="Resume content"
              subtitle="Profile, experience, education"
              active={activePopover === "resume-content"}
              onClick={() => openRow("resume-content")}
            />
          </FormatterSidebarGroup>
        </div>
      ) : activeTab === "export" ? (
        <div className="formatter-sidebar__scroll formatter-sidebar__scroll--hint">
          <p className="formatter-sidebar__tab-hint">
            Export options open in the panel over your preview.
          </p>
        </div>
      ) : activeTab === "settings" ? (
        <div className="formatter-sidebar__scroll formatter-sidebar__panel">
          {workspace?.settingsPanel}
          <div className="formatter-sidebar-rows formatter-sidebar-rows--bleed">
            <FormatterSidebarRow
              icon={SeparatorHorizontal}
              title={contactInfo.language === "de" ? "Seitenumbrüche" : "Page breaks"}
              subtitle={
                contactInfo.language === "de"
                  ? "A4-Seiten und Überlauf"
                  : "A4 pages and overflow"
              }
              active={activePopover === "page-breaks"}
              onClick={onOpenPageBreaksPopover}
            />
          </div>
          {workspace?.settingsVersionsPanel}
          <FormatterTrustSidebar
            activeTrustPopover={activeTrustPopover}
            onOpenTrustPopover={onOpenTrustPopover}
          />
        </div>
      ) : activeTab === "help" ? (
        <div className="formatter-sidebar__scroll formatter-sidebar__panel">
          <FormatterPopoverSection label="Formatting tips">
            <ResumeFormattingSyntaxHelp language={contactInfo.language === "de" ? "de" : "en"} />
          </FormatterPopoverSection>
          <FormatterPopoverSection label="Syntax helper">
            <p className="formatter-popover-hint">
              Copy this prompt and paste it into ChatGPT or similar AI tools.
            </p>
            <button type="button" className="formatter-popover-btn" onClick={onCopyPrompt}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy prompt
                </>
              )}
            </button>
            <pre className="formatter-prompt-pre">{formattingPrompt}</pre>
          </FormatterPopoverSection>
        </div>
      ) : null}

      {workspace?.showYourStoryCta && workspace.onOpenYourStory ? (
        <div className="formatter-sidebar__footer formatter-sidebar__footer--stacked">
          <button
            type="button"
            className="formatter-sidebar-cta formatter-sidebar-cta--secondary"
            onClick={workspace.onOpenYourStory}
          >
            <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span>{workspace.hasYourStory ? "My Career Story" : "Build career story"}</span>
          </button>
          {workspace.showCoverLetterCta && workspace.onOpenCoverLetter ? (
            <button
              type="button"
              className="formatter-sidebar-cta"
              onClick={workspace.onOpenCoverLetter}
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <span>
                {workspace.hasSavedCoverLetter ? "Cover letter" : "Cover letter wizard"}
              </span>
            </button>
          ) : null}
        </div>
      ) : workspace?.showCoverLetterCta && workspace.onOpenCoverLetter ? (
        <div className="formatter-sidebar__footer">
          <button
            type="button"
            className="formatter-sidebar-cta"
            onClick={workspace.onOpenCoverLetter}
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span>
              {workspace.hasSavedCoverLetter ? "Cover letter" : "Cover letter wizard"}
            </span>
          </button>
        </div>
      ) : null}

      <FormatterPopoverShell open={activePopover === "export"} onClose={onClosePopover} title="Export">
        {workspace?.exportPanel}
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "cv-score"}
        onClose={onClosePopover}
        title="CV score"
        className="formatter-popover--wide"
      >
        <CvScorePopoverContent insights={cvReviewInsights} />
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "page-breaks"}
        onClose={onClosePopover}
        title={contactInfo.language === "de" ? "Seitenumbrüche" : "Page breaks"}
        className="formatter-popover--wide"
      >
        {workspace?.pageBreaksPanel}
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "trust-transparency"}
        onClose={onClosePopover}
        title="AI transparency"
        className="formatter-popover--wide"
      >
        {workspace?.trustTransparencyPanel}
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "trust-how-ai"}
        onClose={onClosePopover}
        title="How AI is used"
        className="formatter-popover--wide"
      >
        <AiHowItWorksContent />
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "trust-literacy"}
        onClose={onClosePopover}
        title="AI literacy guide"
        className="formatter-popover--wide"
      >
        <AiLiteracyGuideContent />
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "trust-privacy"}
        onClose={onClosePopover}
        title="Privacy centre"
        className="formatter-popover--wide formatter-popover--privacy"
      >
        <PrivacyCentreContent
          embedded
          folderId={workspace?.trustFolderId}
          onDataDeleted={workspace?.onTrustDataDeleted}
          onOpenAiHowItWorks={() => onOpenTrustPopover("trust-how-ai")}
          onDismiss={onClosePopover}
        />
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "profile-photo"}
        onClose={onClosePopover}
        title="Profile photo"
      >
        <div className="formatter-upload-block">
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="formatter-upload-preview formatter-upload-preview--round" />
          ) : (
            <div className="formatter-upload-placeholder formatter-upload-preview--round">
              <Upload className="h-5 w-5" aria-hidden />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageUpload}
          />
          <button
            type="button"
            className="formatter-popover-btn formatter-popover-btn--full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Upload photo
          </button>
          {profilePhoto ? (
            <button type="button" className="formatter-popover-btn formatter-popover-btn--ghost" onClick={onRemoveImage}>
              Remove photo
            </button>
          ) : null}
        </div>
        <FormatterToggleRow
          label="Show photo outline on resume"
          checked={profilePhotoBorder}
          onChange={setProfilePhotoBorder}
        />
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "contact-info"}
        onClose={onClosePopover}
        title="Contact information"
      >
        <FormatterPopoverSection label="Identity">
          <FormatterDarkField label="Full name">
            <FormatterDarkInput
              value={contactInfo.name}
              onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
            />
          </FormatterDarkField>
          <FormatterDarkField label="Professional headline">
            <FormatterDarkInput
              value={contactInfo.professionalTitle}
              onChange={(e) =>
                setContactInfo({ ...contactInfo, professionalTitle: e.target.value })
              }
            />
          </FormatterDarkField>
          <FormatterDarkField label="Email">
            <FormatterDarkInput
              type="email"
              value={contactInfo.email}
              onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
            />
          </FormatterDarkField>
          <FormatterDarkField label="Phone">
            <FormatterDarkInput
              value={contactInfo.phone}
              onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
            />
          </FormatterDarkField>
          <FormatterDarkField label="Location">
            <FormatterDarkInput
              value={contactInfo.address}
              onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
            />
          </FormatterDarkField>
          <FormatterDarkField label="Citizenship">
            <FormatterDarkInput
              value={contactInfo.citizenship}
              onChange={(e) => setContactInfo({ ...contactInfo, citizenship: e.target.value })}
            />
          </FormatterDarkField>
          <FormatterDarkField label="LinkedIn">
            <FormatterDarkInput
              value={contactInfo.linkedin}
              onChange={(e) => {
                const linkedin = e.target.value
                setContactInfo({
                  ...contactInfo,
                  linkedin,
                  // Keep preference; empty URL disables the switch in UI
                  showLinkedInOnCv: contactInfo.showLinkedInOnCv !== false,
                })
              }}
            />
          </FormatterDarkField>
          <FormatterToggleRow
            label={contactInfo.language === "de" ? "Im Lebenslauf anzeigen" : "Show on CV"}
            checked={contactInfo.showLinkedInOnCv !== false}
            disabled={!contactInfo.linkedin.trim()}
            onChange={(checked) =>
              setContactInfo({ ...contactInfo, showLinkedInOnCv: checked })
            }
          />
        </FormatterPopoverSection>
        <FormatterPopoverSection label="Portfolio & websites">
          <p className="formatter-popover-hint">Up to 3 websites shown on your resume</p>
          {portfolioInputSlots(contactInfo.portfolios, contactInfo.portfolio).map((url, index) => (
            <FormatterDarkField key={`portfolio-${index}`} label={`Website ${index + 1}`}>
              <FormatterDarkInput
                value={url}
                onChange={(e) =>
                  setContactInfo(applyPortfolioSlotUpdate(contactInfo, index, e.target.value))
                }
              />
            </FormatterDarkField>
          ))}
          <FormatterToggleRow
            label="Show portfolio on resume"
            checked={contactInfo.showPortfolio === true}
            onChange={(checked) => setContactInfo({ ...contactInfo, showPortfolio: checked })}
          />
        </FormatterPopoverSection>
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "target-role"}
        onClose={onClosePopover}
        title="Target company & role"
      >
        <FormatterDarkField label="Company name">
          <FormatterDarkInput
            value={contactInfo.targetCompany}
            onChange={(e) => setContactInfo({ ...contactInfo, targetCompany: e.target.value })}
          />
        </FormatterDarkField>
        <FormatterDarkField label="Role title">
          <FormatterDarkTextarea
            rows={2}
            value={contactInfo.targetRole}
            onChange={(e) => setContactInfo({ ...contactInfo, targetRole: e.target.value })}
          />
        </FormatterDarkField>
        <FormatterPopoverSection label="Background colour">
          <div className="formatter-swatch-grid">
            {bgSwatches.map((color) => (
              <FormatterSwatchPill
                key={color.name}
                name={color.name}
                hex={color.hex}
                selected={targetBoxBgColor === color.hex}
                onClick={() => setTargetBoxBgColor(color.hex)}
              />
            ))}
          </div>
        </FormatterPopoverSection>
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "company-logo"}
        onClose={onClosePopover}
        title="Company logo"
      >
        <div className="formatter-upload-block">
          {companyLogo ? (
            <img src={companyLogo} alt="Company logo" className="formatter-upload-preview" />
          ) : (
            <div className="formatter-upload-placeholder">
              <Building2 className="h-5 w-5" aria-hidden />
            </div>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onLogoUpload}
          />
          <button
            type="button"
            className="formatter-popover-btn formatter-popover-btn--full"
            onClick={() => logoInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Upload logo
          </button>
          {companyLogo ? (
            <button type="button" className="formatter-popover-btn formatter-popover-btn--ghost" onClick={onRemoveLogo}>
              Remove logo
            </button>
          ) : null}
        </div>
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "job-advert"}
        onClose={onClosePopover}
        title="Job advert source"
      >
        <FormatterDarkField
          label="Job posting URL"
          hint="Paste the LinkedIn, Indeed, or company careers link"
        >
          <FormatterDarkInput
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={jobAdvertValue}
            onChange={(e) =>
              setContactInfo({ ...contactInfo, jobAdvertSource: e.target.value })
            }
          />
        </FormatterDarkField>
        {jobAdvertIsUrl ? (
          <a
            href={jobAdvertHref}
            target="_blank"
            rel="noopener noreferrer"
            className="formatter-popover-btn formatter-popover-btn--full"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open job posting
          </a>
        ) : null}
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "accent-color"}
        onClose={onClosePopover}
        title="Accent colour"
      >
        <div className="formatter-swatch-grid">
          {presetColors.map((color) => (
            <FormatterSwatchPill
              key={color.name}
              name={color.name}
              hex={color.hex}
              selected={currentHexValue === color.hex}
              onClick={() => {
                setAccentColor(color.oklch)
                handleHexInput(color.hex)
              }}
            />
          ))}
        </div>
        <FormatterDarkField label="Custom HEX">
          <FormatterDarkInput value={currentHexValue} onChange={(e) => handleHexInput(e.target.value)} maxLength={7} />
        </FormatterDarkField>
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "target-box-style"}
        onClose={onClosePopover}
        title="Target box style"
      >
        <FormatterPopoverSection label="Background colour">
          <div className="formatter-swatch-grid">
            {bgSwatches.map((color) => (
              <FormatterSwatchPill
                key={color.name}
                name={color.name}
                hex={color.hex}
                selected={targetBoxBgColor === color.hex}
                onClick={() => setTargetBoxBgColor(color.hex)}
              />
            ))}
          </div>
        </FormatterPopoverSection>
        <FormatterPopoverSection label="Border colour">
          <div className="formatter-swatch-grid">
            {borderSwatches.map((color) => (
              <FormatterSwatchPill
                key={color.name}
                name={color.name}
                hex={color.hex || currentHexValue}
                selected={targetBoxBorderColor === color.hex}
                onClick={() => setTargetBoxBorderColor(color.hex)}
              />
            ))}
          </div>
        </FormatterPopoverSection>
      </FormatterPopoverShell>

      <FormatterPopoverShell
        open={activePopover === "resume-content"}
        onClose={onClosePopover}
        title="Resume content"
        className="formatter-popover--wide"
      >
        <div className="formatter-resume-editor">
          <pre
            ref={resumeHighlightRef}
            aria-hidden="true"
            className="formatter-resume-editor__highlight"
          >
            {renderHighlightedResumeText(resumeText)}
          </pre>
          <Textarea
            aria-label="Editing Resume Content"
            value={resumeText}
            onChange={handleResumeTextChange}
            onKeyDown={handleResumeTextKeyDown}
            onMouseUp={(e) => captureTextareaSelection("resume", e.currentTarget)}
            onKeyUp={(e) => captureTextareaSelection("resume", e.currentTarget)}
            onScroll={(e) => {
              if (resumeHighlightRef.current) {
                resumeHighlightRef.current.scrollTop = e.currentTarget.scrollTop
                resumeHighlightRef.current.scrollLeft = e.currentTarget.scrollLeft
              }
            }}
            className="formatter-resume-editor__textarea"
            spellCheck={false}
          />
        </div>
        <p className="formatter-popover-hint">
          Use # for titles, ## for companies, ### for dates, - for bullets, and [Label](url) for links.
        </p>
      </FormatterPopoverShell>
      <ResumeTranslateOverlay
        open={isTranslatingLanguage}
        targetLanguage={translatingToLanguage}
      />
    </aside>
  )
}
