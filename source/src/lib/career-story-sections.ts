import type { StrategicProfile } from "@/lib/strategic-profile"
import type { LucideIcon } from "lucide-react"
import { Heart, Route, Sparkles, Sprout } from "lucide-react"

export type CareerStoryFieldKey =
  | "careerDirection"
  | "professionalStrengths"
  | "strategicEmphasis"
  | "longTermGoal"

export type CareerStoryAccent = "teal" | "rose" | "amber"

export type CareerStorySection = {
  key: CareerStoryFieldKey
  label: string
  cardLabel: string
  question: string
  hint: string
  placeholder: string
  why: string
  icon: LucideIcon
  accent: CareerStoryAccent
  chips?: string[]
}

export const CAREER_STORY_SECTIONS: CareerStorySection[] = [
  {
    key: "careerDirection",
    label: "What kind of work do you want to do?",
    cardLabel: "Where you're heading",
    question: "What kind of work do you want to do?",
    hint: "The roles or areas you want to work in.",
    placeholder: "e.g. working with people, teaching, healthcare, technology, design...",
    why: "Helps AI tailor CVs, cover letters, and job suggestions to roles you actually want.",
    icon: Route,
    accent: "teal",
    chips: ["working with people", "teaching", "healthcare", "technology", "design"],
  },
  {
    key: "professionalStrengths",
    label: "What do you do well?",
    cardLabel: "What you do well",
    question: "What do you do well?",
    hint: "Your skills, achievements, and what others appreciate about you.",
    placeholder:
      "e.g. I listen carefully, I solve problems under pressure, I build trust with people quickly...",
    why: "Highlights what makes you stand out — skills, achievements, and what others appreciate about you.",
    icon: Sparkles,
    accent: "rose",
  },
  {
    key: "strategicEmphasis",
    label: "What matters to you in your work?",
    cardLabel: "What matters to you",
    question: "What matters to you in your work?",
    hint: "Topics, industries or impact that motivate you.",
    placeholder: "e.g. helping people, working in a team, making something with my hands, fairness...",
    why: "Guides applications and interview answers toward topics and impact that motivate you.",
    icon: Heart,
    accent: "amber",
  },
  {
    key: "longTermGoal",
    label: "Where do you want to go next?",
    cardLabel: "Where you're going next",
    question: "Where do you want to go next?",
    hint: "Your longer-term goals and the kind of future you're building.",
    placeholder:
      "e.g. I want to work in a new field, get my qualifications recognised, find something stable...",
    why: "Shapes longer-term suggestions, learning paths, and career conversations with mentors.",
    icon: Sprout,
    accent: "teal",
  },
]

export const JOB_SEARCH_HARD_CHIPS = [
  "My qualifications aren't recognised here",
  "I'm still learning the language",
  "I don't have a local network yet",
  "I'm not sure what roles suit me",
  "Care responsibilities make it complicated",
] as const

export function storySectionValue(
  profile: StrategicProfile,
  key: CareerStoryFieldKey,
): string {
  return profile[key]?.trim() ?? ""
}

export function storySectionsCompleted(profile: StrategicProfile): number {
  return CAREER_STORY_SECTIONS.filter((section) => storySectionValue(profile, section.key)).length
}
