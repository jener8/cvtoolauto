"use client"
import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useId,
  type ReactNode,
} from "react"
import { Button } from "@mui/material"
import {
  formatPortfolioUrlForDisplay,
  normalizeContactInfo,
  portfolioLinksJoinedHtml,
  type ResumeContactInfo,
  visiblePortfolioUrls,
} from "@/lib/contact-info"
import type { ResumeVersion } from "@/lib/types"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from "docx"
import { toast } from "@/components/ui/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FormatterWorkspaceProvider } from "@/components/formatter-workspace-context"
import {
  FormatterExportPanel,
  FormatterPageBreaksContent,
  FormatterSettingsPanel,
  FormatterVersionsPanel,
} from "@/components/formatter-export-panel"
import { TrustTransparencyPopoverContent } from "@/components/trust-compliance-section"
import {
  Loader2,
  Download,
  FileText,
  Briefcase,
  ChevronDown,
  Info,
  Minus,
  Plus,
  PanelLeft,
  Settings,
  X,
} from "lucide-react"
import { buildCvReviewInsights } from "@/lib/cv-review-insights"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  escapeHtmlText,
  formattedTextToHtml,
  formattedTextToPlain,
  resumeInlineTextToPlain,
} from "@/lib/resume-inline-links"
import { renderHtmlWithColumnBlocks } from "@/lib/resume-column-block"
import { parseResumeMarkupLine } from "@/lib/resume-markup-line"
import {
  CV_TWO_COLUMN_LIST_CSS,
  parseTwoColumnSectionItems,
  renderCVColumnBlocksHtml,
  renderCVColumnListHtml,
  renderCVColumnListItemHtml,
  resolveSectionColumnCount,
  sectionHasStructuredEntries,
  splitSectionIntoEntryBlocks,
  type ColumnListBulletStyle,
} from "@/lib/cv-two-column-section"
import {
  buildMarkdownTablePdfChunks,
  CV_MARKDOWN_TABLE_CSS,
  renderHtmlWithMarkdownTables,
  renderMarkdownTableHtml,
  renderMarkdownTableHtmlFull,
  splitLinesByMarkdownTables,
  type ParsedMarkdownTable,
} from "@/lib/resume-markdown-table"
import type { ParsedResumeSection } from "@/lib/parse-resume-text"
import {
  isManualPageBreakLine,
  MANUAL_PAGE_BREAK_MARKER,
  resumeContainsManualPageBreak,
} from "@/lib/resume-page-breaks"
import {
  autoPaginateResumeInnerHtml,
  isPdfBulletLine,
  PDF_MANUAL_PAGE_BREAK_PREFERENCE_HTML,
  pdfPageLabelHtml,
  splitContentIntoSegments,
  splitEntryLinesIntoPdfChunks,
  splitExperienceLinesIntoJobs,
} from "@/lib/pdf-auto-pagination"
import { isPdfDebugEnabled } from "@/lib/pdf-debug"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { formatEmploymentDateWithDuration } from "@/lib/employment-duration"
import {
  buildEmployerGroupRoleBlocks,
  formatEmployerDisplayName,
  hasEmployerHeading,
  isMultiRoleEmployerGroup,
  orderExperienceRoleDisplayLines,
  organizeExperienceLines,
  overallEmploymentDateLabel,
  type ExperienceEmployerGroup,
} from "@/lib/experience-organization"
import {
  formatParallelWorkAtsSuffix,
  renderParallelWorkBadgeHtml,
  resolveExperienceWorkType,
} from "@/lib/experience-work-modifier"
import {
  isCareerEvolutionSectionTitle,
  placeCareerEvolutionInSections,
  renderCareerEvolutionSvgHtml,
  resolveCareerEvolutionConfig,
  shouldRenderCareerEvolutionInPdf,
  stripCareerEvolutionFromHtml,
} from "@/lib/career-evolution"
import { parseResumeText } from "@/lib/parse-resume-text"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"
import { ExportMetadataPreviewPanel } from "@/components/export-metadata-preview-panel"
import {
  AI_TOOL_NAME,
  appendExportTransparencyToHtml,
  buildExportMetadataComments,
  DEFAULT_CV_FORMAT_STYLE,
  getTransparencyStatementBodyParagraphs,
  getTransparencyStatementVisibility,
  normalizeCvFormatStyle,
  resolveExportProvenance,
  TRANSPARENCY_STATEMENT_COPY,
  type CvFormatStyle,
} from "@/lib/ai-transparency"
import { PdfExportControls } from "@/components/pdf-export-controls"
import { optimizeDomForPdfExport } from "@/lib/pdf-export-optimize"
import {
  DEFAULT_PDF_EXPORT_PRESET,
  PDF_EXPORT_PRESETS,
  isSavedResumeId,
  type PdfExportPreset,
} from "@/lib/pdf-export-presets"
import { estimatePdfSizeBytes } from "@/lib/pdf-size-estimate"
import { cn } from "@/lib/utils"

type PdfViewParts = { columnStyle: string; markedInner: string }

const A4_PREVIEW_WIDTH_PX = 794
const A4_PREVIEW_HEIGHT_PX = 1123

function measurePreviewContentHeight(inner: HTMLElement): number {
  const pages = inner.querySelectorAll<HTMLElement>(".pdf-page")
  if (pages.length > 0) {
    let total = 0
    pages.forEach((page, index) => {
      // Prefer scrollHeight so overflow past a fixed 297mm box (tall job
      // blocks, wrapping bullets) still expands the scaled paper wrapper.
      // offsetHeight alone under-counts and clips content in the preview.
      const pageHeight = Math.max(page.offsetHeight, page.scrollHeight)
      total += pageHeight
      if (index > 0) {
        const marginTop = Number.parseFloat(getComputedStyle(page).marginTop)
        if (Number.isFinite(marginTop)) total += marginTop
      }
    })
    return Math.max(Math.ceil(total), A4_PREVIEW_HEIGHT_PX)
  }
  return Math.max(inner.scrollHeight, inner.offsetHeight, A4_PREVIEW_HEIGHT_PX)
}

/**
 * One semantic <h2> for company + role so ATS / copy / PDF text extraction
 * read a continuous line (e.g. "BRANDUNG - Impact driven AI Consultant"),
 * while spans keep distinct visual styling.
 */
function renderTargetCompanyRoleHeadingHtml({
  company,
  role,
  companyStyle,
  roleStyle,
  separatorStyle = "font-weight: 600; color: #000000;",
  companyPrefix = "",
  headingStyle = "margin: 0; padding: 0; font-size: inherit; font-weight: inherit; line-height: 1.35; color: inherit;",
}: {
  company?: string | null
  role?: string | null
  companyStyle: string
  roleStyle: string
  separatorStyle?: string
  companyPrefix?: string
  headingStyle?: string
}): string {
  const companyText = (company ?? "").trim()
  const roleText = (role ?? "").trim().replace(/\s*\n+\s*/g, " ")
  if (!companyText && !roleText) return ""

  const parts: string[] = []
  if (companyText) {
    parts.push(
      `<span style="${companyStyle}">${companyPrefix}${escapeHtmlText(companyText)}</span>`,
    )
  }
  if (companyText && roleText) {
    parts.push(`<span style="${separatorStyle}"> - </span>`)
  }
  if (roleText) {
    parts.push(`<span style="${roleStyle}">${escapeHtmlText(roleText)}</span>`)
  }
  return `<h2 style="${headingStyle}">${parts.join("")}</h2>`
}

