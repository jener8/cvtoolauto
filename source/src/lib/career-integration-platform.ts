import type { LucideIcon } from "lucide-react"
import {
  Award,
  BookOpen,
  Briefcase,
  FileText,
  HeartHandshake,
  Languages,
  Map,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react"

/** Career Integration Platform — user-facing copy and section definitions. */

export const PLATFORM_MISSION =
  "A career integration platform for refugee women and women with migration or refugee experience building employment pathways in Germany."

export const DASHBOARD_HERO = {
  headline: "Your experience matters here.\nLet's build your path forward.",
  subtext:
    "What you know, who you are, and where you've worked — all of it counts. This platform helps you translate your career into the German job market, step by step.",
} as const

export const PROGRAMME_FRAMING =
  "This platform can be used by NGOs, women's centres, refugee organisations, education providers, and foundations as part of employment support, mentoring, or career integration programmes."

export const PROGRAMME_FUNDING_NOTE =
  "Access can be sponsored by organisations so women can use the tool for free while AI and platform costs are covered through programme funding, foundation grants, or partner licences."

export type IntegrationSectionId =
  | "recognitionPathways"
  | "workplaceGerman"
  | "mentoringSupport"
  | "bureaucracyNavigator"
  | "aiJobSearchGuide"

export type CareerActionId =
  | "createCv"
  | "coverLetter"
  | "careerStory"
  | "trackApplications"
  | "recognition"
  | "workplaceGerman"
  | "interviewPrep"
  | "mentoring"
  | "bureaucracy"
  | "aiSafety"

export type CareerActionCard = {
  id: CareerActionId
  title: string
  description: string
  icon: LucideIcon
  target: IntegrationSectionId | "resume" | "applications" | "careerStory" | "interviewPrep"
}

export const CAREER_ACTION_CARDS: CareerActionCard[] = [
  {
    id: "createCv",
    title: "Create or improve my CV",
    description: "German-style CVs with versioning, ATS formatting, and AI support.",
    icon: FileText,
    target: "resume",
  },
  {
    id: "coverLetter",
    title: "Write a cover letter",
    description: "Tailored cover letters linked to your applications.",
    icon: MessageSquare,
    target: "resume",
  },
  {
    id: "careerStory",
    title: "Build my career story",
    description: "Turn lived experience into a confident employment narrative.",
    icon: BookOpen,
    target: "careerStory",
  },
  {
    id: "trackApplications",
    title: "Track my applications",
    description: "Follow job search progress, stages, and outcomes.",
    icon: Briefcase,
    target: "applications",
  },
  {
    id: "recognition",
    title: "Understand recognition steps",
    description: "Collect documents and prepare questions for qualification advisors.",
    icon: Award,
    target: "recognitionPathways",
  },
  {
    id: "workplaceGerman",
    title: "Practice workplace German",
    description: "Application phrases, interview language, and job-specific vocabulary.",
    icon: Languages,
    target: "workplaceGerman",
  },
  {
    id: "interviewPrep",
    title: "Prepare for an interview",
    description: "STAR stories, practice answers, and role-specific preparation.",
    icon: Users,
    target: "interviewPrep",
  },
  {
    id: "mentoring",
    title: "Find mentoring and support",
    description: "Connect with coaches, NGOs, and your support network.",
    icon: HeartHandshake,
    target: "mentoringSupport",
  },
  {
    id: "bureaucracy",
    title: "Things to take care of",
    description:
      "Work permit, tax ID, insurance — a checklist to work through before your first day.",
    icon: Map,
    target: "bureaucracyNavigator",
  },
  {
    id: "aiSafety",
    title: "Learn to use AI safely",
    description: "Privacy-aware guidance for responsible AI-supported job searching.",
    icon: Shield,
    target: "aiJobSearchGuide",
  },
]

export type IntegrationSectionConfig = {
  id: IntegrationSectionId
  title: string
  subtitle: string
  icon: LucideIcon
  disclaimer?: string
  comingSoonLabel: string
  checklist: string[]
  prepareForAdvisor?: string[]
  futureNote: string
}

export const INTEGRATION_SECTIONS: Record<IntegrationSectionId, IntegrationSectionConfig> = {
  recognitionPathways: {
    id: "recognitionPathways",
    title: "What qualifies you",
    subtitle:
      "Tap the ideas that sound like you — skills, experience and strengths all count, with or without certificates.",
    icon: Award,
    disclaimer:
      "This tool does not provide legal advice. It helps you organise information and questions for qualified advisors.",
    comingSoonLabel: "Guided recognition checklists and document collection are coming soon.",
    checklist: [
      "Your original degree or vocational certificates (with certified translations if needed)",
      "Syllabus or module descriptions from your training institution",
      "Proof of professional experience in your field",
      "Residence permit or work permission documents (for advisor context only)",
      "Any prior recognition decisions or partial recognition letters",
    ],
    prepareForAdvisor: [
      "Is recognition required for the roles I am targeting?",
      "Which authority (ZAB, IHK, HWK, chamber) applies to my qualification?",
      "Can I work while recognition is in progress?",
      "What bridging options or adaptation courses exist in my region?",
      "What options exist if full recognition isn't possible — are there bridging roles or equivalency routes?",
    ],
    futureNote:
      "Future versions will help you track recognition status and link documents to your career profile.",
  },
  workplaceGerman: {
    id: "workplaceGerman",
    title: "Phrase library",
    subtitle:
      "Starting points to describe your experience and strengths — always in your own words. Edit anything before you use it.",
    icon: Languages,
    comingSoonLabel: "Phrase libraries and German rewriting support are coming soon.",
    checklist: [
      "Find phrases that describe your international experience",
      "Learn how to talk about care work as professional experience",
      "Practise describing your strengths in German workplace language",
      "Build a set of phrases ready for interviews and cover letters",
      "Use AI Coach to adapt any phrase for a specific role — always review the result",
    ],
    futureNote:
      "Future versions will include role-specific phrase packs and audio practice for interviews.",
  },
  mentoringSupport: {
    id: "mentoringSupport",
    title: "Mentoring & Support",
    subtitle:
      "A curated, team-reviewed directory of mentors, women's groups, refugee support centres, and career services — with AI matching and optional web search.",
    icon: HeartHandshake,
    comingSoonLabel: "",
    checklist: [],
    futureNote:
      "Organisation data is editable via seed JSON or CSV import. Replace placeholder entries before production.",
  },
  bureaucracyNavigator: {
    id: "bureaucracyNavigator",
    title: "Bureaucracy Navigator",
    subtitle:
      "Work permits, tax ID, social insurance, bank account — this guide helps you understand what each document is for and what questions to bring to your advisor.",
    icon: Map,
    disclaimer:
      "This is not legal advice. Requirements vary by status, region, and role. Always confirm with official advisors.",
    comingSoonLabel: "Personalised document checklists are coming soon.",
    checklist: [
      "Residence title and work permission (if applicable to your situation)",
      "Tax identification number (Steueridentifikationsnummer)",
      "Social insurance number (Sozialversicherungsnummer)",
      "Bank account for salary payments",
      "Childcare arrangements if relevant to your working hours",
      "Recognition documents or certificates required for regulated professions",
      "Health insurance proof for employment registration",
      "Write down any questions you have before your Jobcenter appointment",
    ],
    prepareForAdvisor: [
      "What documents do I need before my first day of work?",
      "Who do I contact if my work permission conditions change?",
      "Which certificates must employers see at the interview stage vs. after an offer?",
    ],
    futureNote:
      "Future versions will let you track which documents you have gathered and what is still needed.",
  },
  aiJobSearchGuide: {
    id: "aiJobSearchGuide",
    title: "AI Job Search Guide",
    subtitle:
      "Use AI as a supportive tool — with privacy, control, and confidence-building practices.",
    icon: Shield,
    comingSoonLabel: "Interactive safety tutorials are coming soon.",
    checklist: [
      "Do not paste sensitive personal data (full ID numbers, asylum case details) into AI tools unnecessarily",
      "Always read and edit AI-generated CV and cover letter text before sending",
      "Verify facts: dates, employers, and achievements must match your real experience",
      "Use AI to explore wording and structure — you decide what represents you",
      "Keep copies of your final applications; AI suggestions are drafts, not submissions",
      "Ask a mentor or advisor to review important applications when possible",
    ],
    futureNote:
      "This guide will expand with scenario-based examples for refugee women navigating German job applications.",
  },
}

export const NAV_LABELS = {
  careerHome: "Home",
  opportunities: "Opportunities",
  applications: "Job search",
  careerBrain: "Career Brain",
  documents: "Career documents",
  intelligence: "Progress",
  aiCoach: "AI Coach",
  settings: "Settings",
} as const

export const CAREER_STORY_LABEL = "My Career Story"

export const APPLICATIONS_PAGE = {
  title: "Your job search",
  subtitle:
    "Track applications, interview stages, and outcomes — your employment pathway in one place.",
} as const

export const DOCUMENTS_PAGE = {
  title: "Documents",
  subtitle:
    "Your German CV, cover letters, and supporting documents — all in one place.",
} as const
