import type { CompanySearchTarget } from "@/lib/job-search-focus"

type CuratedEmployer = {
  company: string
  area: string
  roleHint: string
  titleTerms: string[]
}

const CURATED_BERLIN_EU_EMPLOYERS: CuratedEmployer[] = [
  {
    company: "Zalando",
    area: "E-commerce & technology · Berlin, Germany",
    roleHint: "Product, UX, and design roles at scale",
    titleTerms: ["product", "design", "ux", "research", "accessibility"],
  },
  {
    company: "Delivery Hero",
    area: "Technology & logistics · Berlin, Germany",
    roleHint: "Product and design teams across European markets",
    titleTerms: ["product", "design", "ux", "manager", "lead"],
  },
  {
    company: "N26",
    area: "Fintech · Berlin, Germany",
    roleHint: "Digital banking product and experience roles",
    titleTerms: ["product", "design", "ux", "fintech", "manager"],
  },
  {
    company: "SAP",
    area: "Enterprise software · Walldorf / Berlin, Germany",
    roleHint: "Large product and design organisation",
    titleTerms: ["product", "design", "ux", "software", "consultant"],
  },
  {
    company: "Siemens",
    area: "Industrial technology · Munich / Berlin, Germany",
    roleHint: "Digitalisation and human-centred design",
    titleTerms: ["design", "ux", "product", "consultant", "specialist"],
  },
  {
    company: "BMW Group",
    area: "Automotive · Munich, Germany",
    roleHint: "In-car experience and digital product teams",
    titleTerms: ["design", "ux", "product", "research"],
  },
  {
    company: "Spotify",
    area: "Technology & media · Stockholm / Berlin",
    roleHint: "Product design and research at global scale",
    titleTerms: ["design", "ux", "research", "product"],
  },
  {
    company: "Booking.com",
    area: "Travel technology · Amsterdam, Netherlands",
    roleHint: "Large UX and product design organisation",
    titleTerms: ["design", "ux", "research", "product"],
  },
  {
    company: "Adidas",
    area: "Retail & brand · Herzogenaurach / Berlin",
    roleHint: "Digital experience and product teams",
    titleTerms: ["design", "ux", "product", "digital"],
  },
  {
    company: "HelloFresh",
    area: "Consumer technology · Berlin, Germany",
    roleHint: "Product and growth-focused roles",
    titleTerms: ["product", "design", "manager", "analyst"],
  },
  {
    company: "SoundCloud",
    area: "Media technology · Berlin, Germany",
    roleHint: "Product and creator experience roles",
    titleTerms: ["product", "design", "ux"],
  },
  {
    company: "Wikimedia Deutschland",
    area: "Non-profit & open knowledge · Berlin, Germany",
    roleHint: "Mission-driven product and community work",
    titleTerms: ["product", "design", "research", "education"],
  },
]

function slugId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

function scoreEmployer(employer: CuratedEmployer, jobTitles: string[]): number {
  const blob = jobTitles.join(" ").toLowerCase()
  if (jobTitles.length === 0) return 0
  return employer.titleTerms.reduce((score, term) => (blob.includes(term) ? score + 1 : score), 0)
}

export function buildFallbackCompanyTargets(
  jobTitles: string[],
  excludeCompanies: string[] = [],
): CompanySearchTarget[] {
  const excluded = new Set(excludeCompanies.map((name) => name.trim().toLowerCase()))

  const ranked = [...CURATED_BERLIN_EU_EMPLOYERS]
    .filter((entry) => !excluded.has(entry.company.toLowerCase()))
    .sort((a, b) => scoreEmployer(b, jobTitles) - scoreEmployer(a, jobTitles))

  return ranked.slice(0, 10).map((entry) => ({
    id: slugId(entry.area + entry.company),
    company: entry.company,
    area: entry.area,
    roleHint: entry.roleHint,
  }))
}
