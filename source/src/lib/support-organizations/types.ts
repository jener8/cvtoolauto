/** Curated support directory — vetted organizations only in the main list. */

export type SupportOrgCategory =
  | "mentoring"
  | "career-coaching"
  | "refugee-migrant-support"
  | "childcare"
  | "legal-aid"
  | "womens-network"
  | "jobcenter"
  | "language"
  | "mental-health"

export type SupportOrgCost = "free" | "paid" | "sliding-scale"

export type SupportOrganization = {
  id: string
  name: string
  categories: SupportOrgCategory[]
  /** City name (e.g. "Berlin") or "Remote". */
  location: string
  cost: SupportOrgCost
  description: string
  externalUrl: string
  /** Always true for entries in the curated directory table. */
  vetted: true
  /** True for demo/seed rows — replace before production. */
  isPlaceholder?: boolean
}

/** Live web search results — never mixed with vetted rows without clear UI. */
export type UnverifiedSupportResult = {
  id: string
  name: string
  /** Free-text type label from web search (e.g. "Mentoring programme"). */
  type: string
  location: string
  description: string
  externalUrl?: string
  vetted: false
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportOrgCategory, string> = {
  mentoring: "Mentoring",
  "career-coaching": "Career coaching",
  "refugee-migrant-support": "Refugee support",
  childcare: "Childcare",
  "legal-aid": "Legal aid",
  "womens-network": "Women's network",
  jobcenter: "Jobcenter",
  language: "Language support",
  "mental-health": "Mental health",
}

export const SUPPORT_COST_LABELS: Record<SupportOrgCost, string> = {
  free: "Free",
  paid: "Paid",
  "sliding-scale": "Sliding scale",
}

/** @deprecated Legacy enum — migrated to free-text `type` on load. */
export type UserSupportContactCategory =
  | "mentoring"
  | "career-coaching"
  | "refugee-migrant-support"
  | "childcare"
  | "legal-aid"
  | "other"

export type UserSupportContact = {
  id: string
  name: string
  /** Free-text type (e.g. "Mentoring", "Language exchange"). */
  type: string
  description: string
  contactInfo: string
  externalUrl?: string
  isUserAdded?: boolean
  isUnverified?: boolean
  /** Links a saved contact back to a web search card id in the current session. */
  sourceWebResultId?: string
  createdAt: number
  updatedAt: number
  /** @deprecated Migrated to `type` — not written for new contacts. */
  category?: UserSupportContactCategory
}

/** @deprecated Used only when migrating legacy localStorage rows. */
export const USER_SUPPORT_CONTACT_CATEGORY_LABELS: Record<UserSupportContactCategory, string> = {
  mentoring: "Mentoring",
  "career-coaching": "Career coaching",
  "refugee-migrant-support": "Refugee / migrant support",
  childcare: "Childcare",
  "legal-aid": "Legal aid",
  other: "Other",
}
