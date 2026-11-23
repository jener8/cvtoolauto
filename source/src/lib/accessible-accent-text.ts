/**
 * Derive a body-text colour from a CV accent that meets WCAG AA (4.5:1)
 * against a known cell background. Never assume the raw accent is readable.
 */

export type Rgb = { r: number; g: number; b: number }

const BODY_BG: Rgb = { r: 255, g: 255, b: 255 }

export function parseHexColor(raw: string | undefined | null): Rgb | null {
  if (!raw) return null
  const t = raw.trim()
  const m6 = t.match(/^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/)
  if (m6) {
    const h = m6[1]!
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    }
  }
  const m3 = t.match(/^#([0-9a-fA-F]{3})$/)
  if (m3) {
    const h = m3[1]!
    return {
      r: Number.parseInt(h[0]! + h[0]!, 16),
      g: Number.parseInt(h[1]! + h[1]!, 16),
      b: Number.parseInt(h[2]! + h[2]!, 16),
    }
  }
  return null
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Relative luminance (WCAG). */
export function relativeLuminance(rgb: Rgb): number {
  const R = srgbChannelToLinear(rgb.r)
  const G = srgbChannelToLinear(rgb.g)
  const B = srgbChannelToLinear(rgb.b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/** Contrast ratio between two colours (WCAG). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

function mixToward(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  }
}

function roundRgb(rgb: Rgb): Rgb {
  return {
    r: Math.max(0, Math.min(255, Math.round(rgb.r))),
    g: Math.max(0, Math.min(255, Math.round(rgb.g))),
    b: Math.max(0, Math.min(255, Math.round(rgb.b))),
  }
}

/**
 * Darken toward black until contrast vs background ≥ minRatio.
 * Checks the *rounded* sRGB value so the emitted hex still meets AA.
 */
export function ensureContrastTextColor(
  accent: Rgb,
  background: Rgb = BODY_BG,
  minRatio = 4.5,
): Rgb {
  if (contrastRatio(roundRgb(accent), background) >= minRatio) {
    return roundRgb(accent)
  }

  let lo = 0
  let hi = 1
  let best = roundRgb(mixToward(accent, { r: 0, g: 0, b: 0 }, 1))
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const candidate = roundRgb(mixToward(accent, { r: 0, g: 0, b: 0 }, mid))
    if (contrastRatio(candidate, background) >= minRatio) {
      best = candidate
      hi = mid
    } else {
      lo = mid
    }
  }
  // Final guard — near-black if still short (near-white accents)
  if (contrastRatio(best, background) < minRatio) {
    return { r: 20, g: 20, b: 20 }
  }
  return best
}

export type TableAccentStyle = "off" | "subtle" | "strong"

export function normalizeTableAccentStyle(raw: unknown): TableAccentStyle {
  if (raw === "off" || raw === "subtle" || raw === "strong") return raw
  return "subtle"
}

/**
 * Readable accent for table first/last columns.
 * - subtle: AA-safe darkening of the accent
 * - strong: slightly darker than subtle for emphasis
 */
export function accessibleTableAccentTextColor(
  accentHex: string | undefined,
  style: TableAccentStyle,
  backgroundHex = "#ffffff",
): string | null {
  if (style === "off") return null
  const accent = parseHexColor(accentHex)
  const bg = parseHexColor(backgroundHex) || BODY_BG
  if (!accent) return null

  const subtle = ensureContrastTextColor(accent, bg, 4.5)
  if (style === "subtle") return rgbToHex(subtle)

  // Strong: push further toward black while staying above AA
  const stronger = ensureContrastTextColor(
    mixToward(subtle, { r: 0, g: 0, b: 0 }, 0.22),
    bg,
    4.5,
  )
  return rgbToHex(stronger)
}

/** True when contrast meets WCAG AA for normal text. */
export function meetsWcagAaContrast(
  foregroundHex: string,
  backgroundHex = "#ffffff",
): boolean {
  const fg = parseHexColor(foregroundHex)
  const bg = parseHexColor(backgroundHex) || BODY_BG
  if (!fg) return false
  return contrastRatio(fg, bg) >= 4.5
}
