import type { AbilityCategory } from "@/lib/qualification-profile/types"

export type QualificationTablet = {
  id: string
  label: string
  category: AbilityCategory
}

export type QualificationTabletGroup = {
  label: string
  tablets: QualificationTablet[]
}

export const QUALIFICATION_TABLET_PREFIX = "qt-"

export function isSuggestionTabletId(id: string): boolean {
  return id.startsWith(QUALIFICATION_TABLET_PREFIX)
}

export const QUALIFICATION_TABLET_GROUPS: QualificationTabletGroup[] = [
  {
    label: "Working with people",
    tablets: [
      { id: "qt-organising-people", label: "Organising people", category: "working_with_people" },
      { id: "qt-team-collaboration", label: "Working well in teams", category: "working_with_people" },
      { id: "qt-supporting-others", label: "Supporting others through change", category: "working_with_people" },
      { id: "qt-active-listening", label: "Listening and empathising", category: "working_with_people" },
      { id: "qt-customer-service", label: "Customer service experience", category: "working_with_people" },
      { id: "qt-mentoring", label: "Mentoring or coaching others", category: "teaching_explaining" },
      { id: "qt-teaching-explaining", label: "Teaching or explaining things clearly", category: "teaching_explaining" },
      { id: "qt-facilitation", label: "Facilitating workshops or meetings", category: "working_with_people" },
    ],
  },
  {
    label: "Learning & growth",
    tablets: [
      { id: "qt-curious-learner", label: "Curious to learn new things", category: "other" },
      { id: "qt-self-taught", label: "Teaching myself new skills", category: "other" },
      { id: "qt-quick-tools", label: "Picking up tools quickly", category: "digital_tools" },
      { id: "qt-adapt-change", label: "Adapting to new environments", category: "other" },
      { id: "qt-problem-solving", label: "Solving problems creatively", category: "other" },
      { id: "qt-attention-detail", label: "Strong attention to detail", category: "organising_planning" },
    ],
  },
  {
    label: "Languages",
    tablets: [
      { id: "qt-multilingual", label: "Speak multiple languages", category: "languages" },
      { id: "qt-translate", label: "Translating or interpreting", category: "languages" },
      { id: "qt-bilingual-writing", label: "Writing in more than one language", category: "languages" },
      { id: "qt-present-groups", label: "Presenting ideas to groups", category: "teaching_explaining" },
    ],
  },
  {
    label: "Organising & planning",
    tablets: [
      { id: "qt-project-planning", label: "Planning projects and timelines", category: "organising_planning" },
      { id: "qt-event-coordination", label: "Coordinating events or workshops", category: "organising_planning" },
      { id: "qt-budgets", label: "Managing budgets or resources", category: "organising_planning" },
      { id: "qt-spreadsheets", label: "Spreadsheets & accurate records", category: "digital_tools" },
      { id: "qt-process-improvement", label: "Improving how things work", category: "organising_planning" },
    ],
  },
  {
    label: "Digital & technical",
    tablets: [
      { id: "qt-digital-comfort", label: "Comfortable with digital tools", category: "digital_tools" },
      { id: "qt-new-software", label: "Learning new software fast", category: "digital_tools" },
      { id: "qt-design-thinking", label: "UX or design thinking", category: "digital_tools" },
      { id: "qt-data-analysis", label: "Data analysis", category: "digital_tools" },
      { id: "qt-responsible-ai", label: "Using AI responsibly", category: "digital_tools" },
      { id: "qt-craft-technical", label: "Hands-on technical skills", category: "craft_technical" },
    ],
  },
  {
    label: "Life & community",
    tablets: [
      { id: "qt-family-care", label: "Caring for family members", category: "working_with_people" },
      { id: "qt-volunteering", label: "Volunteering in my community", category: "working_with_people" },
      { id: "qt-community-lead", label: "Leading community initiatives", category: "working_with_people" },
      { id: "qt-informal-work", label: "Informal or family work experience", category: "other" },
      { id: "qt-living-abroad", label: "Living and working abroad", category: "other" },
    ],
  },
]

export const ALL_QUALIFICATION_TABLETS: QualificationTablet[] = QUALIFICATION_TABLET_GROUPS.flatMap(
  (group) => group.tablets,
)

export function findTabletById(id: string): QualificationTablet | undefined {
  return ALL_QUALIFICATION_TABLETS.find((tablet) => tablet.id === id)
}
