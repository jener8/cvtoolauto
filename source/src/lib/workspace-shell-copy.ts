/** EquitAI workspace shell — navigation labels, empty states, and page titles. */

export const SIDEBAR_BRAND = {
  name: "EquitAI",
  tagline: "Your career, your terms",
} as const

export const SIDEBAR_PROGRESS = {
  label: "Your next step",
  stepsTotal: 7,
} as const

export const DASHBOARD_HERO_COPY = {
  welcomeEyebrow: (firstName: string) => `Welcome back, ${firstName}`,
  headline: "You have more to offer than this system makes you feel.",
  subtext:
    "EquitAI helps you see what you bring, match your skills to real opportunities, and move forward — at your own pace.",
} as const

export const JOURNEY_STRIP_STEPS = [
  { id: "story", label: "Tell your story" },
  { id: "cv", label: "Build your CV" },
  { id: "recognition", label: "Recognition" },
  { id: "apply", label: "Apply" },
  { id: "interview", label: "Interview ready" },
] as const

export type SectionEmptyStateId =
  | "careerBrain"
  | "documents"
  | "coverLetters"
  | "savedDocuments"
  | "applications"
  | "recognitionPathways"
  | "workplaceGerman"
  | "bureaucracyNavigator"
  | "mentoringSupport"

export type SectionEmptyStateCopy = {
  heading: string
  body: string
  cta?: string
  note?: string
}

export const SECTION_EMPTY_STATES: Record<SectionEmptyStateId, SectionEmptyStateCopy> = {
  careerBrain: {
    heading: "Every job, every role, every place — it all counts.",
    body: "Teaching, care work, volunteering, study, informal work. Start with whatever feels easiest and we'll help shape it into your career story.",
    cta: "Start with what I know",
  },
  documents: {
    heading: "Your first German CV starts here.",
    body: "German employers expect a specific format — but the content is all yours. We'll guide you through it section by section, in plain language.",
    cta: "Start my CV",
  },
  coverLetters: {
    heading: "A cover letter that sounds like you.",
    body: "We'll use your story and the job description to write a first draft — then you make it yours.",
    cta: "Write my first cover letter",
  },
  savedDocuments: {
    heading: "Keep certificates and references together.",
    body: "Degree certificates, vocational qualifications, reference letters, and other documents you might need for applications or recognition.",
    cta: "Add my qualification",
    note: "Secure document storage is coming soon — keep originals safe with your programme coordinator in the meantime.",
  },
  applications: {
    heading: "Your job search starts when you're ready.",
    body: "When you apply for a job, add it here. You'll be able to track where things stand, what documents were needed, and what comes next.",
    cta: "Add my first application",
  },
  recognitionPathways: {
    heading: "What qualifies you?",
    body: "Tap the skills and strengths that sound like you — certificates optional.",
    cta: "Choose my qualifications",
  },
  workplaceGerman: {
    heading: "You already have the words. We'll help you find them.",
    body: "Browse phrases for describing your experience, strengths, and goals — then make every phrase your own.",
    cta: "Browse phrases",
  },
  bureaucracyNavigator: {
    heading: "Know what you need before you need it.",
    body: "This is a preparation guide, not legal advice. Requirements vary by status, region, and role — always confirm with an official advisor.",
    cta: "See the checklist",
  },
  mentoringSupport: {
    heading: "You don't have to figure this out alone.",
    body: "Browse our curated directory of mentors, women's career groups, refugee support centres, and other services — vetted by our team, with AI help to find what fits you.",
    cta: "Browse support directory",
  },
}

export const SECTION_PAGE_H1: Record<string, string> = {
  careerBrain: "Your story",
  documents: "Documents",
  coverLetters: "Your cover letters",
  applications: "Your job search",
  dashboard: "Your job search",
  recognitionPathways: "What qualifies you",
  workplaceGerman: "Phrase library",
  bureaucracyNavigator: "Things to take care of",
  mentoringSupport: "You don't have to figure this out alone",
  aiCoach: "Ask your career coach",
  careerHome: "Home",
  roleMatches: "Keyword matches",
  scenarioLab: "Analyse laboratory",
}

export const DOCUMENTS_PAGE_SUBTITLE =
  "Your German CV, cover letters, and supporting documents — all in one place." as const

export function pageTitleForSection(sectionKey: string): string {
  const h1 = SECTION_PAGE_H1[sectionKey]
  return h1 ? `${h1} · EquitAI` : "EquitAI"
}

export function firstNameFromUserName(userName?: string): string {
  if (!userName?.trim()) return "there"
  return userName.trim().split(/\s+/)[0] ?? "there"
}
