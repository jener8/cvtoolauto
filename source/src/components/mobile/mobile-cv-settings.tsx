"use client"

import { useRef, type CSSProperties, type ReactNode } from "react"
import { CareerEvolutionPanel } from "@/components/career-evolution-panel"
import { ExperienceRolesPanel } from "@/components/experience-roles-panel"
import type { FormatterContactInfo } from "@/components/resume-formatter-sidebar"
import { compressLogoToDataUrl } from "@/lib/compress-image"
import type { ResumeContactInfo } from "@/lib/contact-info"
import {
  normalizeTableAccentStyle,
  type TableAccentStyle,
} from "@/lib/accessible-accent-text"
import { cn } from "@/lib/utils"
import { ImagePlus, Trash2 } from "lucide-react"

const TABLE_ACCENT_OPTIONS: {
  id: TableAccentStyle
  name: string
  desc: string
}[] = [
  { id: "off", name: "Off", desc: "All table body text remains black" },
  {
    id: "subtle",
    name: "Subtle",
    desc: "Accessible accent on criteria and outcomes (default)",
  },
  {
    id: "strong",
    name: "Strong",
    desc: "Stronger emphasis on key values",
  },
]

const PRESET_COLORS = [
  { name: "Warm Brown", oklch: "oklch(74% 0.10 81)", hex: "#C9975B" },
  { name: "Professional Blue", oklch: "oklch(55% 0.15 250)", hex: "#2563eb" },
  { name: "Corporate Green", oklch: "oklch(65% 0.15 150)", hex: "#059669" },
  { name: "Classic Black", oklch: "oklch(20% 0 0)", hex: "#000000" },
] as const

const BG_SWATCHES = [
  { name: "Light Gray", hex: "#f8f9fa" },
  { name: "Warm Beige", hex: "#f5f0eb" },
  { name: "Soft Blue", hex: "#f0f4f8" },
  { name: "Light Sage", hex: "#f0f5f0" },
  { name: "White", hex: "#ffffff" },
  { name: "Soft Green", hex: "#e8f5e9" },
  { name: "Soft Yellow", hex: "#fff8e1" },
  { name: "Soft Orange", hex: "#fff3e0" },
  { name: "Soft Purple", hex: "#f3e5f5" },
] as const

const BORDER_SWATCHES = [
  { name: "Accent Color", hex: "" },
  { name: "Black", hex: "#000000" },
  { name: "Dark Gray", hex: "#4a4a4a" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Charcoal", hex: "#2d2d2d" },
  { name: "White", hex: "#ffffff" },
  { name: "Green", hex: "#2e7d32" },
  { name: "Yellow", hex: "#f9a825" },
  { name: "Orange", hex: "#e65100" },
  { name: "Purple", hex: "#6a1b9a" },
] as const

function hexToOklch(hex: string, fallback: string): string {
  const cleaned = hex.replace("#", "")
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return fallback
  const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255
  const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255
  const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255
  const linearR = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const linearG = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const linearB = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB
  const lightness = Math.round(Math.pow(luminance, 1 / 3) * 100)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let hue = 0
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6)
    else if (max === g) hue = 60 * ((b - r) / delta + 2)
    else hue = 60 * ((r - g) / delta + 4)
  }
  if (hue < 0) hue += 360
  const l = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  const chroma = saturation * 0.15
  return `oklch(${lightness}% ${chroma.toFixed(2)} ${Math.round(hue)})`
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {children}
    </section>
  )
}

export type MobileCvSettingsProps = {
  accentColor: string
  accentColorHex: string
  onAccentChange: (oklch: string, hex: string) => void
  targetBoxBgColor: string
  onTargetBoxBgColorChange: (hex: string) => void
  targetBoxBorderColor: string
  onTargetBoxBorderColorChange: (hex: string) => void
  profilePhotoBorder: boolean
  onProfilePhotoBorderChange: (value: boolean) => void
  companyLogo: string | null
  onCompanyLogoChange: (logo: string | null) => void
  resumeText: string
  onResumeTextChange: (text: string) => void
  contactInfo: ResumeContactInfo
  onContactInfoChange: (info: ResumeContactInfo) => void
}

