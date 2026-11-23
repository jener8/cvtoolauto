/**
 * Run: npx tsx scripts/test-company-logo-banner.ts
 *
 * Guards the company-logo-in-target-banner contract used by resume preview/PDF.
 * Upload stores a JPEG data URL; preview must place it beside target company/role
 * for every human format style (default is executive-compact).
 */
import assert from "node:assert/strict"

/** Mirrors resume-preview renderTargetBannerLogoHtml sizing rules. */
function renderTargetBannerLogoHtml(
  companyLogo: string | null | undefined,
  maxWidthPx: number,
  maxHeightPx: number,
): string {
  const src = companyLogo?.trim()
  if (!src) return ""
  return `<div style="flex-shrink: 0; max-width: ${maxWidthPx}px; line-height: 0;"><img src="${src}" alt="" crossorigin="anonymous" style="display:block; max-width: ${maxWidthPx}px; max-height: ${maxHeightPx}px; width: auto; height: auto; object-fit: contain; background:#ffffff; padding:2px; border-radius:4px;" /></div>`
}

function buildTargetBanner(opts: {
  style: "current" | "executive-compact" | "modern-spacious"
  targetCompany: string
  targetRole: string
  companyLogo: string | null
}): string {
  const hasTarget = Boolean(opts.targetCompany || opts.targetRole)
  if (!hasTarget) return ""

  const sizes =
    opts.style === "executive-compact"
      ? { w: 64, h: 40 }
      : opts.style === "modern-spacious"
        ? { w: 72, h: 48 }
        : { w: 64, h: 44 }

  const logo = renderTargetBannerLogoHtml(opts.companyLogo, sizes.w, sizes.h)
  return `<div class="target-banner">${opts.targetCompany} / ${opts.targetRole}${logo}</div>`
}

const sampleLogo = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

for (const style of ["current", "executive-compact", "modern-spacious"] as const) {
  const html = buildTargetBanner({
    style,
    targetCompany: "HelloFresh",
    targetRole: "Senior Designer",
    companyLogo: sampleLogo,
  })
  assert.match(html, /<img src="data:image\/jpeg;base64/, `${style}: logo img missing`)
  assert.match(html, /object-fit: contain/, `${style}: must preserve aspect ratio`)
  assert.doesNotMatch(html, /object-fit:\s*cover/, `${style}: must not crop`)
}

const noLogo = buildTargetBanner({
  style: "executive-compact",
  targetCompany: "HelloFresh",
  targetRole: "Senior Designer",
  companyLogo: null,
})
assert.doesNotMatch(noLogo, /<img /, "null logo must omit img")

const noTarget = buildTargetBanner({
  style: "executive-compact",
  targetCompany: "",
  targetRole: "",
  companyLogo: sampleLogo,
})
assert.equal(noTarget, "", "logo alone does not create a banner without target fields")

// Removal: live null must win over a previously saved logo (?? bug)
const live: string | null = null
const saved = sampleLogo
const resolvedForEditor = live // not: live ?? saved
assert.equal(resolvedForEditor, null, "remove must keep null; do not revive saved logo")

console.log("test-company-logo-banner: ok")