function CvPreviewScaledPaper({
  zoomLevel,
  remeasureKey,
  onRegisterScale,
  useFormatterPaper,
  children,
}: {
  zoomLevel: number
  /** Re-run scale when CV HTML updates */
  remeasureKey?: string
  onRegisterScale?: (scale: () => void) => void
  useFormatterPaper?: boolean
  children: ReactNode
}) {
  const paperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const applyScale = useCallback(() => {
    const paper = paperRef.current
    const inner = innerRef.current
    if (!paper || !inner) return
    const scale = (paper.offsetWidth / A4_PREVIEW_WIDTH_PX) * zoomLevel
    inner.style.transform = `scale(${scale})`
    const contentHeight = measurePreviewContentHeight(inner)
    paper.style.height = `${Math.round(contentHeight * scale)}px`
  }, [zoomLevel])

  useLayoutEffect(() => {
    onRegisterScale?.(applyScale)
  }, [applyScale, onRegisterScale])

  useLayoutEffect(() => {
    const paper = paperRef.current
    const inner = innerRef.current
    if (!paper || !inner) return
    const run = () => {
      applyScale()
      requestAnimationFrame(applyScale)
    }
    run()
    const observer = new ResizeObserver(run)
    observer.observe(paper)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [applyScale, remeasureKey])

  const paperClass = useFormatterPaper ? "cv-paper" : "cv-preview-paper"
  const innerClass = useFormatterPaper ? "cv-inner" : "cv-preview-inner"

  const paperEl = (
    <div ref={paperRef} className={paperClass}>
      <div ref={innerRef} className={innerClass}>
        {children}
      </div>
    </div>
  )

  if (useFormatterPaper) {
    return <div className="cv-paper-wrap">{paperEl}</div>
  }

  return paperEl
}

type ResumePreviewVersion = ResumeVersion & {
  onResumeTextChange?: (text: string) => void
  onContactInfoChange?: (info: ResumeVersion["contactInfo"]) => void
}

interface ResumePreviewProps {
  version: ResumePreviewVersion
  /** Server PDF / headless: content only, A4 + manual breaks from markers */
  variant?: "default" | "export"
  /** Split layout: controls column, preview column, formatter grid, or both */
  panel?: "all" | "controls" | "preview" | "formatter"
  /** Quality preset for server-side PDF export pages. */
  pdfExportPreset?: PdfExportPreset
  /** Server PDF / print route: include transparency appendix page */
  exportIncludeTransparencyPage?: boolean
  /** Server PDF / print route: embed AI metadata in file properties */
  exportIncludeMetadata?: boolean
  onEdit?: () => void
  /** Opens the cover letter wizard or editor for the current resume. */
  onOpenCoverLetter?: () => void
  /** @deprecated Use onOpenCoverLetter */
  onOpenCoverLetterWizard?: () => void
  /** @deprecated Use onOpenCoverLetter */
  onOpenCoverLetterEditor?: () => void
  /** True when this resume already has a cover letter record (with or without body text). */
  hasSavedCoverLetter?: boolean
  /** Opens Your Story for the linked application. */
  onOpenYourStory?: () => void
  hasYourStory?: boolean
  /** Extra cards rendered below controls (e.g. trust & privacy) */
  footerControls?: React.ReactNode
  /** Trust & transparency data for formatter sidebar */
  trustAllResumes?: ResumeVersion[]
  trustFolderId?: string | null
  onTrustRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
  onTrustDataDeleted?: () => void
  /** Ref for scroll-to-preview targeting */
  previewSectionRef?: React.RefObject<HTMLDivElement | null>
  /** Edit inputs slot for formatter drawer layout */
  leftSlot?: React.ReactNode
  /** Version controls slot for formatter settings drawer (save, versions, start again) */
  versionActionsSlot?: React.ReactNode
  /** Lift PDF / Word / cover letter actions into the formatter top bar */
  onRegisterDocumentActions?: (actions: React.ReactNode) => void
  /** Register scaleCV for layout transitions (sidebar / drawers) */
  onRegisterScale?: (scale: () => void) => void
  /** Formatter main topbar: breadcrumb area */
  formatterBreadcrumb?: React.ReactNode
  /** Formatter main topbar: right actions (sync, user menu) */
  formatterTopbarRight?: React.ReactNode
}

interface Section {
  id: string
  title: string
  content: string[]
}

const paginationExplainerCopy = {
  en: {
    title: "A4 pages, page breaks, and overflow",
    triggerHint: "Need more information?",
    manualNote:
      "You have at least one manual page marker — it suggests where page 2 should start, but the layout still fills each page first when there is room.",
    items: [
      "Each frame here is a real A4 page. After fonts load, what you see matches Chrome print preview and the PDF export (one frame per printed page).",
      `Optional manual splits: put ${MANUAL_PAGE_BREAK_MARKER} alone on its own line (only that text, aside from spaces). Matching is case-insensitive. Content after the marker starts on the next A4 page in preview and PDF.`,
      "With no markers, the entire resume is one flow; the tool inserts page breaks automatically at the bottom margin.",
      "Word export turns each marker into a hard page break in the document.",
      "Watch for blocks that are taller than one page (for example an extremely long bullet list under one job). The preview uses overflow: visible so nothing is clipped without a warning.",
    ],
    overflow:
      "Orange outline around the preview (and sometimes a banner on the page): pagination detected overflow. Shorten bullets, split dense jobs, add a manual break before a heavy block, or switch to a more compact view mode.",
    overflowNotice: "Overflow detected — expand for guidance.",
  },
  de: {
    title: "A4-Seiten, Umbrüche und Überlauf",
    triggerHint: "Weitere Informationen?",
    manualNote:
      "Mindestens eine manuelle Seitenmarkierung ist aktiv — sie schlägt vor, wo Seite 2 beginnen soll; die Seite wird aber zuerst gefüllt, wenn noch Platz ist.",
    items: [
      "Jeder Rahmen entspricht einer echten A4-Seite. Nach dem Laden der Schriften entspricht die Vorschau dem Chrome-Druckdialog und dem PDF-Export (eine Seite pro Rahmen).",
      `Optionale Aufteilung: ${MANUAL_PAGE_BREAK_MARKER} allein in einer Zeile (nur dieser Text, Leerzeichen sind erlaubt). Groß-/Kleinschreibung egal. Inhalt nach der Markierung beginnt in Vorschau und PDF auf der nächsten A4-Seite.`,
      "Ohne Markierungen fließt der gesamte Lebenslauf durch; Seitenumbrüche werden automatisch am unteren Rand gesetzt.",
      "Word-Export: jede Markierung wird ein fester Seitenumbruch in Word.",
      "Sehr hohe Blöcke (z. B. extrem lange Aufzählungen unter einer Stelle) können höher sein als eine Seite; die Vorschau bleibt sichtbar (overflow: visible), damit nichts still abgeschnitten wird.",
    ],
    overflow:
      "Oranger Rahmen um die Vorschau (manchmal ein Banner auf der Seite): Der Umbruch hat Überlauf erkannt. Text kürzen, Stellen aufteilen, vor dichten Blöcken eine manuelle Markierung setzen oder eine kompaktere Ansicht wählen.",
    overflowNotice: "Überlauf erkannt — ausklappen für Hinweise.",
  },
} as const

interface EditedResumeData {
  sections: Section[]
  contactInfo: ResumeContactInfo
}

const convertOklchToHex = (oklchColor: string): string => {
  try {
    const match = oklchColor.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)/)
    if (!match) {
      console.error("[v0] Invalid OKLCH format:", oklchColor)
      return "#3b82f6" // Default blue color
    }

    const lightnessStr = match[1]
    let l = Number.parseFloat(lightnessStr)
    const c = Number.parseFloat(match[2])
    const h = Number.parseFloat(match[3])

    // Convert percentage to decimal if the string includes %
    if (lightnessStr.includes("%")) {
      l = l / 100
    }

    // Convert OKLCH to linear RGB
    const a = c * Math.cos((h * Math.PI) / 180)
    const b = c * Math.sin((h * Math.PI) / 180)

    let lr = l + 0.3963377774 * a + 0.2158037573 * b
    let lg = l - 0.1055613458 * a - 0.0638541728 * b
    let lb = l - 0.0894841775 * a - 1.291485548 * b

    lr = Math.pow(lr, 3)
    lg = Math.pow(lg, 3)
    lb = Math.pow(lb, 3)

    // Convert linear RGB to sRGB
    const toSRGB = (c: number) => {
      if (c <= 0.0031308) {
        return 12.92 * c
      }
      return 1.055 * Math.pow(c, 1 / 2.4) - 0.055
    }

    let r = toSRGB(3.2404542 * lr - 1.5371385 * lg - 0.4985314 * lb)
    let g = toSRGB(-0.969266 * lr + 1.8760108 * lg + 0.041556 * lb)
    let blu = toSRGB(0.0556434 * lr - 0.2040259 * lg + 1.0572252 * lb)

    // Clamp to 0-1 range
    r = Math.max(0, Math.min(1, r))
    g = Math.max(0, Math.min(1, g))
    blu = Math.min(1, blu)

    // Convert to hex
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0")

    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(blu)}`
    console.log("[v0] Converted OKLCH to hex:", hexColor)
    return hexColor
  } catch (error) {
    console.error("[v0] Error converting oklch to hex:", error)
    return "#3b82f6" // Default blue color
  }
}

const convertColorToRGB = (element: HTMLElement, colorProperty: string): string => {
  const computed = window.getComputedStyle(element)
  const value = computed.getPropertyValue(colorProperty)

  // Browser returns rgb() or rgba() format even if source was oklch()
  if (value.startsWith("rgb")) {
    return value
  }

  // Fallback for edge cases
  const tempDiv = document.createElement("div")
  tempDiv.style.color = value
  document.body.appendChild(tempDiv)
  const computedColor = window.getComputedStyle(tempDiv).color
  document.body.removeChild(tempDiv)
  return computedColor || "rgb(0, 0, 0)"
}

const convertAllColorsToRGB = (element: HTMLElement, accentHexColor: string) => {
  // Convert accent color hex to RGB for comparison
  const tempDiv = document.createElement("div")
  tempDiv.style.color = accentHexColor
  document.body.appendChild(tempDiv)
  const accentRGB = window.getComputedStyle(tempDiv).color
  document.body.removeChild(tempDiv)

  // Recursively process all elements
  const processElement = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el)

    // Convert color properties to RGB
    const colorValue = computed.color
    if (colorValue && colorValue !== "rgb(0, 0, 0)") {
      el.style.color = convertColorToRGB(el, "color")
    }

    const bgColor = computed.backgroundColor
    if (bgColor && bgColor !== "rgba(0, 0, 0, 0)") {
      el.style.backgroundColor = convertColorToRGB(el, "background-color")
    }

    const borderColor = computed.borderColor
    if (borderColor && borderColor !== "rgb(0, 0, 0)") {
      el.style.borderColor = convertColorToRGB(el, "border-color")
    }

    const outlineColor = computed.outlineColor
    if (outlineColor && outlineColor !== "rgb(0, 0, 0)") {
      el.style.outlineColor = convertColorToRGB(el, "outline-color")
    }

    // Check for accent color usage via CSS variables or classes
    const classList = Array.from(el.classList)
    const usesAccent = classList.some(
      (cls) => cls.includes("accent") || cls.includes("border-[") || cls.includes("bg-[") || cls.includes("text-["),
    )

    if (usesAccent) {
      // Apply the accent color as RGB
      if (el.style.borderColor) el.style.borderColor = accentRGB
      if (el.style.backgroundColor) el.style.backgroundColor = accentRGB
      if (el.style.color && colorValue !== "rgb(0, 0, 0)") el.style.color = accentRGB
    }

    // Process children
    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        processElement(child)
      }
    })
  }

  processElement(element)
}

const convertColorToRgb = (color: string): string => {
  const temp = document.createElement("div")
  temp.style.color = color
  document.body.appendChild(temp)
  const computedColor = window.getComputedStyle(temp).color
  document.body.removeChild(temp)
  return computedColor // Returns "rgb(r, g, b)"
}

const ensureRGBColor = (color: string): string => {
  // If it's already a hex color, return it
  if (color.startsWith("#")) {
    return color
  }

  // If it contains OKLCH, convert it
  if (color.includes("oklch")) {
    return convertOklchToHex(color)
  }

  // For any other format, use browser to convert to RGB
  const tempDiv = document.createElement("div")
  tempDiv.style.color = color
  document.body.appendChild(tempDiv)
  const computedColor = window.getComputedStyle(tempDiv).color
  document.body.removeChild(tempDiv)

  // Convert rgb(r, g, b) to hex
  if (computedColor.startsWith("rgb")) {
    const match = computedColor.match(/\d+/g)
    if (match && match.length >= 3) {
      const r = Number.parseInt(match[0])
      const g = Number.parseInt(match[1])
      const b = Number.parseInt(match[2])
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    }
  }

  return "#3b82f6" // Default blue color
}

type ViewMode = "human" | "ats-styled" | "ats-text"
type HumanFormatStyle = CvFormatStyle

// Style configurations for each Human format style
const formatStyles = {
  current: {
    lineHeight: 1.55,
    sectionSpacing: 18,
    baseFontSize: 13,
    headerStyle: "uppercase" as const,
    headerWeight: "bold",
    bulletIndent: 18,
    dividerWidth: 2,
    containerPadding: 40,
    sectionHeaderMargin: "18px 0 10px 0",
    bulletMargin: 6,
    titleDateLayout: "stacked" as const,
  },
  "executive-compact": {
    lineHeight: 1.4,
    sectionSpacing: 12,
    baseFontSize: 10,
    headerStyle: "uppercase" as const,
    headerWeight: "bold",
    bulletIndent: 12,
    dividerWidth: 1,
    containerPadding: 32,
    sectionHeaderMargin: "16px 0 8px 0",
    bulletMargin: 4,
    titleDateLayout: "inline" as const,
  },
  "modern-spacious": {
    // Clean clarity without oversized empty space — distinct from dense Executive.
    lineHeight: 1.55,
    sectionSpacing: 18,
    baseFontSize: 11.5,
    headerStyle: "lowercase" as const,
    headerWeight: "500",
    bulletIndent: 18,
    dividerWidth: 1.5,
    containerPadding: 40,
    sectionHeaderMargin: "18px 0 10px 0",
    bulletMargin: 7,
    titleDateLayout: "stacked" as const,
  },
}

export function ResumePreview({
  version,
  variant = "default",
  panel = "all",
  pdfExportPreset: pdfExportPresetProp,
  exportIncludeTransparencyPage = false,
  exportIncludeMetadata = true,
  onEdit,
  onOpenCoverLetter,
  onOpenCoverLetterWizard,
  onOpenCoverLetterEditor,
  hasSavedCoverLetter = false,
  onOpenYourStory,
  hasYourStory = false,
  footerControls,
  trustAllResumes = [],
  trustFolderId,
  onTrustRestoreSnapshot,
  onTrustDataDeleted,
  previewSectionRef,
  leftSlot,
  versionActionsSlot,
  onRegisterDocumentActions,
  onRegisterScale,
  formatterBreadcrumb,
  formatterTopbarRight,
}: ResumePreviewProps) {
  const openCoverLetterHandler =
    onOpenCoverLetter ?? onOpenCoverLetterEditor ?? onOpenCoverLetterWizard
  const openCoverLetterRef = useRef(openCoverLetterHandler)
  openCoverLetterRef.current = openCoverLetterHandler
  const openCoverLetter = useCallback(() => {
    openCoverLetterRef.current?.()
  }, [])
  const showCoverLetterButton = Boolean(openCoverLetterHandler)
  const showYourStoryButton = Boolean(onOpenYourStory)
  const contactInfo = useMemo(
    () => normalizeContactInfo(version.contactInfo),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable contact payload
    [JSON.stringify(version.contactInfo)],
  )
  const displayVersion = useMemo(
    () => ({ ...version, contactInfo }),
    [version, contactInfo],
  )

  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<EditedResumeData | null>(null)
  const [draggedSection, setDraggedSection] = useState<number | null>(null)
  const [draggedOver, setDraggedOver] = useState<number | null>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false) // Renamed from isDownloadingPDF for clarity
  const [includeTransparencyPage, setIncludeTransparencyPage] = useState(false)
  const [includeExportMetadata, setIncludeExportMetadata] = useState(true)
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false) // New state for PDF download
  const [pdfExportPreset, setPdfExportPreset] = useState<PdfExportPreset>(
    () => pdfExportPresetProp ?? DEFAULT_PDF_EXPORT_PRESET,
  )
  const [estimatedPdfBytes, setEstimatedPdfBytes] = useState<number | null>(null)
  /** Human (Visual) only — View Mode selector removed from UI. */
  const viewMode = "human" as ViewMode
  /**
   * CV style is persisted on contactInfo.formatStyle so editor preview and
   * server PDF export (#resume-root / variant="export") share one source of truth.
   * Do not keep a separate ephemeral default here — that forced Executive Compact on export.
   */
  const humanFormatStyle = normalizeCvFormatStyle(
    displayVersion.contactInfo.formatStyle ?? DEFAULT_CV_FORMAT_STYLE,
  )
  const setHumanFormatStyle = useCallback(
    (id: HumanFormatStyle) => {
      const nextStyle = normalizeCvFormatStyle(id)
      if (nextStyle === humanFormatStyle) return
      version.onContactInfoChange?.({
        ...displayVersion.contactInfo,
        formatStyle: nextStyle,
      })
    },
    [displayVersion.contactInfo, humanFormatStyle, version],
  )
  const [pdfSurfaceHtml, setPdfSurfaceHtml] = useState<string | null>(null)
  const [pdfPaginationReady, setPdfPaginationReady] = useState(false)
  const [pdfPaginationHadOverflow, setPdfPaginationHadOverflow] = useState(false)
  const [paginationExplainerOpen, setPaginationExplainerOpen] = useState(false)
  const [savedJobDescription, setSavedJobDescription] = useState<string>("")
  const [zoomLevel, setZoomLevel] = useState(1)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const formatterWorkspaceRef = useRef<HTMLDivElement>(null)
  const closePopoverRef = useRef<(() => void) | null>(null)
  const openPopoverRef = useRef<((id: string) => void) | null>(null)
  const [formatterPopoverOpen, setFormatterPopoverOpen] = useState(false)
  const scaleFnRef = useRef<(() => void) | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const scheduleScale = useCallback(() => {
    setTimeout(() => scaleFnRef.current?.(), 220)
  }, [])

  useEffect(() => {
    scheduleScale()
  }, [scheduleScale])

  const handleRegisterScale = useCallback(
    (fn: () => void) => {
      scaleFnRef.current = fn
      onRegisterScale?.(fn)
    },
    [onRegisterScale],
  )
  const cvInsights = useMemo(() => buildCvReviewInsights(version), [version])
  
  // Load job description from sessionStorage on mount
  useEffect(() => {
    const storedJobDescription = sessionStorage.getItem("pendingJobDescription")
    if (storedJobDescription) {
      setSavedJobDescription(storedJobDescription)
    }
  }, [])

  useEffect(() => {
    if (pdfExportPresetProp) {
      setPdfExportPreset(pdfExportPresetProp)
    }
  }, [pdfExportPresetProp])

  useEffect(() => {
    if (variant === "export") return

    const updateEstimate = () => {
      const root = contentRef.current
      const bytes = estimatePdfSizeBytes(root, {
        preset: pdfExportPreset,
        includeCoverLetter: hasSavedCoverLetter,
        includeTransparencyPage,
        extraImageDataUrls: [version.profileImage, version.companyLogo],
        textLength: displayVersion.resumeText?.length ?? 0,
      })
      setEstimatedPdfBytes(bytes)
    }

    updateEstimate()
    const timer = window.setTimeout(updateEstimate, 120)
    return () => window.clearTimeout(timer)
  }, [
    variant,
    pdfExportPreset,
    pdfSurfaceHtml,
    pdfPaginationReady,
    hasSavedCoverLetter,
    includeTransparencyPage,
    version.profileImage,
    version.companyLogo,
    displayVersion.resumeText,
  ])

  const accentColor = version.accentColor || "oklch(74% 0.10 81)"
  const hexAccentColor = ensureRGBColor(version.accentColorHex || accentColor)

  console.log("[v0] Accent color prop changed:", accentColor)
  console.log("[v0] Hex accent color for PDF:", hexAccentColor)

  const parseResumeForEditing = () => {
    const lines = version.resumeText.split("\n")
    const processedContent: Section[] = []
    const headers: string[] = []
    let currentSection: Section | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line) {
        if (currentSection) {
          processedContent.push({ ...currentSection })
          currentSection = null
        }
        continue
      }

      const isHeader = line === line.toUpperCase() && line.length > 2 && line.length < 50
      const commonSections = ["EXPERIENCE", "EDUCATION", "SKILLS", "PROJECTS", "CERTIFICATIONS", "SUMMARY", "ABOUT"]
      const isSectionHeader = isHeader || commonSections.some((s) => line.toUpperCase().includes(s))

      if (isSectionHeader && i > 3) {
        if (currentSection) {
          processedContent.push({ ...currentSection })
        }
        currentSection = { id: Date.now().toString() + Math.random(), title: line, content: [] }
      } else if (currentSection) {
        currentSection.content.push(line)
      } else {
        headers.push(line)
      }
    }

    if (currentSection) {
      processedContent.push(currentSection)
    }

    setEditedData({ sections: processedContent, contactInfo: displayVersion.contactInfo })
    setIsEditing(true)
  }

  const saveEditedContent = () => {
    if (!editedData) return

    const sections: string[] = []

    editedData.sections.forEach((section) => {
      const lines: string[] = [section.title, ...section.content]
      sections.push(lines.join("\n"))
    })

    version.onResumeTextChange?.(sections.join("\n\n"))
    version.onContactInfoChange?.(editedData.contactInfo)
    setIsEditing(false)
  }

  const handleDownloadPDF = async () => {
    console.log("[v0] Download PDF clicked - Generating image")

    if (!contentRef.current) {
      console.error("[v0] Preview ref not found")
      alert("Preview not found. Please ensure the resume is visible.")
      return
    }

    const originalElement = contentRef.current

    const tempContainer = document.createElement("div")
    tempContainer.style.position = "fixed"
    tempContainer.style.left = "-9999px"
    tempContainer.style.top = "0"
    tempContainer.style.width = "794px"
    tempContainer.style.backgroundColor = "#ffffff"
    tempContainer.style.padding = "0"
    tempContainer.style.margin = "0"
    document.body.appendChild(tempContainer)

    const clonedElement = originalElement.cloneNode(true) as HTMLElement
    clonedElement.style.width = "794px"
    clonedElement.style.maxWidth = "794px"
    clonedElement.style.minWidth = "794px"
    clonedElement.style.padding = "0"
    clonedElement.style.margin = "0"
    clonedElement.style.border = "none"
    clonedElement.style.boxSizing = "border-box"
    tempContainer.appendChild(clonedElement)

    try {
      setIsGeneratingPDF(true)

      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log("[v0] Loading html2canvas library")
      console.log("[v0] html2canvas loaded successfully")

      console.log("[v0] Generating canvas from element")
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: true,
        width: clonedElement.scrollWidth,
        height: clonedElement.scrollHeight,
        windowWidth: 794,
        x: 0,
        y: 0,
      })

      console.log("[v0] Canvas created:", canvas.width, "x", canvas.height)

      document.body.removeChild(tempContainer)

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("[v0] Failed to create blob from canvas")
          alert("Failed to create image blob. Please try again.")
          setIsGeneratingPDF(false)
          return
        }

        console.log("[v0] Blob created, size:", blob.size, "bytes")

        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "resume.png"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 100)

        console.log("[v0] Image downloaded successfully")
        setIsGeneratingPDF(false)
      }, "image/png")
    } catch (error) {
      console.error("[v0] Error generating image:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to generate image: ${errorMessage}. Please try again or check your browser console for details.`)
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer)
      }
      setIsGeneratingPDF(false)
    }
  }

  const downloadResumeViaApi = async (
    resumeId: string,
    preset: PdfExportPreset,
    filename: string,
    options: {
      includeTransparencyPage: boolean
      includeExportMetadata: boolean
      formatStyle: HumanFormatStyle
    },
  ) => {
    const params = new URLSearchParams({ preset })
    if (options.includeTransparencyPage) params.set("transparency", "1")
    params.set("metadata", options.includeExportMetadata ? "1" : "0")
    // Always pass the editor's selected CV style so server export matches preview
    // even if autosave has not yet written contactInfo.formatStyle.
    params.set("formatStyle", options.formatStyle)
    const response = await fetch(`/api/pdf/resume/${resumeId}?${params.toString()}`)
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(detail || `Server PDF export failed (${response.status})`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const downloadPDFImpl = async () => {
    let tempContainer: HTMLDivElement | null = null
    try {
      setIsDownloadingPDF(true)

      const element = contentRef.current
      if (!element) {
        throw new Error("Resume preview element not found")
      }

      const preset = pdfExportPreset
      const presetConfig = PDF_EXPORT_PRESETS[preset]
      const downloadName = `${version.name || "resume"}.pdf`

      if (isSavedResumeId(version.id)) {
        try {
          await downloadResumeViaApi(version.id, preset, downloadName, {
            includeTransparencyPage,
            includeExportMetadata,
            formatStyle: humanFormatStyle,
          })
          toast({
            title: "PDF Downloaded",
            description: `${presetConfig.shortLabel} export with selectable, searchable text.`,
          })
          return
        } catch (apiError) {
          console.warn("[pdf] Server export unavailable, falling back to print:", apiError)
        }
      }

      // Convert accent color to hex for PDF compatibility
      const rgbAccentColor = hexAccentColor.startsWith("#") ? hexAccentColor : "#C9975B"

      // Create a new window for printing
      const printWindow = window.open("", "_blank", "width=800,height=600")
      if (!printWindow) {
        throw new Error("Could not open print window. Please allow popups.")
      }

      tempContainer = document.createElement("div")
      tempContainer.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;"
      document.body.appendChild(tempContainer)

      // Clone, optimize images, and process the content
      const clone = element.cloneNode(true) as HTMLElement
      tempContainer.appendChild(clone)

      await optimizeDomForPdfExport(clone, preset)

      // ATS Optimized: strip Career Evolution so parsers only see standard CV text.
      if (preset === "ats") {
        clone
          .querySelectorAll(
            '[data-career-evolution-section], [data-pdf-block="career-evolution"], .career-evolution-figure',
          )
          .forEach((el) => el.remove())
        clone.querySelectorAll("h2").forEach((heading) => {
          const t = (heading.textContent || "").trim().toUpperCase()
          if (t === "CAREER EVOLUTION" || t.includes("KARRIEREENTWICKLUNG")) {
            heading.remove()
          }
        })
        clone.innerHTML = stripCareerEvolutionFromHtml(clone.innerHTML)
      }

      // Replace OKLCH colors
      const walkAndReplaceColors = (el: HTMLElement) => {
        const style = el.getAttribute("style") || ""
        if (style.includes("oklch")) {
          el.setAttribute("style", style.replace(/oklch\([^)]+\)/gi, rgbAccentColor))
        }
        Array.from(el.children).forEach((child) => {
          if (child instanceof HTMLElement) {
            walkAndReplaceColors(child)
          }
        })
      }
      walkAndReplaceColors(clone)

      // Print bootstrap:
      //   - Detach from opener so the popup can't keep a handle on the parent.
      //   - Wait for `document.fonts.ready` before firing `window.print()`
      //     (otherwise text can shift between preview and PDF).
      //   - Auto-close after print so the user doesn't have to close the
      //     popup manually (which is what was leaving the main site stuck).
      const printScript = `
        try { window.opener = null; } catch (e) {}
        var __printed = false;
        function __closeSelf() { try { window.close(); } catch (e) {} }
        window.addEventListener('afterprint', function() {
          __printed = true;
          setTimeout(__closeSelf, 50);
        });
        window.addEventListener('focus', function() {
          setTimeout(function() { if (!__printed) __closeSelf(); }, 800);
        });
        window.addEventListener('load', function() {
          (document.fonts && document.fonts.ready
            ? document.fonts.ready
            : Promise.resolve()
          ).then(function() {
            setTimeout(function() { window.print(); }, 150);
          });
        });
      `

      // The popup prints the SAME HTML that the preview already rendered
      // (clone.innerHTML, which contains the .pdf-page wrappers). The CSS
      // here is intentionally minimal — it only defines the page primitive
      // and the rules required for deterministic pagination. Everything
      // else (typography, colors, layout) is already inline on the rendered
      // nodes. This guarantees the PDF matches the preview page-by-page.
      const provenance = resolveExportProvenance(version)
      const exportMeta = buildExportMetadataComments({
        model: provenance.model,
        providerLabel: provenance.providerLabel,
        aiAssistanceEnabled: provenance.aiAssistanceEnabled,
      })

      const includeHtmlMetadata =
        includeExportMetadata && !presetConfig.stripHtmlMetadata

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${version.name || "Resume"}</title>
          ${includeHtmlMetadata ? `<meta name="description" content="${exportMeta.pdfMeta.replace(/"/g, "&quot;")}" />` : ""}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="${presetConfig.googleFontsHref}" rel="stylesheet" />
          <style>
            /* Sole print margin source — match app/globals.css (do not also pad .pdf-page). */
            @page {
              size: A4 portrait;
              margin: 15mm;
            }

            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: auto !important;
              height: auto !important;
              background: #ffffff;
              color: #000000;
            }

            /* Mirrors globals.css — @page margins only; no max-height (Safari blank sheets). */
            .pdf-page {
              width: 100%;
              height: auto;
              max-height: none;
              min-height: 0;
              box-sizing: border-box;
              padding: 0 !important;
              margin: 0;
              overflow: visible;
              background: #ffffff;
              position: relative;
              page-break-after: always;
              break-after: page;
            }

            @media print {
              .pdf-page {
                overflow: visible;
                max-height: none;
                padding: 0 !important;
                break-after: page;
                page-break-after: always;
              }

              .pdf-page .resume-section-block {
                break-inside: auto;
                page-break-inside: auto;
              }

              .export-transparency-appendix {
                padding: 0 !important;
              }
            }
            .pdf-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .pdf-page--auto {
              height: auto;
              max-height: none;
              min-height: 0;
              overflow: visible;
              page-break-after: auto;
              break-after: auto;
              page-break-inside: auto;
              break-inside: auto;
            }

            .resume-section-block {
              break-inside: auto;
              page-break-inside: auto;
            }
            .pdf-page h2,
            .pdf-page h3 {
              break-after: avoid-page;
              page-break-after: avoid;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            /* job-head = title/company/dates + first 2 bullets only — never whole sections. */
            .pdf-block-keep-together,
            .pdf-resume-block[data-pdf-block="job-head"],
            .pdf-resume-block[data-pdf-block="skill-item"],
            .pdf-resume-block[data-pdf-block="education-entry"],
            .pdf-resume-block[data-pdf-block="career-evolution"],
            .career-evolution-figure {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .pdf-job-continuation ul { margin-top: 0 !important; padding-top: 0 !important; }
            .pdf-job-continuation--page-start { padding-top: 0.35em; }

            /* Career Evolution must print (SVG + accent fills). Do not clip Parallel.
               Do NOT set height:auto on the SVG — Chromium print can collapse
               width:100% + height:auto SVGs to 0 when viewBox sizing fails. */
            .career-evolution-figure,
            [data-career-evolution-section="1"],
            .pdf-resume-block[data-pdf-block="career-evolution"] {
              display: block !important;
              visibility: visible !important;
              overflow: visible !important;
              max-height: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .career-evolution-figure svg {
              display: block !important;
              visibility: visible !important;
              width: 100% !important;
              max-width: 100% !important;
              max-height: none !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .career-evolution-figure__alt {
              position: absolute;
              width: 1px;
              height: 1px;
              padding: 0;
              margin: -1px;
              overflow: hidden;
              clip: rect(0, 0, 0, 0);
              white-space: nowrap;
              border: 0;
            }

            ${CV_TWO_COLUMN_LIST_CSS}
            ${CV_MARKDOWN_TABLE_CSS}

            /* Legacy marker: the on-screen dashed separator is no longer
               needed because each page is its own .pdf-page wrapper. */
            .pdf-page .page-break { display: none; }

            a {
              color: ${rgbAccentColor};
              text-decoration: underline;
            }

            img {
              max-width: 100%;
              height: auto;
            }

            .page-label,
            .page-break-label {
              display: none !important;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${clone.innerHTML}
          <script>
            ${printScript}
          </script>
        </body>
        </html>
      `

      document.body.removeChild(tempContainer)
      tempContainer = null

      printWindow.document.write(printContent)
      printWindow.document.close()

      toast({
        title: "Print Dialog Opened",
        description: `Select "Save as PDF" to download your ${presetConfig.shortLabel} PDF with selectable text and clickable links.`,
      })
    } catch (error) {
      console.error("[v0] PDF generation error:", error)
      toast({
        title: "PDF Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      if (tempContainer && document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer)
      }
      setIsDownloadingPDF(false)
    }
  }

  const downloadWordImpl = async () => {
    try {
      console.log("[v0] Generating Word document")

      const sections: any[] = []

      sections.push(
        new Paragraph({
          text: displayVersion.contactInfo.name || "Your Name",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      )

      if (displayVersion.contactInfo.professionalTitle) {
        sections.push(
          new Paragraph({
            text: displayVersion.contactInfo.professionalTitle,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
        )
      }

      const contactParts = []
      if (displayVersion.contactInfo.email) contactParts.push(displayVersion.contactInfo.email)
      if (displayVersion.contactInfo.phone) contactParts.push(displayVersion.contactInfo.phone)
      if (displayVersion.contactInfo.address) contactParts.push(displayVersion.contactInfo.address)
      if (displayVersion.contactInfo.linkedin) contactParts.push(displayVersion.contactInfo.linkedin)
      const docxPortfolios = visiblePortfolioUrls(displayVersion.contactInfo)
      if (docxPortfolios.length > 0) {
        contactParts.push(
          docxPortfolios.map((url) => formatPortfolioUrlForDisplay(url)).join(" | "),
        )
      }

      if (contactParts.length > 0) {
        sections.push(
          new Paragraph({
            text: contactParts.join(" | "),
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
        )
      }

      const lines = version.resumeText.split("\n")

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (isManualPageBreakLine(trimmedLine)) {
          sections.push(
            new Paragraph({
              children: [new PageBreak()],
            }),
          )
          continue
        }

        if (!trimmedLine) {
          sections.push(new Paragraph({ text: "" }))
          continue
        }

        const parsedDocx = parseResumeMarkupLine(trimmedLine)
        if (
          parsedDocx.kind === "section-heading" ||
          parsedDocx.kind === "job-title" ||
          parsedDocx.kind === "company" ||
          parsedDocx.kind === "date"
        ) {
          const headingLevel =
            parsedDocx.kind === "date"
              ? HeadingLevel.HEADING_3
              : parsedDocx.kind === "company"
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_1
          sections.push(
            new Paragraph({
              text: parsedDocx.text,
              heading: headingLevel,
              spacing: {
                before: parsedDocx.kind === "date" ? 200 : 400,
                after: parsedDocx.kind === "date" ? 100 : 200,
              },
            }),
          )
        } else if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
          sections.push(
            new Paragraph({
              text: trimmedLine,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
          )
        } else if (parsedDocx.kind === "bullet") {
          sections.push(
            new Paragraph({
              text: resumeInlineTextToPlain(parsedDocx.text),
              bullet: { level: 0 },
              spacing: { after: 100 },
            }),
          )
        } else if (trimmedLine.includes("**") || trimmedLine.includes("*")) {
          const parts = trimmedLine.split(/(\*\*.*?\*\*|\*.*?\*)/g)
          const textRuns = parts.map((part) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return new TextRun({ text: formattedTextToPlain(part), bold: true })
            } else if (part.startsWith("*") && part.endsWith("*")) {
              return new TextRun({ text: formattedTextToPlain(part), italics: true })
            }
            return new TextRun({ text: formattedTextToPlain(part) })
          })

          sections.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 100 },
            }),
          )
        } else {
          sections.push(
            new Paragraph({
              text: resumeInlineTextToPlain(trimmedLine),
              spacing: { after: 100 },
            }),
          )
        }
      }

      const provenance = version.aiProvenance
      const exportMeta = buildExportMetadataComments({
        model: provenance?.lastModel,
        providerLabel: provenance?.lastProviderLabel,
        aiAssistanceEnabled: Boolean(version.aiAuditLog?.length),
      })

      if (includeExportMetadata) {
        sections.push(
          new Paragraph({ text: "" }),
          new Paragraph({
            text: exportMeta.docxFooter,
            spacing: { before: 400 },
          }),
        )
      }

      if (includeTransparencyPage) {
        sections.push(
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: TRANSPARENCY_STATEMENT_COPY.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 },
          }),
        )
        const transparencyParagraphs = getTransparencyStatementBodyParagraphs()
        for (const [index, paragraph] of transparencyParagraphs.entries()) {
          const isLast = index === transparencyParagraphs.length - 1
          sections.push(
            new Paragraph({
              text: paragraph,
              spacing: { after: isLast ? 120 : 200 },
            }),
          )
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: sections,
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${displayVersion.contactInfo.name || "resume"}_CV.docx`
      link.click()
      window.URL.revokeObjectURL(url)

      console.log("[v0] Word document generated successfully")
    } catch (error) {
      console.error("[v0] Error generating Word document:", error)
    }
  }

  const downloadPDFRef = useRef(downloadPDFImpl)
  downloadPDFRef.current = downloadPDFImpl
  const downloadPDF = useCallback(() => downloadPDFRef.current(), [])

  const downloadWordRef = useRef(downloadWordImpl)
  downloadWordRef.current = downloadWordImpl
  const downloadWord = useCallback(() => downloadWordRef.current(), [])

  const parsedViewSections = parseResumeText(version.resumeText).map((section) => ({
    ...section,
    // Never show `[columns=n]` in the printed heading — layout uses section.columns.
    title: stripSectionColumnModifier(section.title),
  }))
  const manualPageBreaksActive = resumeContainsManualPageBreak(version.resumeText)

  const isProfileSection = (title: string) => {
    const key = normalizeCvSectionKey(title)
    if (key === "PROFILE") return true
    const normalized = stripSectionColumnModifier(title).toUpperCase().trim()
    return (
      normalized === "PROFILE" ||
      normalized === "PROFIL" ||
      normalized === "SUMMARY" ||
      normalized === "ABOUT" ||
      normalized === "ZUSAMMENFASSUNG"
    )
  }

  const isSubsectionHeader = (
    line: string,
    sectionTitle: string,
    previousLine?: string,
    nextLine?: string,
  ): { type: "company" | "location" | "date" | "position" | "degree" | "institution" | "bullet" } => {
    const normalized = sectionTitle.toUpperCase().trim()

    if (
      normalized.includes("EXPERIENCE") ||
      normalized.includes("ERFAHRUNG") ||
      normalized.includes("BERUFSSTATIONEN") ||
      normalized.includes("BERUF") ||
      normalized.includes("DESIGNER") ||
      normalized.includes("CONSULTANT") ||
      normalized.includes("STRATEGIST") ||
      normalized.includes("SPECIALIST") ||
      normalized.includes("MANAGER") ||
      normalized.includes("DEVELOPER") ||
      normalized.includes("ENGINEER")
    ) {
      if (
        /^[\w\s]+ \d{4}\s*[–—-]\s*[\w\s\d]+$/i.test(line) ||
        /^\d{4}\s*[–—-]\s*\d{4}$/i.test(line) ||
        /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/i.test(
          line,
        )
      ) {
        return { type: "date" }
      }

      if (line.includes(",") && line.split(",").length === 2 && line.length < 50 && !/\d{4}/.test(line)) {
        return { type: "location" }
      }

      if (line === line.toUpperCase() && line.length > 15 && line.length < 100 && !line.includes(",")) {
        return { type: "position" }
      }

      if (
        /^[A-ZÄÖÜ]/.test(line) &&
        line !== line.toUpperCase() &&
        line.length > 3 &&
        !line.includes(",") &&
        !line.includes("–") &&
        !line.includes("•")
      ) {
        return { type: "company" }
      }
    }

    if (
      normalized.includes("EDUCATION") ||
      normalized.includes("AUSBILDUNG") ||
      normalized.includes("STUDIEN") ||
      normalized.includes("MASTER") ||
      normalized.includes("BACHELOR")
    ) {
      if (/^[A-ZÄÖÜ]/.test(line) && line.length > 3 && !line.includes(",") && !line.includes("–")) {
        return { type: "institution" }
      }

      if (
        /^[A-ZÄÖÜ]/.test(line) &&
        line.length > 3 &&
        (line.includes("Bachelor") || line.includes("Master") || line.includes("Diplom") || line.includes("PhD"))
      ) {
        return { type: "degree" }
      }
    }

    if (line.startsWith("•") || line.startsWith("-") || (line.length > 30 && line.includes(" "))) {
      return { type: "bullet" }
    }

    return { type: "default" }
  }

  const renderUniversalMarkdownLines = (
    lines: string[],
    options?: {
      showEmploymentDuration?: boolean
      sectionIsParallelWork?: boolean
    },
  ): string => {
    const style = formatStyles[humanFormatStyle]
    // Use hexAccentColor directly for consistent color rendering
    // hexAccentColor is already computed and validated at the component level
    const accentColorForHTML = hexAccentColor
    const inlineHtml = (text: string) =>
      formattedTextToHtml(text, {
        linkColor: accentColorForHTML,
        underline: true,
      })
    const durationLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
    const appendDuration = options?.showEmploymentDuration === true
    const workLang = displayVersion.contactInfo.language === "de" ? "de" : "en"

    let html = ""
    let inBulletList = false

    for (const line of lines) {
      const parsed = parseResumeMarkupLine(line)

      if (parsed.kind === "page-break") {
        continue
      }

      if (parsed.kind === "section-heading") {
        // Leftover section markers in body (parser normally consumes these).
        // Show cleaned label only — never markup hashes. Skip if empty.
        if (inBulletList) {
          html += "</ul>"
          inBulletList = false
        }
        if (!parsed.text) continue
        html += `<p style="font-size: ${style.baseFontSize + 2}px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: ${style.sectionSpacing / 2}px 0 ${style.bulletMargin}px 0; color: #000000; line-height: ${style.lineHeight};">${inlineHtml(parsed.text)}</p>`
        continue
      }

      if (parsed.kind === "date") {
        if (inBulletList) {
          html += "</ul>"
          inBulletList = false
        }
        const dateFontSize = style.baseFontSize
        const withDuration = appendDuration
          ? formatEmploymentDateWithDuration(parsed.text, { language: durationLang })
          : parsed.text
        const durationMatch =
          appendDuration && withDuration.length > parsed.text.length
            ? withDuration.slice(parsed.text.length).match(/^\s*(\([^)]+\))$/)
            : null
        const dateHtml = durationMatch
          ? `${inlineHtml(parsed.text)}<span style="color:#888888;font-style:italic;">${escapeHtmlText(durationMatch[1])}</span>`
          : inlineHtml(withDuration)
        html += `<p style="font-size: ${dateFontSize}px; font-weight: 400; margin: ${style.bulletMargin}px 0; color: #666666; font-style: italic; line-height: ${style.lineHeight}; overflow-wrap:anywhere; word-break:normal;">${dateHtml}</p>`
        continue
      }

      if (parsed.kind === "company") {
        if (inBulletList) {
          html += "</ul>"
          inBulletList = false
        }
        const companyFontSize = style.baseFontSize + 2
        html += `<p style="font-size: ${companyFontSize}px; font-weight: 700; margin: ${style.bulletMargin}px 0; color: #000000; line-height: ${style.lineHeight};">${inlineHtml(parsed.text)}</p>`
        continue
      }

      if (parsed.kind === "job-title") {
        if (inBulletList) {
          html += "</ul>"
          inBulletList = false
        }
        const titleFontSize = style.baseFontSize + 4
        const textTransform = style.headerStyle === "uppercase" ? "uppercase" : "none"
        const workType = resolveExperienceWorkType({
          lineWorkType: parsed.workType,
          sectionIsParallelWork: options?.sectionIsParallelWork === true,
        })
        const badge = renderParallelWorkBadgeHtml({
          workType,
          accentColor: accentColorForHTML,
          language: workLang,
          fontSizePx: titleFontSize,
        })
        html += `<p style="font-size: ${titleFontSize}px; font-weight: ${style.headerWeight}; margin: ${style.sectionSpacing / 2}px 0 ${style.bulletMargin}px 0; color: ${accentColorForHTML}; text-transform: ${textTransform}; line-height: ${style.lineHeight};">${inlineHtml(parsed.text)}${badge}</p>`
        continue
      }

      if (parsed.kind === "bullet") {
        if (!inBulletList) {
          html += `<ul style="margin: ${style.bulletMargin}px 0; padding-left: 0; list-style-type: none;">`
          inBulletList = true
        }

        let bulletSymbol = "•"
        let bulletColor = "#000000"
        let bulletSize = "1em"

        if (humanFormatStyle === "executive-compact") {
          bulletSymbol = "○"
          bulletColor = "#666666"
          bulletSize = "0.7em"
        } else if (humanFormatStyle === "modern-spacious") {
          bulletSymbol = "■"
          bulletColor = accentColorForHTML
          bulletSize = "0.6em"
        }

        html += `<li style="margin: ${style.bulletMargin / 2}px 0; padding-left: ${style.bulletIndent}px; line-height: ${style.lineHeight}; position: relative;">`
        html += `<span style="position: absolute; left: 0; top: 0; line-height: ${style.lineHeight}; font-size: ${bulletSize}; color: ${bulletColor};">${bulletSymbol}</span>`
        html += inlineHtml(parsed.text)
        html += `</li>`
        continue
      }

      if (inBulletList) {
        html += "</ul>"
        inBulletList = false
      }
      if (!parsed.text) continue
      html += `<p style="font-size: ${style.baseFontSize}px; margin: ${style.bulletMargin}px 0; line-height: ${style.lineHeight}; color: #000000;">${inlineHtml(parsed.text)}</p>`
    }

    if (inBulletList) {
      html += "</ul>"
    }

    return html
  }

  const markdownTableRenderOptions = () => {
    const style = formatStyles[humanFormatStyle]
    return {
      fontSize: style.baseFontSize || 14,
      lineHeight: style.lineHeight || 1.45,
      linkColor: hexAccentColor,
      accentColor: hexAccentColor,
      tableAccentStyle:
        displayVersion.contactInfo.tableAccentStyle === "off" ||
        displayVersion.contactInfo.tableAccentStyle === "strong"
          ? displayVersion.contactInfo.tableAccentStyle
          : "subtle",
    }
  }

  /** Inline / non-split render: one complete table with a single header row. */
  const renderMarkdownTable = (table: ParsedMarkdownTable): string =>
    renderMarkdownTableHtmlFull(table, markdownTableRenderOptions())

  const renderUniversalMarkdown = (
    lines: string[],
    options?: {
      showEmploymentDuration?: boolean
      sectionIsParallelWork?: boolean
    },
  ): string => {
    const renderLines = (chunk: string[]) => renderUniversalMarkdownLines(chunk, options)
    return renderHtmlWithMarkdownTables(
      lines,
      (chunk) =>
        renderHtmlWithColumnBlocks(
          chunk,
          renderLines,
          (columnLines, columns) =>
            renderCVColumnBlocksHtml(
              columnLines.map((column) => renderLines(column)),
              columns,
            ),
        ),
      renderMarkdownTable,
    )
  }

  const renderDefaultHTML = (lines: string[]): string => {
    return renderUniversalMarkdown(lines)
  }

  const getColumnBulletStyle = (): ColumnListBulletStyle => {
    const style = formatStyles[humanFormatStyle]
    let bulletSymbol = "•"
    let bulletColor = "#000000"
    let bulletSize = "1em"

    if (humanFormatStyle === "executive-compact") {
      bulletSymbol = "○"
      bulletColor = "#666666"
      bulletSize = "0.7em"
    } else if (humanFormatStyle === "modern-spacious") {
      bulletSymbol = "■"
      bulletColor = hexAccentColor
      bulletSize = "0.6em"
    }

    return {
      symbol: bulletSymbol,
      color: bulletColor,
      size: bulletSize,
      bulletMargin: style.bulletMargin,
      bulletIndent: style.bulletIndent,
      lineHeight: style.lineHeight,
      fontSize: style.baseFontSize,
      linkColor: hexAccentColor,
    }
  }

  const renderColumnSectionHTML = (
    section: Pick<ParsedResumeSection, "title" | "content" | "columns">,
    lines: string[],
  ): string => {
    const columnCount = resolveSectionColumnCount(section)
    if (columnCount <= 1) {
      return renderDefaultHTML(lines)
    }

    // ZERTIFIKATE / EDUCATION / similar: lay out ## entry blocks in columns
    if (sectionHasStructuredEntries(lines)) {
      const blocks = splitSectionIntoEntryBlocks(lines)
      if (blocks.length >= 2) {
        const blockHtmls = blocks.map((block) => renderUniversalMarkdown(block))
        return renderCVColumnBlocksHtml(blockHtmls, columnCount as 2 | 3)
      }
    }

    const items = parseTwoColumnSectionItems(lines)
    if (items.length === 0) {
      return renderDefaultHTML(lines)
    }

    return renderCVColumnListHtml(items, columnCount as 2 | 3, getColumnBulletStyle())
  }

  const renderExperienceHTML = (
    lines: string[],
    options?: {
      showEmploymentDuration?: boolean
      sectionIsParallelWork?: boolean
    },
  ): string => {
    return renderUniversalMarkdown(lines, options)
  }

  const renderEducationHTML = (lines: string[]): string => {
    return renderUniversalMarkdown(lines)
  }

  const renderProfileHTML = (lines: string[]): string => {
    return renderUniversalMarkdown(lines)
  }

  /** Only small units — never whole sections, skills grids, or experience lists. */
  const PDF_KEEP_TOGETHER_BLOCKS = new Set([
    "job-head",
    "skill-item",
    "education-entry",
    "table-head",
    "table-row",
    "career-evolution",
  ])

  const wrapPdfBlock = (kind: string, html: string, continuation = false) => {
    const keepClass = PDF_KEEP_TOGETHER_BLOCKS.has(kind) ? " pdf-block-keep-together" : ""
    const contClass = continuation ? " pdf-job-continuation" : ""
    return `<div data-pdf-block="${kind}" class="pdf-resume-block${keepClass}${contClass}">${html}</div>`
  }

  const pushMarkdownTablePdfChunks = (
    parts: string[],
    table: ParsedMarkdownTable,
    wrapBody: (body: string) => string,
  ) => {
    for (const chunk of buildMarkdownTablePdfChunks(table, markdownTableRenderOptions())) {
      const body = wrapBody(chunk.html)
      if (!body.trim()) continue
      parts.push(wrapPdfBlock(chunk.kind, body, chunk.continuation))
    }
  }

  const pushEntryPdfChunks = (
    parts: string[],
    entryLines: string[],
    renderEntry: (lines: string[]) => string,
    wrapBody: (body: string) => string,
    options?: { entryKind?: "job-head" | "education-entry" },
  ): number => {
    const chunks = splitEntryLinesIntoPdfChunks(entryLines)
    const headKind = options?.entryKind ?? "job-head"
    let pushed = 0
    for (const chunk of chunks) {
      const body = wrapBody(renderEntry(chunk.lines))
      if (!body.trim()) continue
      const kind = chunk.kind === "job-head" ? headKind : chunk.kind
      parts.push(wrapPdfBlock(kind, body, chunk.continuation))
      pushed += 1
    }
    return pushed
  }

  /** Skills / tools: one PDF block per item so the grid never moves as one slab. */
  const renderSkillItemsPdfBlocks = (
    sectionTitleHTML: string,
    items: string[],
    sectionMargin: string,
    wrapBody?: (body: string) => string,
  ): string => {
    const wrap = wrapBody ?? ((body: string) => body)
    const bullet = getColumnBulletStyle()
    const parts: string[] = []
    if (sectionTitleHTML) {
      parts.push(wrapPdfBlock("section-title", sectionTitleHTML))
    }
    for (const item of items) {
      const html = wrap(renderCVColumnListItemHtml(item, bullet))
      if (!html.trim()) continue
      parts.push(wrapPdfBlock("skill-item", html))
    }
    return `<div class="resume-section-block" style="margin-bottom: ${sectionMargin};">${parts.join("")}</div>`
  }

  /**
   * Shared Experience role chrome — thin accent rail for every role (multi- and
   * single-employer). Not Bundesdruckerei-specific.
   */
  const wrapExperienceRoleRail = (body: string): string => {
    if (!body.trim()) return ""
    return `<div class="cv-role-rail" data-cv-role-rail="1" style="border-left:2px solid ${hexAccentColor};padding:0 0 0 10px;margin:4px 0 8px 0;">${body}</div>`
  }

  /**
   * Employer name (and overall tenure for multi-role groups) — always ABOVE and
   * OUTSIDE the green role rail. Shared for single- and multi-role employers.
   */
  const renderEmployerHeadingHtml = (group: ExperienceEmployerGroup): string => {
    const style = formatStyles[humanFormatStyle]
    const name = formatEmployerDisplayName(group.company)
    if (!name) return ""
    const durationLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
    // Multi-role: show overall employment span under the employer (not inside the rail).
    // Single-role: name only — role dates stay inside the rail to avoid duplication.
    const tenure = isMultiRoleEmployerGroup(group)
      ? overallEmploymentDateLabel(group, durationLang)
      : null
    const nameSize = style.baseFontSize + 2
    const tenureSize = Math.max(9, style.baseFontSize - 0.5)
    return `<div class="cv-employer-heading" data-cv-employer-heading="1" style="margin:0 0 6px 0;padding:0;">
      <p style="font-size:${nameSize}px;font-weight:700;margin:0;color:#000000;line-height:${style.lineHeight};">${escapeHtmlText(name)}</p>
      ${
        tenure
          ? `<p style="font-size:${tenureSize}px;font-weight:400;margin:2px 0 0 0;color:#666666;line-height:${style.lineHeight};">${escapeHtmlText(tenure)}</p>`
          : ""
      }
    </div>`
  }

  /**
   * One Experience role rail. Optional employer heading is prepended to the first
   * job-head chunk so pagination never orphans the heading at the page bottom.
   */
  const pushExperienceRolePdfChunks = (
    parts: string[],
    roleLines: string[],
    renderJob: (lines: string[]) => string,
    wrapBody: (body: string) => string,
    options?: { employerHeadingHtml?: string },
  ): number => {
    const chunks = splitEntryLinesIntoPdfChunks(roleLines)
    const heading = options?.employerHeadingHtml?.trim() || ""
    let headingPlaced = !heading
    let pushed = 0

    for (const chunk of chunks) {
      const roleHtml = wrapExperienceRoleRail(renderJob(chunk.lines))
      if (!roleHtml.trim()) continue
      const includeHeading = !headingPlaced
      const body = wrapBody(includeHeading ? `${heading}${roleHtml}` : roleHtml)
      if (!body.trim()) continue
      if (includeHeading) headingPlaced = true
      const kind = chunk.kind === "job-head" || includeHeading ? "job-head" : chunk.kind
      parts.push(wrapPdfBlock(kind, body, chunk.continuation && !includeHeading))
      pushed += 1
    }
    return pushed
  }

  /**
   * Employer heading outside the rail (when company known); each role in a rail
   * with title → dates → bullets. Same hierarchy for single- and multi-role.
   */
  const pushEmployerGroupPdfChunks = (
    parts: string[],
    group: ExperienceEmployerGroup,
    renderJob: (lines: string[]) => string,
    wrapBody: (body: string) => string,
  ): number => {
    const roleBlocks = buildEmployerGroupRoleBlocks(group)
    if (roleBlocks.length === 0) return 0

    const heading = hasEmployerHeading(group) ? renderEmployerHeadingHtml(group) : ""
    let pushed = 0
    let headingAttached = false
    for (const roleLines of roleBlocks) {
      pushed += pushExperienceRolePdfChunks(parts, roleLines, renderJob, wrapBody, {
        employerHeadingHtml: !headingAttached && heading ? heading : undefined,
      })
      headingAttached = true
    }
    return pushed
  }

  const renderExperiencePdfBlocks = (
    sectionTitleHTML: string,
    content: string[],
    renderJob: (lines: string[]) => string,
    sectionMargin: string,
    wrapJobBody?: (body: string) => string,
    options?: { showEmploymentDuration?: boolean; organizeByEmployer?: boolean },
  ): string => {
    const wrapBody = wrapJobBody ?? ((body: string) => body)
    const segments = splitContentIntoSegments(content)
    const parts: string[] = []
    let sectionTitlePlaced = false
    const organize = options?.organizeByEmployer !== false
    const durationLang = displayVersion.contactInfo.language === "de" ? "de" : "en"

    const ensureTitle = () => {
      if (!sectionTitlePlaced && sectionTitleHTML) {
        parts.push(wrapPdfBlock("section-title", sectionTitleHTML))
        sectionTitlePlaced = true
      }
    }

    for (const seg of segments) {
      if (seg.type === "manual-page-break") {
        parts.push(
          wrapPdfBlock("manual-page-break-preference", PDF_MANUAL_PAGE_BREAK_PREFERENCE_HTML),
        )
        continue
      }

      for (const piece of splitLinesByMarkdownTables(seg.lines)) {
        if (piece.type === "table") {
          const staging: string[] = []
          pushMarkdownTablePdfChunks(staging, piece.table, wrapBody)
          if (staging.length === 0) continue
          ensureTitle()
          parts.push(...staging)
          continue
        }

        // Always organise when enabled so every role (single or multi) uses the
        // shared ExperienceRole rail — not only multi-role employers.
        if (organize) {
          const groups = organizeExperienceLines(piece.lines, { language: durationLang })
          for (const group of groups) {
            const staging: string[] = []
            const count = pushEmployerGroupPdfChunks(staging, group, renderJob, wrapBody)
            if (count === 0) continue
            ensureTitle()
            parts.push(...staging)
          }
          continue
        }

        const jobBlocks = splitExperienceLinesIntoJobs(piece.lines).map((jobLines) =>
          orderExperienceRoleDisplayLines(jobLines),
        )

        for (const jobLines of jobBlocks) {
          const staging: string[] = []
          const count = pushExperienceRolePdfChunks(staging, jobLines, renderJob, wrapBody)
          if (count === 0) continue
          ensureTitle()
          parts.push(...staging)
        }
      }
    }

    if (!sectionTitlePlaced && sectionTitleHTML) {
      parts.push(wrapPdfBlock("section-title", sectionTitleHTML))
    }

    return `<div class="resume-section-block" style="margin-bottom: ${sectionMargin};">${parts.join("")}</div>`
  }

  const renderSectionPdfBlocks = (
    sectionTitleHTML: string,
    content: string[],
    renderLines: (lines: string[]) => string,
    sectionMargin: string,
    wrapBody?: (body: string) => string,
    options?: { allowBulletSplit?: boolean },
  ): string => {
    const wrap = wrapBody ?? ((body: string) => body)
    const allowBulletSplit = options?.allowBulletSplit !== false
    const segments = splitContentIntoSegments(content)
    const parts: string[] = []
    let sectionTitlePlaced = false

    const ensureTitle = () => {
      if (!sectionTitlePlaced && sectionTitleHTML) {
        parts.push(wrapPdfBlock("section-title", sectionTitleHTML))
        sectionTitlePlaced = true
      }
    }

    for (const seg of segments) {
      if (seg.type === "manual-page-break") {
        parts.push(
          wrapPdfBlock("manual-page-break-preference", PDF_MANUAL_PAGE_BREAK_PREFERENCE_HTML),
        )
        continue
      }

      for (const piece of splitLinesByMarkdownTables(seg.lines)) {
        if (piece.type === "table") {
          const staging: string[] = []
          pushMarkdownTablePdfChunks(staging, piece.table, wrap)
          if (staging.length === 0) continue
          ensureTitle()
          parts.push(...staging)
          continue
        }

        const useSplit =
          allowBulletSplit &&
          (sectionHasStructuredEntries(piece.lines) ||
            piece.lines.filter(isPdfBulletLine).length > 4)

        if (useSplit) {
          const entries = sectionHasStructuredEntries(piece.lines)
            ? splitSectionIntoEntryBlocks(piece.lines)
            : [piece.lines]
          const asEducation = sectionHasStructuredEntries(piece.lines)
          for (const entryLines of entries) {
            const staging: string[] = []
            const count = pushEntryPdfChunks(staging, entryLines, renderLines, wrap, {
              entryKind: asEducation ? "education-entry" : "job-head",
            })
            if (count === 0) continue
            ensureTitle()
            parts.push(...staging)
          }
          continue
        }

        // Flat short lists: still split title from body so headings are not glued
        // to an unsplittable slab that leaves blank space on the previous page.
        ensureTitle()
        const body = wrap(renderLines(piece.lines))
        if (!body.trim()) continue
        parts.push(wrapPdfBlock("section", body))
      }
    }

    if (parts.length === 0 && sectionTitleHTML) {
      parts.push(wrapPdfBlock("section-start", sectionTitleHTML))
    }

    return `<div class="resume-section-block" style="margin-bottom: ${sectionMargin};">${parts.join("")}</div>`
  }

  /** Non-experience sections: per-item skills blocks; never one atomic multi-column slab. */
  const renderNonExperiencePdfSection = (
    section: ParsedResumeSection,
    sectionTitleHTML: string,
    sectionMargin: string,
    wrapBody?: (body: string) => string,
  ): string => {
    const columnCount = resolveSectionColumnCount(section)
    if (columnCount > 1 && !sectionHasStructuredEntries(section.content)) {
      const items = parseTwoColumnSectionItems(section.content)
      if (items.length > 0) {
        return renderSkillItemsPdfBlocks(sectionTitleHTML, items, sectionMargin, wrapBody)
      }
    }
    return renderSectionPdfBlocks(
      sectionTitleHTML,
      section.content,
      resolveSectionLineRenderer(section),
      sectionMargin,
      wrapBody,
      { allowBulletSplit: true },
    )
  }

  const isPageBreakSectionTitle = (title: string) => isManualPageBreakLine(title.trim())

  const renderFullResumeHTML = (sections: ParsedResumeSection[], includeHeader = true): PdfViewParts => {
    const style = formatStyles[humanFormatStyle]
    const name = displayVersion.contactInfo.name || "Your Name"
    const professionalTitle = displayVersion.contactInfo.professionalTitle || ""
    
    const labels =
      displayVersion.contactInfo.language === "de"
        ? {
            email: "E-Mail",
            linkedin: "LinkedIn",
            phone: "Telefon",
            citizenship: "Staatsangehörigkeit",
            portfolio: "Portfolio",
            location: "Wohnort",
          }
        : {
            email: "Email",
            linkedin: "LinkedIn",
            phone: "Phone",
            citizenship: "Citizenship",
            portfolio: "Portfolio",
            location: "Location",
          }

    // Company logo beside target company / role (all human styles share this).
    // object-fit:contain keeps aspect ratio; never crops. Shown only when a logo exists.
    const renderTargetBannerLogoHtml = (maxWidthPx: number, maxHeightPx: number) => {
      const src = version.companyLogo?.trim()
      if (!src) return ""
      return `<div style="flex-shrink: 0; max-width: ${maxWidthPx}px; line-height: 0;"><img src="${src}" alt="" crossorigin="anonymous" style="display:block; max-width: ${maxWidthPx}px; max-height: ${maxHeightPx}px; width: auto; height: auto; object-fit: contain; background:#ffffff; padding:2px; border-radius:4px;" /></div>`
    }

    /**
     * Profile avatar with optional accent border.
     * Always reserves the same border width (transparent when off) so toggling
     * does not shift layout; box-sizing keeps outer dimensions stable.
     */
    const renderProfileAvatarHtml = (opts: {
      sizePx: number
      borderWidthPx: number
      borderRadius: string
    }) => {
      const src = version.profileImage?.trim()
      if (!src) return ""
      const showBorder = version.profilePhotoBorder !== false
      const borderColor = showBorder ? hexAccentColor : "transparent"
      return `<img src="${src}" alt="Profile" crossorigin="anonymous" style="box-sizing: border-box; width: ${opts.sizePx}px; height: ${opts.sizePx}px; border-radius: ${opts.borderRadius}; object-fit: cover; border: ${opts.borderWidthPx}px solid ${borderColor};" />`
    }

    // ====== FORMAT 1: PROFILE-ENHANCED DESIGN ======
    // Compact header (photo ~70px, name ~26pt); professional summary stays visually prominent.
    if (humanFormatStyle === "current") {
      const profileImageSize = 70
      const nameFontSize = 26
      const contactFontSize = 9.5
      const titleFontSize = 12
      const sectionHeaderSize = 13

      const profileImageHTML = renderProfileAvatarHtml({
        sizePx: profileImageSize,
        borderWidthPx: 1.5,
        borderRadius: "50%",
      })

      const contactChips: string[] = []
      if (displayVersion.contactInfo.email) {
        contactChips.push(
          `<span style="white-space: nowrap;">${labels.email}: ${displayVersion.contactInfo.email}</span>`,
        )
      }
      if (displayVersion.contactInfo.phone) {
        contactChips.push(
          `<span style="white-space: nowrap;">${labels.phone}: ${displayVersion.contactInfo.phone}</span>`,
        )
      }
      if (displayVersion.contactInfo.address) {
        contactChips.push(
          `<span>${labels.location}: ${displayVersion.contactInfo.address}</span>`,
        )
      }
      if (displayVersion.contactInfo.linkedin) {
        const href = displayVersion.contactInfo.linkedin.startsWith("http")
          ? displayVersion.contactInfo.linkedin
          : `https://${displayVersion.contactInfo.linkedin}`
        contactChips.push(
          `<span style="white-space: nowrap;">${labels.linkedin}: <a href="${href}" target="_blank" rel="noopener noreferrer" style="color: ${hexAccentColor}; text-decoration: underline;">LinkedIn</a></span>`,
        )
      }
      if (displayVersion.contactInfo.citizenship) {
        contactChips.push(
          `<span style="white-space: nowrap;">${labels.citizenship}: ${displayVersion.contactInfo.citizenship}</span>`,
        )
      }
      const portfolioUrls = visiblePortfolioUrls(displayVersion.contactInfo)
      if (portfolioUrls.length) {
        contactChips.push(
          `<span>${labels.portfolio}: ${portfolioLinksJoinedHtml(portfolioUrls, hexAccentColor)}</span>`,
        )
      }

      const headerHTML = `
        <div data-cv-header="profile-enhanced" style="display: flex; gap: 14px; align-items: flex-start; margin: 0 0 12px 0; padding: 0 0 10px 0; border-bottom: 1.5px solid ${hexAccentColor}; min-height: 0; max-height: 34mm;">
          ${profileImageHTML ? `<div style="flex-shrink: 0; line-height: 0;">${profileImageHTML}</div>` : ""}
          <div style="flex: 1; min-width: 0;">
            <h1 style="font-size: ${nameFontSize}px; font-weight: 600; margin: 0 0 2px 0; color: #000000; line-height: 1.15; letter-spacing: -0.01em; overflow-wrap: anywhere; word-break: normal; hyphens: auto;">${name}</h1>
            ${professionalTitle ? `<p style="font-size: ${titleFontSize}px; font-weight: 600; margin: 0 0 6px 0; color: ${hexAccentColor}; line-height: 1.3;">${professionalTitle}</p>` : ""}
            ${
              contactChips.length
                ? `<div style="display: flex; flex-wrap: wrap; gap: 3px 12px; align-items: baseline; font-size: ${contactFontSize}px; line-height: 1.35; color: #333333;">${contactChips.join("")}</div>`
                : ""
            }
          </div>
        </div>
      `

      const targetBgColor = version.targetBoxBgColor || "#f8f9fa"
      const targetBorderColor = version.targetBoxBorderColor || hexAccentColor
      const targetLogoHTML = renderTargetBannerLogoHtml(64, 44)

      const applicationTargetHTML =
        displayVersion.contactInfo.targetCompany || displayVersion.contactInfo.targetRole
          ? `
        <div style="margin-bottom: 12px; padding: 10px 12px; background-color: ${targetBgColor}; border-left: 3px solid ${targetBorderColor}; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="flex: 1; min-width: 0;">
            ${renderTargetCompanyRoleHeadingHtml({
              company: displayVersion.contactInfo.targetCompany,
              role: displayVersion.contactInfo.targetRole,
              companyStyle: "font-size: 14px; font-weight: bold; color: #000000;",
              roleStyle: `font-size: ${titleFontSize}px; font-weight: 600; color: ${hexAccentColor};`,
              separatorStyle: "font-size: 14px; font-weight: bold; color: #000000;",
            })}
          </div>
          ${targetLogoHTML}
        </div>
      `
          : ""

      const columnStyle = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: ${style.baseFontSize}px; line-height: ${style.lineHeight}; color: #000000; background: transparent; padding: 0;`

      const sectionsHTML = sections
        .filter((section) => section.title !== "" && !isPageBreakSectionTitle(section.title))
        .map((section) => {
          const isProfile = isProfileSection(section.title)
          const sectionTitleHTML = section.title
            ? isProfile
              ? `<h2 style="font-size: ${sectionHeaderSize + 1}px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: 10px 0 8px 0; padding: 0 0 6px 0; border-bottom: 2px solid ${hexAccentColor}; color: #000000;">${section.title}</h2>`
              : `<h2 style="font-size: ${sectionHeaderSize}px; font-weight: bold; text-transform: uppercase; margin: ${style.sectionHeaderMargin}; padding-bottom: 6px; border-bottom: 2px solid ${hexAccentColor}; color: #000000;">${section.title}</h2>`
            : ""

          if (isCareerEvolutionSection(section.title)) {
            return renderCareerEvolutionSectionHtml(sectionTitleHTML, section.content)
          }

          if (isExperienceSection(section.title)) {
            return renderExperiencePdfBlocks(
              sectionTitleHTML,
              section.content,
              renderEmploymentAwareExperience(section.title),
              `${style.sectionSpacing}px`,
              undefined,
              experiencePdfOptions(section.title),
            )
          }

          // Profile summary: readable, visually distinct block under the compact header.
          // Must use wrapPdfBlock — auto-pagination only packs [data-pdf-block] nodes.
          if (isProfile) {
            const body = renderProfileHTML(section.content)
            const tinted = `<div data-profile-summary="1" style="padding: 10px 12px; background-color: ${hexAccentColor}0F; border-radius: 4px;">${sectionTitleHTML}<div style="font-size: 12.5px; line-height: 1.5; color: #1a1a1a;">${body}</div></div>`
            return `<div class="resume-section-block" style="margin-bottom: ${style.sectionSpacing}px;">${wrapPdfBlock("profile-summary", tinted)}</div>`
          }

          return renderNonExperiencePdfSection(
            section,
            sectionTitleHTML,
            `${style.sectionSpacing}px`,
          )
        })
        .join("")

      const headerMarked =
        includeHeader ? wrapPdfBlock("header", `${headerHTML}${applicationTargetHTML}`) : ""

      return {
        columnStyle,
        markedInner: `${headerMarked}${sectionsHTML}`,
      }
    }
    
    // ====== FORMAT 2: EXECUTIVE COMPACT ======
    if (humanFormatStyle === "executive-compact") {
      // Avatar: Small (60px), square with rounded corners, LEFT of name
      // Company logo: beside target company / role in the application banner
      // Name: Large, bold, ALL CAPS
      // Job title tagline: Centered below name, italic, colored
      // Contact info: Horizontal row with icons, below everything
      // Section headers: Uppercase, no underline, colored background bar
      // Bullet points: Small circles
      
    const profileImageHTML = renderProfileAvatarHtml({
      sizePx: 60,
      borderWidthPx: 2,
      borderRadius: "8px",
    })
      
      // Build contact items for horizontal row
      const contactItems: string[] = []
      if (displayVersion.contactInfo.email) contactItems.push(`<span style="display: inline-flex; align-items: center; gap: 4px;">&#9993; ${displayVersion.contactInfo.email}</span>`)
      if (displayVersion.contactInfo.phone) contactItems.push(`<span style="display: inline-flex; align-items: center; gap: 4px;">&#9742; ${displayVersion.contactInfo.phone}</span>`)
      if (displayVersion.contactInfo.address) contactItems.push(`<span style="display: inline-flex; align-items: center; gap: 4px;">&#9906; ${displayVersion.contactInfo.address}</span>`)
      if (displayVersion.contactInfo.linkedin) contactItems.push(`<span style="display: inline-flex; align-items: center; gap: 4px;">&#128279; <a href="${displayVersion.contactInfo.linkedin.startsWith("http") ? displayVersion.contactInfo.linkedin : `https://${displayVersion.contactInfo.linkedin}`}" target="_blank" style="color: ${hexAccentColor}; text-decoration: none;">LinkedIn</a></span>`)
      const portfolioUrls = visiblePortfolioUrls(displayVersion.contactInfo)
      if (portfolioUrls.length > 0) {
        contactItems.push(
          `<span style="display: inline-flex; align-items: center; gap: 4px;">&#127760; ${portfolioLinksJoinedHtml(portfolioUrls, hexAccentColor, "color: " + hexAccentColor + "; text-decoration: none;")}</span>`,
        )
      }
      
      const headerHTML = `
        <div data-cv-header="executive-compact" style="margin-bottom: 16px;">
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 8px;">
            ${profileImageHTML}
            <div>
              <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: #000000; text-transform: uppercase; letter-spacing: 2px; line-height: 1.2;">${name}</h1>
            </div>
          </div>
          ${professionalTitle ? `<p style="font-size: 14px; font-weight: 500; margin: 8px 0; color: ${hexAccentColor}; font-style: italic; text-align: center; line-height: 1.4;">${professionalTitle}</p>` : ""}
          ${contactItems.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; font-size: 10px; color: #444444; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">${contactItems.join("")}</div>` : ""}
        </div>
      `
      
      // Use Target box style settings (not accent tint). Accent stays on role text / headings.
      const targetBgColor = version.targetBoxBgColor || "#f8f9fa"
      const targetBorderColor = version.targetBoxBorderColor || hexAccentColor
      const targetLogoHTML = renderTargetBannerLogoHtml(64, 40)
      const applicationTargetHTML =
        displayVersion.contactInfo.targetCompany || displayVersion.contactInfo.targetRole
          ? `
        <div style="margin-bottom: 12px; padding: 8px 12px; background-color: ${targetBgColor}; border-left: 4px solid ${targetBorderColor}; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="flex: 1; min-width: 0;">
            ${renderTargetCompanyRoleHeadingHtml({
              company: displayVersion.contactInfo.targetCompany,
              role: displayVersion.contactInfo.targetRole,
              companyStyle: "font-size: 12px; font-weight: bold; color: #000000;",
              roleStyle: `font-size: 12px; font-weight: 600; color: ${hexAccentColor};`,
              separatorStyle: "font-size: 12px; font-weight: bold; color: #000000;",
            })}
          </div>
          ${targetLogoHTML}
        </div>
      `
          : ""
      
      const columnStyle = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: ${style.baseFontSize}px; line-height: ${style.lineHeight}; color: #000000; background: transparent; padding: 0;`

      const sectionsHTML = sections
        .filter((section) => section.title !== "" && !isPageBreakSectionTitle(section.title))
        .map((section) => {
          const sectionTitleHTML = section.title
            ? `<h2 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 12px 0 8px 0; padding: 4px 8px; background-color: ${hexAccentColor}20; color: #000000; border-left: 3px solid ${hexAccentColor};">${section.title}</h2>`
            : ""

          if (isCareerEvolutionSection(section.title)) {
            return renderCareerEvolutionSectionHtml(sectionTitleHTML, section.content)
          }

          if (isExperienceSection(section.title)) {
            return renderExperiencePdfBlocks(
              sectionTitleHTML,
              section.content,
              renderEmploymentAwareExperience(section.title),
              "12px",
              undefined,
              experiencePdfOptions(section.title),
            )
          }

          return renderNonExperiencePdfSection(section, sectionTitleHTML, "12px")
        })
        .join("")

      const headerMarked =
        includeHeader ? wrapPdfBlock("header", `${headerHTML}${applicationTargetHTML}`) : ""

      return {
        columnStyle,
        markedInner: `${headerMarked}${sectionsHTML}`,
      }
    }
    
    // ====== FORMAT 3: MODERN SPACIOUS ======
    // Clean contemporary header: ~70px photo, ~28pt name, compact contact wrap,
    // thin accent divider — clarity without oversized empty space.
    // Section headers stay lowercase with accent underline (distinct from other styles).
    // Bullet points: Colored squares

    const profileImageHTML = renderProfileAvatarHtml({
      sizePx: 72,
      borderWidthPx: 1.5,
      borderRadius: "50%",
    })

    const contactItems: string[] = []
    if (displayVersion.contactInfo.email) {
      contactItems.push(
        `<span style="white-space: nowrap;">${displayVersion.contactInfo.email}</span>`,
      )
    }
    if (displayVersion.contactInfo.phone) {
      contactItems.push(
        `<span style="white-space: nowrap;">${displayVersion.contactInfo.phone}</span>`,
      )
    }
    if (displayVersion.contactInfo.address) {
      contactItems.push(`<span>${displayVersion.contactInfo.address}</span>`)
    }
    if (displayVersion.contactInfo.linkedin) {
      const href = displayVersion.contactInfo.linkedin.startsWith("http")
        ? displayVersion.contactInfo.linkedin
        : `https://${displayVersion.contactInfo.linkedin}`
      contactItems.push(
        `<span style="white-space: nowrap;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="color: ${hexAccentColor}; text-decoration: none;">LinkedIn</a></span>`,
      )
    }
    const portfolioUrls = visiblePortfolioUrls(displayVersion.contactInfo)
    if (portfolioUrls.length > 0) {
      contactItems.push(
        `<span>${portfolioLinksJoinedHtml(portfolioUrls, hexAccentColor, "color: " + hexAccentColor + "; text-decoration: none;")}</span>`,
      )
    }

    const headerHTML = `
      <div data-cv-header="modern-spacious" style="display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: center; margin: 0 0 12px 0; padding: 0 0 10px 0; border-bottom: 1.5px solid ${hexAccentColor}; min-height: 0; max-height: 34mm;">
        ${profileImageHTML ? `<div style="flex-shrink: 0; line-height: 0;">${profileImageHTML}</div>` : ""}
        <div style="flex: 1 1 220px; min-width: 0;">
          <h1 style="font-size: 28px; font-weight: 500; margin: 0 0 2px 0; color: #000000; line-height: 1.12; letter-spacing: -0.015em; overflow-wrap: anywhere; word-break: normal;">${name.toLowerCase()}</h1>
          ${professionalTitle ? `<p style="font-size: 13px; font-weight: 600; margin: 0 0 6px 0; color: #111111; line-height: 1.3;">${professionalTitle}</p>` : ""}
          ${
            contactItems.length
              ? `<div style="display: flex; flex-wrap: wrap; gap: 3px 14px; align-items: baseline; font-size: 9.5px; line-height: 1.35; color: #444444;">${contactItems.join("")}</div>`
              : ""
          }
        </div>
      </div>
    `

    const targetBgColor = version.targetBoxBgColor || "#fafafa"
    const targetBorderColor = version.targetBoxBorderColor || hexAccentColor
    const targetLogoHTML = renderTargetBannerLogoHtml(72, 48)

    const applicationTargetHTML =
      displayVersion.contactInfo.targetCompany || displayVersion.contactInfo.targetRole
        ? `
      <div style="margin-bottom: 14px; padding: 10px 14px; background-color: ${targetBgColor}; border-left: 3px solid ${targetBorderColor}; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="flex: 1; min-width: 0;">
          ${renderTargetCompanyRoleHeadingHtml({
            company: displayVersion.contactInfo.targetCompany,
            role: displayVersion.contactInfo.targetRole,
            companyStyle: "font-size: 15px; font-weight: 400; color: #000000;",
            roleStyle: "font-size: 13px; font-weight: 600; color: #000000;",
            separatorStyle: "font-size: 15px; font-weight: 400; color: #000000;",
          })}
        </div>
        ${targetLogoHTML}
      </div>
    `
        : ""

    const columnStyle = `font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: ${style.baseFontSize}px; line-height: ${style.lineHeight}; color: #000000; background: transparent; padding: 0;`

    const sectionsHTML = sections
      .filter((section) => section.title !== "" && !isPageBreakSectionTitle(section.title))
      .map((section) => {
        const sectionTitleHTML = section.title
          ? `<h2 style="font-size: 13px; font-weight: 500; text-transform: lowercase; margin: 16px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid ${hexAccentColor}; color: #000000; display: inline-block;">${section.title.toLowerCase()}</h2>`
          : ""

        if (isCareerEvolutionSection(section.title)) {
          return renderCareerEvolutionSectionHtml(sectionTitleHTML, section.content)
        }

        if (isExperienceSection(section.title)) {
          return renderExperiencePdfBlocks(
            sectionTitleHTML,
            section.content,
            renderEmploymentAwareExperience(section.title),
            `${style.sectionSpacing}px`,
            (body) => `<div style="clear: both;">${body}</div>`,
            experiencePdfOptions(section.title),
          )
        }

        return renderNonExperiencePdfSection(
          section,
          sectionTitleHTML,
          `${style.sectionSpacing}px`,
          (body) => `<div style="clear: both;">${body}</div>`,
        )
      })
      .join("")

    const headerMarked =
      includeHeader ? wrapPdfBlock("header", `${headerHTML}${applicationTargetHTML}`) : ""

    return {
      columnStyle,
      markedInner: `${headerMarked}${sectionsHTML}`,
    }
  }
  
  // Helper functions for section type detection
  const isExperienceSection = (title: string): boolean => {
    const key = normalizeCvSectionKey(title)
    if (key === "EXPERIENCE" || key === "PARALLEL_WORK" || key === "PROJECTS") return true
    const normalized = title.toUpperCase().trim()
    return (
      normalized.includes("ERFAHRUNG") ||
      normalized.includes("EXPERIENCE") ||
      normalized.includes("WERDEGANG") ||
      normalized.includes("PROJEKTE") ||
      normalized.includes("PROJECTS") ||
      normalized.includes("PARALLEL") ||
      normalized.includes("INDEPENDENT WORK") ||
      normalized.includes("NEBENBERUF")
    )
  }

  /** Employment + parallel independent work — not projects (duration toggle applies). */
  const isEmploymentExperienceSection = (title: string): boolean => {
    const key = normalizeCvSectionKey(title)
    if (key === "PROJECTS") return false
    if (key === "EXPERIENCE" || key === "PARALLEL_WORK") return true
    const normalized = title.toUpperCase().trim()
    if (normalized.includes("PROJEKT") || normalized.includes("PROJECT")) return false
    if (
      normalized.includes("PARALLEL") ||
      normalized.includes("INDEPENDENT WORK") ||
      normalized.includes("NEBENBERUF")
    ) {
      return true
    }
    return (
      normalized.includes("ERFAHRUNG") ||
      normalized.includes("EXPERIENCE") ||
      normalized.includes("WERDEGANG") ||
      normalized.includes("BERUF")
    )
  }

  const sectionIsParallelWorkTitle = (title: string): boolean => {
    const key = normalizeCvSectionKey(stripSectionColumnModifier(title))
    if (key === "PARALLEL_WORK") return true
    const normalized = stripSectionColumnModifier(title).toUpperCase().trim()
    return (
      normalized.includes("PARALLEL") ||
      normalized.includes("INDEPENDENT WORK") ||
      normalized.includes("NEBENBERUF")
    )
  }

  const renderEmploymentAwareExperience = (sectionTitle: string) => (lines: string[]) =>
    renderExperienceHTML(lines, {
      showEmploymentDuration:
        displayVersion.contactInfo.showEmploymentDuration === true &&
        isEmploymentExperienceSection(sectionTitle),
      sectionIsParallelWork: sectionIsParallelWorkTitle(sectionTitle),
    })

  const experiencePdfOptions = (sectionTitle: string) => ({
    showEmploymentDuration:
      displayVersion.contactInfo.showEmploymentDuration === true &&
      isEmploymentExperienceSection(sectionTitle),
    organizeByEmployer: isEmploymentExperienceSection(sectionTitle),
    sectionIsParallelWork: sectionIsParallelWorkTitle(sectionTitle),
  })

  const isCareerEvolutionSection = (title: string): boolean =>
    isCareerEvolutionSectionTitle(title)

  const careerEvolutionConfig = resolveCareerEvolutionConfig(
    displayVersion.contactInfo.careerEvolution,
    displayVersion.resumeText || "",
  )

  // ATS Optimized PDF omits the graph; Standard/High keep it when visible.
  // Preview on screen still shows the graph when enabled (human readers).
  const renderCareerEvolutionForExport = shouldRenderCareerEvolutionInPdf(
    pdfExportPreset,
    careerEvolutionConfig,
  )
  const hasCareerEvolutionPreviewContent =
    careerEvolutionConfig.milestones.length > 0 ||
    (careerEvolutionConfig.layout === "alignment" &&
      ((careerEvolutionConfig.alignments?.length || 0) > 0 ||
        Boolean(careerEvolutionConfig.alignmentSourceText?.trim()))) ||
    (careerEvolutionConfig.layout === "convergence" &&
      (careerEvolutionConfig.capabilities || []).filter((c) =>
        Boolean(c.label?.trim()),
      ).length >= 2)
  const renderCareerEvolutionForPreview =
    variant === "export"
      ? renderCareerEvolutionForExport
      : careerEvolutionConfig.visible === true && hasCareerEvolutionPreviewContent

  const viewSections = placeCareerEvolutionInSections(
    parsedViewSections,
    renderCareerEvolutionForPreview
      ? careerEvolutionConfig
      : { ...careerEvolutionConfig, visible: false },
    () => ({
      title: "CAREER EVOLUTION",
      content: [] as string[],
    }),
  )

  const renderCareerEvolutionSectionHtml = (sectionTitleHTML: string, _content: string[]) => {
    if (!renderCareerEvolutionForPreview) {
      return ""
    }
    // Ignore markdown body — graph comes only from contactInfo config (never re-parse TRACK text here).
    void _content
    let svg = ""
    try {
      svg = renderCareerEvolutionSvgHtml(careerEvolutionConfig, {
        accentColor: hexAccentColor,
        language: displayVersion.contactInfo.language === "de" ? "de" : "en",
        // Fit within typical A4 content column (~170mm usable ≈ 480 CSS px).
        width: 480,
        resumeText: displayVersion.resumeText || "",
      })
    } catch (err) {
      // Defense in depth — renderCareerEvolutionSvgHtml already catches internally.
      console.error("[career-evolution] preview render failed:", err)
      const message =
        err instanceof Error ? err.message : "Career Evolution graph could not be rendered."
      svg = `<div class="career-evolution-error-fallback" role="alert" style="margin:8px 0;padding:10px 12px;border:1px solid #d4a017;border-radius:4px;background:#fffbeb;color:#5c4a00;font-size:12px;line-height:1.4;"><p style="margin:0 0 4px;font-weight:600;">Career Evolution could not be displayed.</p><p style="margin:0;">${escapeHtml(message)}</p></div>`
    }
    if (!svg) return ""
    const titleBlock = sectionTitleHTML
      ? wrapPdfBlock("section-title", sectionTitleHTML)
      : ""
    // Single pdf block — figure itself must not also carry data-pdf-block.
    // Section wrapper must NOT use break-inside:avoid: that forced the whole
    // title+graph onto the next sheet and left a blank band after Selected
    // Evidence when print metrics differed slightly from JS pagination.
    // Keep-together lives on the figure / pdf-block only.
    const body = wrapPdfBlock("career-evolution", svg)
    return `<div class="resume-section-block" data-career-evolution-section="1" style="margin:2px 0 8px;overflow:visible;max-width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${titleBlock}${body}</div>`
  }
  
  const isEducationSection = (title: string): boolean => {
    const key = normalizeCvSectionKey(title)
    return key === "EDUCATION" || key === "CERTIFICATIONS"
  }

  const resolveSectionLineRenderer = (section: ParsedResumeSection) => {
    // `[columns=n]` wins over the education/cert single-column renderer
    if (resolveSectionColumnCount(section) > 1) {
      return (lines: string[]) => renderColumnSectionHTML(section, lines)
    }
    if (isProfileSection(section.title)) return renderProfileHTML
    if (isEducationSection(section.title)) return renderEducationHTML
    return (lines: string[]) => renderColumnSectionHTML(section, lines)
  }

  const renderColumnSectionPlainText = (
    section: Pick<ParsedResumeSection, "title" | "content" | "columns">,
    lines: string[],
  ): string => {
    const columnCount = resolveSectionColumnCount(section)
    if (columnCount <= 1) return ""

    if (sectionHasStructuredEntries(lines)) {
      const blocks = splitSectionIntoEntryBlocks(lines)
      if (blocks.length >= 2) {
        const blockHtmls = blocks.map((block) => renderUniversalMarkdown(block))
        return renderCVColumnBlocksHtml(blockHtmls, columnCount as 2 | 3)
      }
    }

    const items = parseTwoColumnSectionItems(lines)
    if (items.length === 0) return ""

    const bullet = getColumnBulletStyle()
    return renderCVColumnListHtml(items, columnCount as 2 | 3, {
      ...bullet,
      symbol: "-",
      size: "1em",
      color: "#000000",
      bulletIndent: 12,
    })
  }

  // ATS-Friendly (Styled) mode - single column, no backgrounds, accent only for headings
  const renderATSStyledHTML = (sections: ParsedResumeSection[], includeHeader = true): PdfViewParts => {
    const name = displayVersion.contactInfo.name || "Your Name"
    const professionalTitle = displayVersion.contactInfo.professionalTitle || ""

    const labels =
      displayVersion.contactInfo.language === "de"
        ? { email: "E-Mail", linkedin: "LinkedIn", phone: "Telefon", citizenship: "Staatsangehörigkeit", portfolio: "Portfolio", location: "Wohnort" }
        : { email: "Email", linkedin: "LinkedIn", phone: "Phone", citizenship: "Citizenship", portfolio: "Portfolio", location: "Location" }

    // No photo, plain text contact info
    const headerHTML = `
      <div style="margin-bottom: 24px; border-bottom: 2px solid ${hexAccentColor}; padding-bottom: 16px;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 4px 0; color: #000000;">${name}</h1>
        ${professionalTitle ? `<p style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0; color: ${hexAccentColor};">${professionalTitle}</p>` : ""}
        <div style="font-size: 12px; color: #333333; line-height: 1.6;">
          ${displayVersion.contactInfo.address ? `${labels.location}: ${displayVersion.contactInfo.address} | ` : ""}
          ${displayVersion.contactInfo.email ? `${labels.email}: ${displayVersion.contactInfo.email} | ` : ""}
          ${displayVersion.contactInfo.phone ? `${labels.phone}: ${displayVersion.contactInfo.phone}` : ""}
          ${displayVersion.contactInfo.linkedin ? `<br/>${labels.linkedin}: <a href="${displayVersion.contactInfo.linkedin.startsWith("http") ? displayVersion.contactInfo.linkedin : `https://${displayVersion.contactInfo.linkedin}`}" target="_blank" style="color: ${hexAccentColor}; text-decoration: underline;">${displayVersion.contactInfo.linkedin}</a>` : ""}
          ${(() => {
            const portfolioUrls = visiblePortfolioUrls(displayVersion.contactInfo)
            return portfolioUrls.length
              ? ` | ${labels.portfolio}: ${portfolioLinksJoinedHtml(portfolioUrls, hexAccentColor)}`
              : ""
          })()}
        </div>
      </div>
    `

    // Target company/role without background
    const applicationTargetHTML =
      displayVersion.contactInfo.targetCompany || displayVersion.contactInfo.targetRole
        ? `
      <div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e0e0e0;">
        ${renderTargetCompanyRoleHeadingHtml({
          company: displayVersion.contactInfo.targetCompany,
          role: displayVersion.contactInfo.targetRole,
          companyPrefix: "Target: ",
          companyStyle: "font-size: 14px; font-weight: bold; color: #000000;",
          roleStyle: "font-size: 13px; font-weight: 400; color: #333333;",
          separatorStyle: "font-size: 14px; font-weight: bold; color: #000000;",
        })}
      </div>
    `
        : ""

    const renderATSMarkdownLines = (
      lines: string[],
      options?: {
        showEmploymentDuration?: boolean
        sectionIsParallelWork?: boolean
      },
    ): string => {
      const inlineHtml = (text: string) =>
        formattedTextToHtml(text, {
          linkColor: hexAccentColor,
          underline: true,
        })
      const durationLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
      const workLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
      const appendDuration = options?.showEmploymentDuration === true

      let html = ""
      let inBulletList = false

      for (const line of lines) {
        const parsed = parseResumeMarkupLine(line)
        if (parsed.kind === "page-break") continue
        if (parsed.kind === "paragraph" && !parsed.text) continue

        if (parsed.kind === "date") {
          if (inBulletList) { html += "</ul>"; inBulletList = false }
          const withDuration = appendDuration
            ? formatEmploymentDateWithDuration(parsed.text, { language: durationLang })
            : parsed.text
          const durationMatch =
            appendDuration && withDuration.length > parsed.text.length
              ? withDuration.slice(parsed.text.length).match(/^\s*(\([^)]+\))$/)
              : null
          const dateHtml = durationMatch
            ? `${inlineHtml(parsed.text)}<span style="color:#888888;font-style:italic;">${escapeHtmlText(durationMatch[1])}</span>`
            : inlineHtml(withDuration)
          html += `<p style="font-size: 12px; color: #666666; margin: 2px 0; font-style: italic; overflow-wrap:anywhere;">${dateHtml}</p>`
          continue
        }

        if (parsed.kind === "company") {
          if (inBulletList) { html += "</ul>"; inBulletList = false }
          html += `<p style="font-size: 14px; font-weight: 700; margin: 8px 0 4px 0; color: #000000;">${inlineHtml(parsed.text)}</p>`
          continue
        }

        if (parsed.kind === "job-title") {
          if (inBulletList) { html += "</ul>"; inBulletList = false }
          const workType = resolveExperienceWorkType({
            lineWorkType: parsed.workType,
            sectionIsParallelWork: options?.sectionIsParallelWork === true,
          })
          const suffix = formatParallelWorkAtsSuffix(workType, workLang)
          html += `<p style="font-size: 13px; font-weight: 600; margin: 12px 0 4px 0; color: #333333;">${inlineHtml(parsed.text)}${suffix ? escapeHtmlText(suffix) : ""}</p>`
          continue
        }

        if (parsed.kind === "section-heading") {
          if (inBulletList) { html += "</ul>"; inBulletList = false }
          html += `<p style="font-size: 13px; font-weight: 600; margin: 12px 0 4px 0; color: #333333;">${inlineHtml(parsed.text)}</p>`
          continue
        }

        if (parsed.kind === "bullet") {
          if (!inBulletList) { html += '<ul style="margin: 4px 0; padding-left: 20px;">'; inBulletList = true }
          html += `<li style="margin: 2px 0; font-size: 13px; line-height: 1.5; color: #000000;">${inlineHtml(parsed.text)}</li>`
          continue
        }

        if (inBulletList) { html += "</ul>"; inBulletList = false }
        html += `<p style="font-size: 13px; margin: 4px 0; line-height: 1.5; color: #000000;">${inlineHtml(parsed.text)}</p>`
      }

      if (inBulletList) html += "</ul>"
      return html
    }

    const renderATSMarkdown = (
      lines: string[],
      options?: {
        showEmploymentDuration?: boolean
        sectionIsParallelWork?: boolean
      },
    ): string =>
      renderHtmlWithMarkdownTables(
        lines,
        (chunk) =>
          renderHtmlWithColumnBlocks(
            chunk,
            (block) => renderATSMarkdownLines(block, options),
            (columnLines, columns) =>
              renderCVColumnBlocksHtml(
                columnLines.map((column) => renderATSMarkdownLines(column, options)),
                columns,
              ),
          ),
        (table) =>
          renderMarkdownTableHtml(table, {
            fontSize: 13,
            lineHeight: 1.45,
            linkColor: hexAccentColor,
            // ATS Optimized: plain readable text — no colour reliance
            tableAccentStyle: "off",
            accentColor: hexAccentColor,
          }),
      )

    const renderATSEmploymentAware = (sectionTitle: string) => (lines: string[]) =>
      renderATSMarkdown(lines, {
        showEmploymentDuration:
          displayVersion.contactInfo.showEmploymentDuration === true &&
          isEmploymentExperienceSection(sectionTitle),
        sectionIsParallelWork: sectionIsParallelWorkTitle(sectionTitle),
      })

    const columnStyle =
      "background: transparent; padding: 0; margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000000;"

    const sectionsHTML = sections
      .filter((section) => section.title !== "" && !isPageBreakSectionTitle(section.title))
      .map((section) => {
        const sectionTitleHTML = section.title
          ? `<h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid ${hexAccentColor}; color: ${hexAccentColor};">${section.title}</h2>`
          : ""

        if (isCareerEvolutionSection(section.title)) {
          // ATS-styled mode never relies on the graph — omit entirely.
          return ""
        }

        if (isExperienceSection(section.title)) {
          return renderExperiencePdfBlocks(
            sectionTitleHTML,
            section.content,
            renderATSEmploymentAware(section.title),
            "16px",
            undefined,
            experiencePdfOptions(section.title),
          )
        }

        return renderNonExperiencePdfSection(section, sectionTitleHTML, "16px")
      })
      .join("")

    const headerMarked =
      includeHeader ? wrapPdfBlock("header", `${headerHTML}${applicationTargetHTML}`) : ""

    return {
      columnStyle,
      markedInner: `${headerMarked}${sectionsHTML}`,
    }
  }

  // Full ATS (Text-only) mode - plain text, no colors, no formatting
  const renderATSTextHTML = (sections: ParsedResumeSection[], includeHeader = true): PdfViewParts => {
    const name = displayVersion.contactInfo.name || "Your Name"
    const professionalTitle = displayVersion.contactInfo.professionalTitle || ""

    const labels =
      displayVersion.contactInfo.language === "de"
        ? { email: "E-Mail", linkedin: "LinkedIn", phone: "Telefon", citizenship: "Staatsangehörigkeit", portfolio: "Portfolio", location: "Wohnort" }
        : { email: "Email", linkedin: "LinkedIn", phone: "Phone", citizenship: "Citizenship", portfolio: "Portfolio", location: "Location" }

    // Plain text header
    const headerHTML = `
      <div style="margin-bottom: 20px;">
        <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 4px 0; color: #000000;">${name}</h1>
        ${professionalTitle ? `<p style="font-size: 14px; margin: 0 0 8px 0; color: #000000;">${professionalTitle}</p>` : ""}
        <p style="font-size: 12px; color: #000000; margin: 2px 0;">
          ${displayVersion.contactInfo.address ? `${displayVersion.contactInfo.address}` : ""}
        </p>
        <p style="font-size: 12px; color: #000000; margin: 2px 0;">
          ${displayVersion.contactInfo.email ? `${displayVersion.contactInfo.email}` : ""}
          ${displayVersion.contactInfo.phone ? ` | ${displayVersion.contactInfo.phone}` : ""}
        </p>
        <p style="font-size: 12px; color: #000000; margin: 2px 0;">
          ${displayVersion.contactInfo.linkedin ? `<a href="${displayVersion.contactInfo.linkedin.startsWith("http") ? displayVersion.contactInfo.linkedin : `https://${displayVersion.contactInfo.linkedin}`}" target="_blank" style="color: #000000; text-decoration: underline;">${displayVersion.contactInfo.linkedin}</a>` : ""}
          ${(() => {
            const portfolioUrls = visiblePortfolioUrls(displayVersion.contactInfo)
            return portfolioUrls.length
              ? ` | ${portfolioLinksJoinedHtml(portfolioUrls, "#000000", "color: #000000; text-decoration: underline;")}`
              : ""
          })()}
        </p>
      </div>
    `

    const renderPlainTextLines = (
      lines: string[],
      options?: {
        showEmploymentDuration?: boolean
        sectionIsParallelWork?: boolean
      },
    ): string => {
      const durationLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
      const workLang = displayVersion.contactInfo.language === "de" ? "de" : "en"
      const appendDuration = options?.showEmploymentDuration === true
      let html = ""

      for (const line of lines) {
        const parsed = parseResumeMarkupLine(line)
        if (parsed.kind === "page-break") continue
        if (parsed.kind === "paragraph" && !parsed.text) continue

        let text = ""
        if (parsed.kind === "bullet") text = `- ${parsed.text}`
        else if (parsed.kind === "date") {
          text = appendDuration
            ? formatEmploymentDateWithDuration(parsed.text, { language: durationLang })
            : parsed.text
        } else if (parsed.kind === "job-title") {
          const workType = resolveExperienceWorkType({
            lineWorkType: parsed.workType,
            sectionIsParallelWork: options?.sectionIsParallelWork === true,
          })
          text = `${parsed.text}${formatParallelWorkAtsSuffix(workType, workLang)}`
        } else if (
          parsed.kind === "company" ||
          parsed.kind === "section-heading" ||
          parsed.kind === "paragraph"
        ) {
          text = parsed.text
        }
        if (!text) continue

        html += `<p style="font-size: 12px; margin: 3px 0; line-height: 1.4; color: #000000; overflow-wrap:anywhere;">${escapeHtmlText(formattedTextToPlain(text))}</p>`
      }

      return html
    }

    const renderPlainText = (
      lines: string[],
      options?: {
        showEmploymentDuration?: boolean
        sectionIsParallelWork?: boolean
      },
    ): string =>
      renderHtmlWithMarkdownTables(
        lines,
        (chunk) =>
          renderHtmlWithColumnBlocks(
            chunk,
            (block) => renderPlainTextLines(block, options),
            (columnLines, columns) =>
              renderCVColumnBlocksHtml(
                columnLines.map((column) => renderPlainTextLines(column, options)),
                columns,
              ),
          ),
        (table) => {
          const header = table.headers.join(" | ")
          const rows = table.rows.map((row) => row.join(" | "))
          return [header, ...rows]
            .map(
              (line) =>
                `<p style="font-size: 12px; margin: 3px 0; line-height: 1.4; color: #000000;">${escapeHtmlText(line)}</p>`,
            )
            .join("")
        },
      )

    const renderPlainEmploymentAware = (sectionTitle: string) => (lines: string[]) =>
      renderPlainText(lines, {
        showEmploymentDuration:
          displayVersion.contactInfo.showEmploymentDuration === true &&
          isEmploymentExperienceSection(sectionTitle),
        sectionIsParallelWork: sectionIsParallelWorkTitle(sectionTitle),
      })

    const columnStyle =
      "background: transparent; padding: 0; margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000000;"

    const sectionsHTML = sections
      .filter((section) => section.title !== "" && !isPageBreakSectionTitle(section.title))
      .map((section) => {
        const sectionTitleHTML = section.title
          ? `<h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 16px 0 8px 0; color: #000000;">${section.title}</h2>`
          : ""

        if (isCareerEvolutionSection(section.title)) {
          // Plain ATS text mode: exclude graph; standard CV content is sufficient.
          return ""
        }

        if (isExperienceSection(section.title)) {
          return renderExperiencePdfBlocks(
            sectionTitleHTML,
            section.content,
            renderPlainEmploymentAware(section.title),
            "12px",
            undefined,
            experiencePdfOptions(section.title),
          )
        }

        const sectionBody =
          renderColumnSectionPlainText(section, section.content) ||
          renderPlainText(section.content)

        return `<div class="resume-section-block" style="margin-bottom: 12px;">${wrapPdfBlock("section", `${sectionTitleHTML}${sectionBody}`)}</div>`
      })
      .join("")

    const headerMarked = includeHeader ? wrapPdfBlock("header", headerHTML) : ""

    return {
      columnStyle,
      markedInner: `${headerMarked}${sectionsHTML}`,
    }
  }

  const getCurrentViewParts = (
    sections: ParsedResumeSection[],
    includeHeader = true,
  ): PdfViewParts => {
    switch (viewMode) {
      case "ats-styled":
        return renderATSStyledHTML(sections, includeHeader)
      case "ats-text":
        return renderATSTextHTML(sections, includeHeader)
      default:
        return renderFullResumeHTML(sections, includeHeader)
    }
  }

  /**
   * PDF surface HTML: measured `[data-pdf-block]` packing into fixed A4
   * `<section class="pdf-page">` wrappers (see `lib/pdf-auto-pagination.ts`).
   * Until `document.fonts.ready` + layout finish, `pdfSurfaceHtml` is null and
   * we show a non-paginated fallback so the column is not blank.
   */
  const pdfDebugEnabled = isPdfDebugEnabled()

  const buildFallbackSurfaceHtml = (): string => {
    const p = getCurrentViewParts(viewSections)
    const label = pdfDebugEnabled ? pdfPageLabelHtml(1) : ""
    return `<section class="pdf-page pdf-page--auto">${label}<div style="${p.columnStyle};width:100%;margin:0;padding:0;box-sizing:border-box;">${p.markedInner}</div></section>`
  }

  const displayPdfHtml = `<style id="cv-md-table-css">${CV_MARKDOWN_TABLE_CSS}</style>${
    pdfSurfaceHtml ?? buildFallbackSurfaceHtml()
  }`

  const activeIncludeTransparencyPage =
    variant === "export" ? exportIncludeTransparencyPage : includeTransparencyPage

  const fullPreviewHtml = useMemo(
    () =>
      appendExportTransparencyToHtml(
        displayPdfHtml,
        displayVersion,
        activeIncludeTransparencyPage,
        {
          accentColorHex: hexAccentColor,
          formatStyle: humanFormatStyle,
        },
      ),
    [
      displayPdfHtml,
      displayVersion,
      activeIncludeTransparencyPage,
      hexAccentColor,
      humanFormatStyle,
    ],
  )

  useLayoutEffect(() => {
    let cancelled = false

    const runPagination = () => {
      try {
        const p = getCurrentViewParts(viewSections)
        const r = autoPaginateResumeInnerHtml(document, p.markedInner, p.columnStyle, {
          debugMode: pdfDebugEnabled,
        })
        if (!cancelled) {
          setPdfSurfaceHtml(r.html)
          setPdfPaginationHadOverflow(r.hadOverflow)
          setPdfPaginationReady(true)
        }
      } catch (error) {
        console.error("[resume-preview] Pagination failed:", error)
        if (!cancelled) {
          setPdfPaginationReady(true)
        }
      }
    }

    const waitImages = () =>
      Promise.all(
        Array.from(document.images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
                return
              }
              img.onload = () => resolve()
              img.onerror = () => resolve()
              setTimeout(() => resolve(), 5000)
            }),
        ),
      )

    const timer = window.setTimeout(() => {
      void Promise.all([document.fonts.ready, waitImages()]).then(() => {
        if (cancelled) return
        runPagination()
      })
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    pdfDebugEnabled,
    manualPageBreaksActive,
    viewMode,
    humanFormatStyle,
    variant,
    version.resumeText,
    version.aiAuditLog,
    version.aiProvenance,
    version.profileImage,
    version.companyLogo,
    version.accentColor,
    version.accentColorHex,
    version.profilePhotoBorder,
    version.targetBoxBgColor,
    version.targetBoxBorderColor,
    // Stable snapshot — `displayVersion.contactInfo` may be a new object identity each render.
    // Includes careerEvolution.layout so layout radio changes re-paginate immediately.
    JSON.stringify(displayVersion.contactInfo),
    displayVersion.contactInfo?.careerEvolution?.layout,
    displayVersion.contactInfo?.careerEvolution?.density,
    displayVersion.contactInfo?.careerEvolution?.position,
    displayVersion.contactInfo?.careerEvolution?.visible,
    displayVersion.contactInfo?.careerEvolution?.showParallelWork,
  ])

  const paginationHelp =
    paginationExplainerCopy[displayVersion.contactInfo.language === "de" ? "de" : "en"]

  if (variant === "export") {
    // Used by both the print route and the Playwright PDF route. The
    // exporter must render the EXACT same DOM as the on-screen preview
    // (each manual page already wrapped in `<section class="pdf-page">`).
    // We never wrap or re-flow this HTML in the exporter — it's the
    // single source of truth for what ends up in the PDF.
    return (
      <div
        ref={contentRef}
        data-pdf-pagination-ready={pdfPaginationReady ? "true" : "false"}
        data-pdf-pagination-overflow={pdfPaginationHadOverflow ? "true" : "false"}
        data-export-include-transparency={activeIncludeTransparencyPage ? "true" : "false"}
        data-export-include-metadata={exportIncludeMetadata ? "true" : "false"}
        className={cn("w-full min-w-0 resume-print-surface", pdfDebugEnabled && "pdf-debug")}
        dangerouslySetInnerHTML={{ __html: fullPreviewHtml }}
      />
    )
  }

  const showControls = panel === "all" || panel === "controls"
  const showPreview = panel === "all" || panel === "preview"

  const metadataCheckboxId =
    panel === "controls" || panel === "formatter"
      ? "include-export-metadata-controls"
      : "include-export-metadata"
  const transparencyCheckboxId =
    panel === "controls" || panel === "formatter"
      ? "include-transparency-page-controls"
      : "include-transparency-page"

  const cvStyleOptions = [
    {
      id: "executive-compact" as const,
      name: "Executive compact",
      desc: "Clean, dense layout — fits more on one page",
    },
    {
      id: "current" as const,
      name: "Profile-enhanced design",
      desc: "Compact header with a stronger professional summary",
    },
    {
      id: "modern-spacious" as const,
      name: "Modern spacious",
      desc: "Clean typography with controlled breathing room",
    },
  ]

  const documentToolbarActions = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={downloadPDF}
          disabled={isDownloadingPDF}
          className="ui-btn-primary"
        >
          {isDownloadingPDF ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Exporting…
            </>
          ) : (
            <>
              <Download aria-hidden />
              PDF
            </>
          )}
        </button>
        <button type="button" onClick={downloadWord} className="ui-btn-ghost">
          <FileText aria-hidden />
          Word
        </button>
      </>
    ),
    [
      downloadPDF,
      downloadWord,
      isDownloadingPDF,
    ],
  )

  useEffect(() => {
    if (panel !== "formatter" || !onRegisterDocumentActions) return
    onRegisterDocumentActions(documentToolbarActions)
    return () => onRegisterDocumentActions(null)
  }, [panel, onRegisterDocumentActions, documentToolbarActions])

  const controlsContent = (
    <>
      <div className="score-card">
        <span className="score-ring" aria-label={`Resume score ${cvInsights.score} percent`}>
          {cvInsights.score}
        </span>
        <div className="min-w-0 flex-1">
          <p className="score-title">CV readiness score</p>
          <p className="score-sub">
            {cvInsights.suggestions[0]?.text ?? "Review your CV before applying"}
          </p>
          {cvInsights.suggestions.length > 0
            ? cvInsights.suggestions.slice(0, 3).map((s, i) => (
                <span key={i} className="suggestion-chip">
                  {s.text.length > 48 ? `${s.text.slice(0, 48)}…` : s.text}
                </span>
              ))
            : null}
        </div>
      </div>

      <div className="space-y-3">
        <p className="settings-section-lbl">Document actions</p>
        <PdfExportControls
          variant="settings"
          preset={pdfExportPreset}
          onPresetChange={setPdfExportPreset}
          estimatedBytes={estimatedPdfBytes}
        />
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Use Chrome in order to export 1-page PDFs
        </p>
        {versionActionsSlot ? (
          <>
            <p className="settings-section-lbl">Versions</p>
            {versionActionsSlot}
          </>
        ) : null}
        {savedJobDescription ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="dl-btn full">
                <Briefcase aria-hidden />
                See job description
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] max-h-[400px] overflow-y-auto" align="start" side="bottom" sideOffset={8}>
              <div className="space-y-3">
                <h4 className="font-semibold text-base">Job Description</h4>
                <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap max-h-[280px] overflow-y-auto">
                  {savedJobDescription}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        <fieldset className="border-0 p-0 m-0" aria-label="Export transparency options">
          <label className="check-row" htmlFor={metadataCheckboxId}>
            <input
              id={metadataCheckboxId}
              type="checkbox"
              checked={includeExportMetadata}
              onChange={(e) => setIncludeExportMetadata(e.target.checked)}
            />
            <span>
              <span className="check-lbl">Embed AI metadata</span>
              <span className="check-desc">
                Saved in PDF file properties; Word exports include it at the end of the document
              </span>
            </span>
          </label>
          {includeExportMetadata ? (
            <p className="check-helper text-[11px] leading-snug text-[var(--color-text-secondary)] pl-[26px] -mt-1">
              For PDF exports, this is stored in file properties and will not appear visibly in the
              document. Word exports show the same text at the end of the document.
            </p>
          ) : null}
          <label className="check-row" htmlFor={transparencyCheckboxId}>
            <input
              id={transparencyCheckboxId}
              type="checkbox"
              checked={includeTransparencyPage}
              onChange={(e) => setIncludeTransparencyPage(e.target.checked)}
            />
            <span>
              <span className="check-lbl">Include AI transparency statement</span>
              <span className="check-desc">
                Adds a page at the end of the exported CV (preview updates immediately)
              </span>
            </span>
          </label>
        </fieldset>
        {includeExportMetadata ? (
          <ExportMetadataPreviewPanel resume={displayVersion} />
        ) : null}
        {includeTransparencyPage ? (
          <ExportMetadataPreviewPanel
            resume={displayVersion}
            visibility={getTransparencyStatementVisibility()}
            title="Transparency statement preview"
            description="A styled AI Transparency Statement appears as the final page in PDF and Word exports — scroll to the end of the resume preview to verify."
            showMetadataRows={false}
            showWordPreview={false}
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="settings-section-lbl">CV style</p>
        <div className="style-list" role="radiogroup" aria-label="CV style">
          {cvStyleOptions.map(({ id, name, desc }) => {
            const active = humanFormatStyle === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setHumanFormatStyle(id)}
                className={cn("style-item", active && "active")}
              >
                <span className="style-radio" aria-hidden />
                <span className="min-w-0">
                  <span className="style-name">{name}</span>
                  <p className="style-desc">{desc}</p>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Collapsible open={paginationExplainerOpen} onOpenChange={setPaginationExplainerOpen}>
        <div
          className={cn(
            "ui-formatter-control-card overflow-hidden p-0",
            pdfPaginationHadOverflow && "border-orange-400/70",
          )}
        >
          <CollapsibleTrigger
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left min-h-[44px] hover:bg-[var(--page-bg)]"
            aria-expanded={paginationExplainerOpen}
          >
            <span className="text-[13px] font-medium text-[var(--text-primary)]">{paginationHelp.title}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200",
                paginationExplainerOpen && "rotate-180",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 border-t border-[var(--border-subtle)] px-4 pb-4 pt-3 text-[12px] text-[var(--text-secondary)]">
              <ul className="list-disc pl-5 space-y-1">
                {paginationHelp.items.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {footerControls}
    </>
  )

  const useA4ScaledPreview = panel === "formatter" || panel === "preview"

  const cvDocumentInner = (
    <div
      ref={contentRef}
      data-pdf-pagination-ready={pdfPaginationReady ? "true" : "false"}
      data-pdf-pagination-overflow={pdfPaginationHadOverflow ? "true" : "false"}
      data-export-include-transparency={includeTransparencyPage ? "true" : "false"}
      className={cn(
        "w-full min-w-0 resume-print-surface bg-transparent text-black",
        pdfDebugEnabled && "pdf-debug",
      )}
      dangerouslySetInnerHTML={{ __html: fullPreviewHtml }}
    />
  )

  const isFormatterLayout = panel === "formatter"

  const previewContent = (
    <>
      <div className="preview-header">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="ui-formatter-preview-label shrink-0">Resume preview</p>
          {includeTransparencyPage ? (
            <span className="preview-header__badge" aria-label="AI transparency statement included">
              ✓ AI Transparency Included
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="preview-header__zoom-btn"
            onClick={() =>
              setZoomLevel((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))
            }
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="preview-header__zoom-btn"
            onClick={() =>
              setZoomLevel((z) => Math.min(2, Math.round((z + 0.15) * 100) / 100))
            }
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isFormatterLayout && panel !== "preview" && includeExportMetadata ? (
        <ExportMetadataPreviewPanel resume={displayVersion} />
      ) : null}

      <div className="w-full min-w-0 flex-1" aria-live="polite">
        {useA4ScaledPreview ? (
          <CvPreviewScaledPaper
            zoomLevel={zoomLevel}
            remeasureKey={fullPreviewHtml}
            onRegisterScale={isFormatterLayout ? handleRegisterScale : undefined}
            useFormatterPaper={isFormatterLayout}
          >
            {cvDocumentInner}
          </CvPreviewScaledPaper>
        ) : (
          <div className="ui-cv-paper overflow-x-auto">
            {cvDocumentInner}
          </div>
        )}
      </div>
    </>
  )

  if (panel === "controls") {
    return <div className="ui-formatter-controls-panel !p-0 !max-h-none">{controlsContent}</div>
  }

  if (panel === "preview") {
    return <div className="ui-formatter-preview-panel !p-0 !max-h-none">{previewContent}</div>
  }

  if (panel === "formatter") {
    const exportPanel = (
      <FormatterExportPanel
        onDownloadPdf={downloadPDF}
        onDownloadWord={downloadWord}
        isDownloadingPdf={isDownloadingPDF}
        estimatedPdfBytes={estimatedPdfBytes}
        pdfExportPreset={pdfExportPreset}
        onPdfExportPresetChange={setPdfExportPreset}
        includeExportMetadata={includeExportMetadata}
        onIncludeExportMetadataChange={setIncludeExportMetadata}
        includeTransparencyPage={includeTransparencyPage}
        onIncludeTransparencyPageChange={setIncludeTransparencyPage}
      />
    )

    const settingsPanel = (
      <FormatterSettingsPanel
        humanFormatStyle={humanFormatStyle}
        onHumanFormatStyleChange={(id) => setHumanFormatStyle(id as HumanFormatStyle)}
        cvStyleOptions={cvStyleOptions}
        showEmploymentDuration={displayVersion.contactInfo.showEmploymentDuration === true}
        onShowEmploymentDurationChange={(checked) => {
          const next = {
            ...displayVersion.contactInfo,
            showEmploymentDuration: checked,
          }
          version.onContactInfoChange?.(next)
        }}
      />
    )

    const settingsVersionsPanel = versionActionsSlot ? (
      <FormatterVersionsPanel>
        <div className="formatter-versions-panel">{versionActionsSlot}</div>
      </FormatterVersionsPanel>
    ) : null

    const pageBreaksPanel = (
      <FormatterPageBreaksContent
        items={[...paginationHelp.items]}
        overflowWarning={paginationHelp.overflow}
        showOverflowWarning={pdfPaginationHadOverflow}
      />
    )

    const trustTransparencyPanel = (
      <TrustTransparencyPopoverContent
        resume={version}
        allResumes={trustAllResumes}
        folderId={trustFolderId}
        onRestoreSnapshot={onTrustRestoreSnapshot}
      />
    )

    const workspaceValue = {
      workspaceRef: formatterWorkspaceRef,
      popoverOpen: formatterPopoverOpen,
      setPopoverOpen: setFormatterPopoverOpen,
      closePopoverRef,
      openPopoverRef,
      exportPanel,
      settingsPanel,
      settingsVersionsPanel,
      pageBreaksPanel,
      trustTransparencyPanel,
      versionsPanel: versionActionsSlot,
      trustFolderId,
      onTrustDataDeleted,
      showCoverLetterCta: showCoverLetterButton,
      hasSavedCoverLetter,
      onOpenCoverLetter: showCoverLetterButton ? openCoverLetter : undefined,
      showYourStoryCta: showYourStoryButton,
      hasYourStory,
      onOpenYourStory: showYourStoryButton ? onOpenYourStory : undefined,
    }

    return (
      <FormatterWorkspaceProvider value={workspaceValue}>
        <div className="editor-body editor-body--v2">
          <div className="formatter-sidebar-wrap">{leftSlot}</div>

          <div className="formatter-main">
            <div className="formatter-main-topbar">
              <div className="formatter-main-topbar__left">{formatterBreadcrumb}</div>
              <div className="formatter-main-topbar__right">
                {formatterTopbarRight}
              </div>
            </div>

            <div
              ref={formatterWorkspaceRef}
              className={cn("formatter-workspace", formatterPopoverOpen && "formatter-workspace--dimmed")}
              onClick={(e) => {
                if (formatterPopoverOpen && e.target === e.currentTarget) {
                  closePopoverRef.current?.()
                }
              }}
            >
              {formatterPopoverOpen ? (
                <div
                  className="formatter-workspace-dim"
                  aria-hidden
                  onClick={() => closePopoverRef.current?.()}
                />
              ) : null}

              <div ref={previewSectionRef} id="resume-preview-section" className="cv-center cv-center--v2">
                <div className="w-full min-w-0 flex-1 flex items-start justify-center py-6" aria-live="polite">
                  <CvPreviewScaledPaper
                    zoomLevel={zoomLevel}
                    remeasureKey={fullPreviewHtml}
                    onRegisterScale={handleRegisterScale}
                    useFormatterPaper
                  >
                    {cvDocumentInner}
                  </CvPreviewScaledPaper>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormatterWorkspaceProvider>
    )
  }

  return (
    <div className="flex flex-col w-full">
      <div className="space-y-6 w-full pb-8">
        {controlsContent}
        {previewContent}
      </div>
    </div>
  )
}

const escapeHtml = (text: string): string => {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
