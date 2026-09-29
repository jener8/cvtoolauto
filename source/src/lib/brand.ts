/** EquitAI product branding — single source of truth for copy. */

export const PRODUCT_NAME = "EquitAI"
export const PRODUCT_TAGLINE = "Human-Centred AI Initiative"
export const PRODUCT_SHORT_NAME = "EquitAI"

/** Primary public site — marketing landing + app (equitai.eu.com). */
export const SITE_ORIGIN = "https://equitai.eu.com"
export const MARKETING_SITE_URL = SITE_ORIGIN

/** Legacy static pages (coaches, imprint) until migrated into the app. */
export const LEGACY_STATIC_SITE_ORIGIN = "https://cv-by-design.com"

/** Hostnames that should show the CV by Design → EquitAI transition page at `/`. */
export const CV_BY_DESIGN_HOSTS = ["cv-by-design.com", "www.cv-by-design.com"] as const

export const PRODUCT_HERO = {
  headline: "AI-Automated CV Building and Job Applications",
  subheading: PRODUCT_TAGLINE,
  subtext:
    "An open initiative for AI-automated CV building and job applications — helping people tailor resumes, track applications, and move through hiring with clarity, while keeping human judgement at the centre.",
  body: [
    "An open initiative for AI-automated CV building and job applications — helping people tailor resumes, track applications, and move through hiring with clarity, while keeping human judgement at the centre.",
  ],
  closing: "Practical experiments in responsible, inclusive hiring automation — starting with Case 01.",
  primaryCta: "Open the Tool",
  secondaryCta: "Get in Touch",
} as const

/** @deprecated Use PRODUCT_NAME — kept for import compatibility. */
export const LEGACY_PRODUCT_NAME = "EquitAI"
