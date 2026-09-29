import type { TablerIcon } from "@tabler/icons-react"
import {
  IconCertificate,
  IconCrosshair,
  IconHeart,
  IconHome,
  IconLanguage,
  IconListCheck,
  IconMap2,
  IconRobot,
  IconTestPipe,
  IconTrendingUp,
  IconUserHeart,
} from "@tabler/icons-react"

/** Primary workspace navigation — EquitAI shell. */
export type WorkspaceNavId =
  | "careerHome"
  | "careerBrain"
  | "roleMatches"
  | "applications"
  | "recognitionPathways"
  | "workplaceGerman"
  | "bureaucracyNavigator"
  | "mentoringSupport"
  | "progress"
  | "scenarioLab"
  | "aiCoach"
  | "settings"

export type WorkspaceNavGroupId =
  | "whereIAmNow"
  | "myApplications"
  | "gettingSettled"
  | "tools"

export type WorkspaceNavItem = {
  id: WorkspaceNavId
  label: string
  subtext?: string
  icon: TablerIcon
  group: WorkspaceNavGroupId
}

export const WORKSPACE_NAV_GROUPS: Array<{ id: WorkspaceNavGroupId; label: string }> = [
  { id: "whereIAmNow", label: "WHERE I AM NOW" },
  { id: "myApplications", label: "MY APPLICATIONS" },
  { id: "gettingSettled", label: "GETTING SETTLED" },
  { id: "tools", label: "TOOLS" },
]

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    id: "careerHome",
    label: "Home",
    subtext: "Your next step",
    icon: IconHome,
    group: "whereIAmNow",
  },
  {
    id: "careerBrain",
    label: "My story",
    subtext: "Experience, skills, journey",
    icon: IconUserHeart,
    group: "whereIAmNow",
  },
  {
    id: "roleMatches",
    label: "Keyword matches",
    subtext: "Find jobs by skill",
    icon: IconCrosshair,
    group: "whereIAmNow",
  },
  {
    id: "applications",
    label: "My applications",
    subtext: "Track your progress",
    icon: IconListCheck,
    group: "myApplications",
  },
  {
    id: "recognitionPathways",
    label: "What qualifies you",
    subtext: "Credentials, experience, abilities",
    icon: IconCertificate,
    group: "gettingSettled",
  },
  {
    id: "workplaceGerman",
    label: "Phrase library",
    subtext: "Describe your experience",
    icon: IconLanguage,
    group: "gettingSettled",
  },
  {
    id: "bureaucracyNavigator",
    label: "Things to take care of",
    subtext: "Work permit, tax ID & more",
    icon: IconMap2,
    group: "gettingSettled",
  },
  {
    id: "mentoringSupport",
    label: "Find support",
    subtext: "Mentors, coaches, groups",
    icon: IconHeart,
    group: "gettingSettled",
  },
  {
    id: "progress",
    label: "Progress",
    subtext: "See how you're doing",
    icon: IconTrendingUp,
    group: "tools",
  },
  {
    id: "scenarioLab",
    label: "Analyse laboratory",
    subtext: "My scenario",
    icon: IconTestPipe,
    group: "tools",
  },
  {
    id: "aiCoach",
    label: "AI assistant",
    subtext: "Ask anything",
    icon: IconRobot,
    group: "tools",
  },
]

export type AppSectionView =
  | "folders"
  | "careerHome"
  | "opportunities"
  | "dashboard"
  | "careerBrain"
  | "roleMatches"
  | "statistics"
  | "scenarioLab"
  | "aiCoach"
  | "settings"
  | "recognitionPathways"
  | "workplaceGerman"
  | "mentoringSupport"
  | "bureaucracyNavigator"
  | "aiJobSearchGuide"
  | "programme"
  | "resume"
  | "coverLetter"
  | "jobCoverLetter"
  | "interviewPrep"
  | "companyInfo"
  | "contacts"
  | "jobStrategy"

const INTEGRATION_NAV_VIEWS: AppSectionView[] = [
  "recognitionPathways",
  "workplaceGerman",
  "mentoringSupport",
  "bureaucracyNavigator",
]

export function workspaceNavFromView(view: AppSectionView): WorkspaceNavId {
  switch (view) {
    case "careerHome":
      return "careerHome"
    case "opportunities":
      return "applications"
    case "dashboard":
      return "applications"
    case "careerBrain":
      return "careerBrain"
    case "roleMatches":
      return "roleMatches"
    case "statistics":
      return "progress"
    case "scenarioLab":
      return "scenarioLab"
    case "aiCoach":
      return "aiCoach"
    case "settings":
    case "programme":
      return "settings"
    case "recognitionPathways":
      return "recognitionPathways"
    case "workplaceGerman":
      return "workplaceGerman"
    case "mentoringSupport":
      return "mentoringSupport"
    case "bureaucracyNavigator":
      return "bureaucracyNavigator"
    default:
      return "applications"
  }
}

export function viewFromWorkspaceNav(id: WorkspaceNavId): AppSectionView {
  switch (id) {
    case "careerHome":
      return "careerHome"
    case "careerBrain":
      return "careerBrain"
    case "roleMatches":
      return "roleMatches"
    case "applications":
      return "dashboard"
    case "recognitionPathways":
      return "recognitionPathways"
    case "workplaceGerman":
      return "workplaceGerman"
    case "mentoringSupport":
      return "mentoringSupport"
    case "bureaucracyNavigator":
      return "bureaucracyNavigator"
    case "progress":
      return "statistics"
    case "scenarioLab":
      return "scenarioLab"
    case "aiCoach":
      return "aiCoach"
    case "settings":
      return "settings"
    default:
      return "careerHome"
  }
}

export function isIntegrationNavView(view: AppSectionView): boolean {
  return INTEGRATION_NAV_VIEWS.includes(view)
}
