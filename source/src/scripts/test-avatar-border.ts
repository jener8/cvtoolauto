/**
 * Run: npx tsx scripts/test-avatar-border.ts
 */
import assert from "node:assert/strict"

function renderProfileAvatarHtml(opts: {
  profileImage: string | null
  profilePhotoBorder?: boolean
  hexAccentColor: string
  sizePx: number
  borderWidthPx: number
  borderRadius: string
}): string {
  const src = opts.profileImage?.trim()
  if (!src) return ""
  const showBorder = opts.profilePhotoBorder !== false
  const borderColor = showBorder ? opts.hexAccentColor : "transparent"
  return `<img src="${src}" alt="Profile" crossorigin="anonymous" style="box-sizing: border-box; width: ${opts.sizePx}px; height: ${opts.sizePx}px; border-radius: ${opts.borderRadius}; object-fit: cover; border: ${opts.borderWidthPx}px solid ${borderColor};" />`
}

const accent = "#b89968"
const photo = "data:image/jpeg;base64,/9j/4AAQ"

const on = renderProfileAvatarHtml({
  profileImage: photo,
  profilePhotoBorder: true,
  hexAccentColor: accent,
  sizePx: 60,
  borderWidthPx: 2,
  borderRadius: "8px",
})
assert.match(on, /border: 2px solid #b89968/)
assert.match(on, /box-sizing: border-box/)
assert.match(on, /width: 60px/)

const off = renderProfileAvatarHtml({
  profileImage: photo,
  profilePhotoBorder: false,
  hexAccentColor: accent,
  sizePx: 60,
  borderWidthPx: 2,
  borderRadius: "8px",
})
assert.match(off, /border: 2px solid transparent/)
assert.doesNotMatch(off, /border: 2px solid #b89968/)
// Same outer size reserved either way
assert.match(off, /width: 60px; height: 60px/)

// Default On for existing CVs (undefined / missing)
const legacy = renderProfileAvatarHtml({
  profileImage: photo,
  hexAccentColor: accent,
  sizePx: 124,
  borderWidthPx: 1.5,
  borderRadius: "50%",
})
assert.match(legacy, new RegExp(`border: 1\\.5px solid ${accent}`))

assert.equal(undefined !== false, true)
assert.equal(false !== false, false)

console.log("test-avatar-border: ok")