export function MobileCvSettings({
  accentColor,
  accentColorHex,
  onAccentChange,
  targetBoxBgColor,
  onTargetBoxBgColorChange,
  targetBoxBorderColor,
  onTargetBoxBorderColorChange,
  profilePhotoBorder,
  onProfilePhotoBorderChange,
  companyLogo,
  onCompanyLogoChange,
  resumeText,
  onResumeTextChange,
  contactInfo,
  onContactInfoChange,
}: MobileCvSettingsProps) {
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleHexInput = (raw: string) => {
    let clean = raw.replace("#", "")
    if (clean.length > 6) clean = clean.substring(0, 6)
    const fullHex = clean.length > 0 ? `#${clean}` : ""
    if (/^#[0-9A-Fa-f]{6}$/.test(fullHex)) {
      onAccentChange(hexToOklch(fullHex, accentColor), fullHex)
    } else {
      onAccentChange(accentColor, fullHex)
    }
  }

  const handleLogoFile = async (file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await compressLogoToDataUrl(file, 320)
      onCompanyLogoChange(dataUrl)
    } catch (err) {
      console.error("[mobile] Logo compress failed:", err)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") onCompanyLogoChange(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const formatterContact = contactInfo as FormatterContactInfo

  return (
    <div className="flex flex-col gap-6 px-4 py-3 pb-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))]">
      <Section title="Accent colour">
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => onAccentChange(color.oklch, color.hex)}
              className={cn(
                "flex min-h-11 min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border px-3 text-left text-sm",
                accentColorHex.toLowerCase() === color.hex.toLowerCase()
                  ? "border-zinc-900 bg-white shadow-sm"
                  : "border-zinc-200 bg-zinc-50",
              )}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full ring-1 ring-zinc-200"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <span className="truncate text-zinc-800">{color.name}</span>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Custom hex</span>
          <input
            value={accentColorHex}
            onChange={(e) => handleHexInput(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-mono text-base text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
            placeholder="#C9975B"
            maxLength={7}
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </label>
      </Section>

      <Section title="Table accent styling">
        <p className="text-xs text-zinc-500">
          Highlights criteria and outcomes in Markdown tables with a readable accent
          variant. Longer evidence text stays black.
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Table accent styling">
          {TABLE_ACCENT_OPTIONS.map((opt) => {
            const active =
              normalizeTableAccentStyle(contactInfo.tableAccentStyle) === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  onContactInfoChange({
                    ...contactInfo,
                    tableAccentStyle: opt.id,
                  })
                }
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left",
                  active
                    ? "border-zinc-900 bg-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                    active ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-white",
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">{opt.name}</span>
                  <span className="block text-xs text-zinc-500">{opt.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Target box style">
        <p className="text-xs text-zinc-500">Background</p>
        <div className="flex flex-wrap gap-2">
          {BG_SWATCHES.map((color) => (
            <button
              key={color.hex}
              type="button"
              title={color.name}
              onClick={() => onTargetBoxBgColorChange(color.hex)}
              className={cn(
                "h-11 w-11 rounded-xl border-2",
                targetBoxBgColor === color.hex
                  ? "border-zinc-900"
                  : "border-zinc-200",
              )}
              style={{ backgroundColor: color.hex }}
              aria-label={color.name}
              aria-pressed={targetBoxBgColor === color.hex}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500">Border</p>
        <div className="flex flex-wrap gap-2">
          {BORDER_SWATCHES.map((color) => {
            const selected = targetBoxBorderColor === color.hex
            const swatch = color.hex || accentColorHex || "#C9975B"
            return (
              <button
                key={color.name}
                type="button"
                title={color.name}
                onClick={() => onTargetBoxBorderColorChange(color.hex)}
                className={cn(
                  "flex h-11 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-[11px] font-medium",
                  selected ? "border-zinc-900 bg-white" : "border-zinc-200 bg-zinc-50",
                )}
                aria-pressed={selected}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-zinc-300"
                  style={{ backgroundColor: swatch }}
                  aria-hidden
                />
                <span className="truncate text-zinc-700">{color.name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Profile photo outline">
        <button
          type="button"
          role="switch"
          aria-checked={profilePhotoBorder}
          onClick={() => onProfilePhotoBorderChange(!profilePhotoBorder)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-zinc-900">Show photo border</span>
            <span className="block text-xs text-zinc-500">Outline around the profile photo</span>
          </span>
          <span
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              profilePhotoBorder ? "bg-zinc-900" : "bg-zinc-300",
            )}
            aria-hidden
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                profilePhotoBorder ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </Section>

      <Section title="Company logo">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {companyLogo ? (
              <img src={companyLogo} alt="" className="max-h-full max-w-full object-contain p-1" />
            ) : (
              <ImagePlus className="h-6 w-6 text-zinc-400" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                void handleLogoFile(file)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="min-h-11 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white"
            >
              {companyLogo ? "Change logo" : "Upload logo"}
            </button>
            {companyLogo ? (
              <button
                type="button"
                onClick={() => onCompanyLogoChange(null)}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-sm text-zinc-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Career Evolution">
        <p className="text-xs text-zinc-500">
          Show or hide the graph, pick a layout, density, and parallel-work visibility.
          Graph text and Generate use the same controls as desktop.
        </p>
        <div
          className="mobile-ce-settings max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain rounded-xl"
          style={
            {
              background: "#1a1a1a",
              "--formatter-text-primary": "#e8e7e4",
              "--formatter-text-secondary": "#c7c5bf",
              "--formatter-text-muted": "#b0afac",
              "--formatter-text-icon": "#b8b7b4",
            } as CSSProperties
          }
        >
          <div className="p-3">
            <CareerEvolutionPanel
              resumeText={resumeText}
              onResumeTextChange={onResumeTextChange}
              contactInfo={formatterContact}
              setContactInfo={(info) =>
                onContactInfoChange(info as unknown as ResumeContactInfo)
              }
              targetRole={contactInfo.targetRole}
              targetCompany={contactInfo.targetCompany}
              language={contactInfo.language === "de" ? "de" : "en"}
            />
          </div>
        </div>
      </Section>

      <Section title="Parallel work">
        <p className="text-xs text-zinc-500">
          Mark roles as standard, parallel independent, or parallel consulting. Classifications
          stay when you switch tabs and save with the CV.
        </p>
        <div
          className="mobile-parallel-settings max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain rounded-xl"
          style={
            {
              background: "#1a1a1a",
              "--formatter-text-primary": "#e8e7e4",
              "--formatter-text-secondary": "#c7c5bf",
              "--formatter-text-muted": "#b0afac",
              "--formatter-text-icon": "#b8b7b4",
            } as CSSProperties
          }
        >
          <div className="p-3">
            <ExperienceRolesPanel
              resumeText={resumeText}
              onResumeTextChange={onResumeTextChange}
              language={contactInfo.language === "de" ? "de" : "en"}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
