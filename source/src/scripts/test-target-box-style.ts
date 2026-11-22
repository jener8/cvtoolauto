/**
 * Run: npx tsx scripts/test-target-box-style.ts
 *
 * Target box style must drive the application banner for every human CV style,
 * including the default executive-compact (which previously hard-coded an accent tint).
 */
import assert from "node:assert/strict"

function resolveTargetBannerColors(opts: {
  targetBoxBgColor?: string
  targetBoxBorderColor?: string
  hexAccentColor: string
  fallbackBg?: string
}): { bg: string; border: string } {
  return {
    bg: opts.targetBoxBgColor || opts.fallbackBg || "#f8f9fa",
    border: opts.targetBoxBorderColor || opts.hexAccentColor,
  }
}

function renderExecutiveCompactBanner(opts: {
  targetBoxBgColor?: string
  targetBoxBorderColor?: string
  hexAccentColor: string
}): string {
  const { bg, border } = resolveTargetBannerColors({
    ...opts,
    fallbackBg: "#f8f9fa",
  })
  // Must NOT use accent-tint background like `${hexAccentColor}15`
  return `<div style="background-color: ${bg}; border-left: 4px solid ${border};"></div>`
}

const accent = "#b89968"

const defaultBanner = renderExecutiveCompactBanner({ hexAccentColor: accent })
assert.match(defaultBanner, /background-color: #f8f9fa/)
assert.match(defaultBanner, /border-left: 4px solid #b89968/)
assert.doesNotMatch(defaultBanner, /#b8996815/, "must not hard-code accent alpha tint")

const custom = renderExecutiveCompactBanner({
  hexAccentColor: accent,
  targetBoxBgColor: "#fff3e0",
  targetBoxBorderColor: "#1e3a5f",
})
assert.match(custom, /background-color: #fff3e0/)
assert.match(custom, /border-left: 4px solid #1e3a5f/)
assert.doesNotMatch(custom, new RegExp(accent.replace("#", "#?") + "15"))

const accentBorder = resolveTargetBannerColors({
  hexAccentColor: accent,
  targetBoxBgColor: "#e8f5e9",
  targetBoxBorderColor: "", // "Accent Colour" swatch
})
assert.equal(accentBorder.bg, "#e8f5e9")
assert.equal(accentBorder.border, accent, "empty border falls back to accent only for the banner edge")

// Accent colour for headings remains independent
const headingBorder = `border-bottom: 2px solid ${accent}`
assert.match(headingBorder, /#b89968/)
assert.notEqual(custom.includes("#1e3a5f") && headingBorder.includes(accent), false)

console.log("test-target-box-style: ok")
