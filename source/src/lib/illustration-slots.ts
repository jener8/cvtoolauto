/** Each slot maps to exactly one editorial image — no repeats across the app. */
export const ILLUSTRATION_SLOTS = [
  "section.careerBrain",
  "section.documents",
  "section.coverLetters",
  "section.savedDocuments",
  "section.applications",
  "section.recognitionPathways",
  "section.workplaceGerman",
  "section.bureaucracyNavigator",
  "section.mentoringSupport",
  "section.aiJobSearchGuide",
  "home.nextStep",
  "progress.journeyAccent",
  "progress.motivation",
  "progress.story",
  "careerBrain.hero",
  "careerBrain.aiCoach",
  "wizard.intro",
  "wizard.study",
  "wizard.field",
  "wizard.experience",
  "wizard.recognition",
  "wizard.documents",
  "wizard.complete",
  "marketing.heroPlatform",
  "marketing.equity",
  "marketing.trustShield",
  "marketing.bespokeLab",
  "marketing.cvTemplates",
] as const

export type IllustrationSlot = (typeof ILLUSTRATION_SLOTS)[number]

/** URL-safe filename — avoids dots in static asset paths (CDN issues). */
export function slotToFilename(slot: IllustrationSlot): string {
  return `${slot.replace(/\./g, "-")}.png`
}

const SLOT_SRC = (slot: IllustrationSlot) => `/illustrations/slots/${slotToFilename(slot)}`

export const ILLUSTRATION_SLOT_META: Record<IllustrationSlot, { src: string; alt: string }> = {
  "section.careerBrain": {
    src: SLOT_SRC("section.careerBrain"),
    alt: "Reflecting on your strengths and career direction",
  },
  "section.documents": {
    src: SLOT_SRC("section.documents"),
    alt: "Preparing your CV and application documents",
  },
  "section.coverLetters": {
    src: SLOT_SRC("section.coverLetters"),
    alt: "Writing a cover letter in your own voice",
  },
  "section.savedDocuments": {
    src: SLOT_SRC("section.savedDocuments"),
    alt: "Your qualifications and certificates",
  },
  "section.applications": {
    src: SLOT_SRC("section.applications"),
    alt: "Working on job applications with focus",
  },
  "section.recognitionPathways": {
    src: SLOT_SRC("section.recognitionPathways"),
    alt: "Your qualifications and recognition pathway",
  },
  "section.workplaceGerman": {
    src: SLOT_SRC("section.workplaceGerman"),
    alt: "Your career story and personal growth",
  },
  "section.bureaucracyNavigator": {
    src: SLOT_SRC("section.bureaucracyNavigator"),
    alt: "Navigating paperwork and official processes",
  },
  "section.mentoringSupport": {
    src: SLOT_SRC("section.mentoringSupport"),
    alt: "Two professionals connecting with support and mentorship",
  },
  "section.aiJobSearchGuide": {
    src: SLOT_SRC("section.aiJobSearchGuide"),
    alt: "Searching for opportunities that fit you",
  },
  "home.nextStep": {
    src: SLOT_SRC("home.nextStep"),
    alt: "Your next step on the career journey",
  },
  "progress.journeyAccent": {
    src: SLOT_SRC("progress.journeyAccent"),
    alt: "Celebrating how far you have come",
  },
  "progress.motivation": {
    src: SLOT_SRC("progress.motivation"),
    alt: "Climbing toward your next career milestone",
  },
  "progress.story": {
    src: SLOT_SRC("progress.story"),
    alt: "Interview confidence and professional connection",
  },
  "careerBrain.hero": {
    src: SLOT_SRC("careerBrain.hero"),
    alt: "Tell us about you, in your own words",
  },
  "careerBrain.aiCoach": {
    src: SLOT_SRC("careerBrain.aiCoach"),
    alt: "AI coaching support for your job search",
  },
  "wizard.intro": {
    src: SLOT_SRC("wizard.intro"),
    alt: "Starting your qualification profile",
  },
  "wizard.study": {
    src: SLOT_SRC("wizard.study"),
    alt: "Where and what you studied",
  },
  "wizard.field": {
    src: SLOT_SRC("wizard.field"),
    alt: "Your field of expertise",
  },
  "wizard.experience": {
    src: SLOT_SRC("wizard.experience"),
    alt: "Your professional experience",
  },
  "wizard.recognition": {
    src: SLOT_SRC("wizard.recognition"),
    alt: "Recognition status in Germany",
  },
  "wizard.documents": {
    src: SLOT_SRC("wizard.documents"),
    alt: "Supporting documents for your profile",
  },
  "wizard.complete": {
    src: SLOT_SRC("wizard.complete"),
    alt: "Your qualification profile is complete",
  },
  "marketing.heroPlatform": {
    src: SLOT_SRC("marketing.heroPlatform"),
    alt: "EquitAI career platform — CVs and applications powered by a central AI core",
  },
  "marketing.equity": {
    src: SLOT_SRC("marketing.equity"),
    alt: "Diverse hands holding a glowing frame over a city — equitable career access",
  },
  "marketing.trustShield": {
    src: SLOT_SRC("marketing.trustShield"),
    alt: "EquitAI security — responsible AI and data protection by design",
  },
  "marketing.bespokeLab": {
    src: SLOT_SRC("marketing.bespokeLab"),
    alt: "Bespoke EquitAI tools — engineered in a high-tech lab environment",
  },
  "marketing.cvTemplates": {
    src: SLOT_SRC("marketing.cvTemplates"),
    alt: "Professional CV templates tailored to your career journey",
  },
}
