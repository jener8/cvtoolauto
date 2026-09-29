import { isQualificationWizardComplete } from "@/lib/qualification-profile/storage"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { hasStrategicProfileContent, type StrategicProfile } from "@/lib/strategic-profile"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"
import type { WorkspaceNavId } from "@/lib/workspace-navigation"

export type CareerMilestone = {
  id: string
  shortLabel: string
  doneLabel: string
  done: boolean
}

export type CareerRecommendationDirectAction = "openResume"

export type CareerRecommendation = {
  navId: WorkspaceNavId
  directAction?: CareerRecommendationDirectAction
  emoji: string
  title: string
  description: string
  estimatedTime?: string
  ctaLabel: string
}

export type CareerJourneyGuide = {
  achievements: CareerMilestone[]
  opportunities: CareerMilestone[]
  recommendation: CareerRecommendation
  encouragement: string
  foundationMessage: string
  impact: string | null
}

function hasResumeContent(versions: ResumeVersion[]): boolean {
  return versions.some((v) => Boolean(v.resumeText?.trim()))
}

function hasInterviewActivity(jobs: JobApplication[]): boolean {
  return jobs.some((job) => {
    const pipeline = job.pipeline ?? []
    if (
      pipeline.some((stage) =>
        ["hiring_manager_interview_1", "hiring_manager_interview_2", "final_interview"].includes(
          stage.stage,
        ),
      )
    ) {
      return true
    }
    const prep = job.interviewPrep
    if (!prep) return false
    return Boolean(
      prep.questions?.length ||
        prep.projectStories?.length ||
        prep.interviewers?.length ||
        prep.generalNotes?.trim(),
    )
  })
}

const RECOMMENDATIONS: CareerRecommendation[] = [
  {
    navId: "careerBrain",
    emoji: "✨",
    title: "Tell your career story",
    description:
      "A few sentences about your experience and goals help us personalise your CV, cover letters, and job guidance.",
    estimatedTime: "15 minutes",
    ctaLabel: "Start your story →",
  },
  {
    navId: "recognitionPathways",
    emoji: "📜",
    title: "Add your qualifications",
    description:
      "Understanding your education and experience helps us suggest recognition pathways and prepare you for advisor conversations.",
    estimatedTime: "10 minutes",
    ctaLabel: "Add my qualification",
  },
  {
    navId: "applications",
    directAction: "openResume",
    emoji: "📄",
    title: "Create your German CV",
    description:
      "A clear, German-style CV is often the first thing employers look at. We'll guide you section by section.",
    estimatedTime: "30 minutes",
    ctaLabel: "Start my CV",
  },
  {
    navId: "applications",
    emoji: "🎯",
    title: "Track your first application",
    description:
      "Adding a job you've applied for helps you stay organised and unlocks interview prep and progress insights.",
    estimatedTime: "5 minutes",
    ctaLabel: "Add an application",
  },
  {
    navId: "applications",
    emoji: "💬",
    title: "Prepare for interviews",
    description:
      "You've started applying — now build confidence with practice questions and stories tailored to your experience.",
    estimatedTime: "20 minutes",
    ctaLabel: "Prepare for interviews",
  },
  {
    navId: "workplaceGerman",
    emoji: "🇩🇪",
    title: "Improve your workplace German",
    description:
      "Learning common workplace language can make conversations with employers easier and help you feel more confident.",
    estimatedTime: "20 minutes",
    ctaLabel: "Browse phrases",
  },
  {
    navId: "mentoringSupport",
    emoji: "🤝",
    title: "Explore your support network",
    description:
      "Mentors, coaches, and peer groups can offer guidance that's hard to find alone — especially in a new country.",
    estimatedTime: "10 minutes",
    ctaLabel: "Find support",
  },
  {
    navId: "bureaucracyNavigator",
    emoji: "📋",
    title: "Things to take care of",
    description:
      "Work permit, tax ID, insurance — work through the checklist at your own pace so nothing catches you off guard.",
    estimatedTime: "15 minutes",
    ctaLabel: "See the checklist",
  },
]

function encouragementFor(doneCount: number): string {
  if (doneCount === 0) return "Every small step builds your future."
  if (doneCount === 1) return "You've taken your first step — that's how every career begins."
  if (doneCount <= 3) return "You're building a strong foundation."
  if (doneCount === 4) return "You're making great progress."
  return "Keep going — you've already achieved a lot."
}

function foundationMessageFor(doneCount: number, storyDone: boolean): string {
  if (!storyDone) return "Tell us a little about yourself — no perfect answers needed."
  if (doneCount === 0) return "Tell us a little about yourself — no perfect answers needed."
  if (doneCount <= 2) return "You're laying the groundwork for what's ahead."
  if (doneCount <= 4) return "You've already built a strong foundation."
  return "Look how far you've come."
}

function impactMessage(input: {
  storyDone: boolean
  qualificationsDone: boolean
  cvDone: boolean
  applicationsCount: number
  interviewActivity: boolean
}): string | null {
  if (input.applicationsCount >= 3) {
    return "Because you've applied for several jobs, we can begin identifying patterns that improve your chances."
  }
  if (input.interviewActivity) {
    return "Because you're preparing for interviews, we can help you practise answers that sound like you."
  }
  if (input.qualificationsDone) {
    return "Because you've added your qualifications, we can suggest recognition pathways and advisor questions."
  }
  if (input.storyDone) {
    return "Because you've completed your Career Story, your CVs and cover letters can now be personalised."
  }
  if (input.cvDone) {
    return "Because you have a CV, you can tailor it for each role — small changes often make a big difference."
  }
  return null
}

export function computeCareerJourneyGuide(input: {
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  versions: ResumeVersion[]
  jobApplications: JobApplication[]
}): CareerJourneyGuide {
  const storyDone = hasStrategicProfileContent(input.strategicProfile)
  const qualificationsDone = isQualificationWizardComplete(input.qualificationProfile)
  const cvDone = hasResumeContent(input.versions)
  const applicationsDone = input.jobApplications.length > 0
  const interviewActivity = hasInterviewActivity(input.jobApplications)

  const milestones: CareerMilestone[] = [
    {
      id: "story",
      shortLabel: "Career story",
      doneLabel: "Career story completed",
      done: storyDone,
    },
    {
      id: "qualifications",
      shortLabel: "Qualifications",
      doneLabel: "Qualifications added",
      done: qualificationsDone,
    },
    {
      id: "cv",
      shortLabel: "CV",
      doneLabel: "CV created",
      done: cvDone,
    },
    {
      id: "applications",
      shortLabel: "Applications",
      doneLabel: "First application submitted",
      done: applicationsDone,
    },
    {
      id: "interview",
      shortLabel: "Interview prep",
      doneLabel: "Interview preparation started",
      done: interviewActivity,
    },
    {
      id: "phraseLibrary",
      shortLabel: "Workplace language",
      doneLabel: "Phrase library explored",
      done: false,
    },
    {
      id: "networking",
      shortLabel: "Support network",
      doneLabel: "Support network explored",
      done: false,
    },
  ]

  const achievements = milestones.filter((m) => m.done)
  const opportunities = milestones.filter((m) => !m.done)
  const doneCount = achievements.length

  let recommendation: CareerRecommendation
  if (!storyDone) recommendation = RECOMMENDATIONS[0]!
  else if (!qualificationsDone) recommendation = RECOMMENDATIONS[1]!
  else if (!cvDone) recommendation = RECOMMENDATIONS[2]!
  else if (!applicationsDone) recommendation = RECOMMENDATIONS[3]!
  else if (!interviewActivity) recommendation = RECOMMENDATIONS[4]!
  else recommendation = RECOMMENDATIONS[5]!

  return {
    achievements,
    opportunities,
    recommendation,
    encouragement: encouragementFor(doneCount),
    foundationMessage: foundationMessageFor(doneCount, storyDone),
    impact: impactMessage({
      storyDone,
      qualificationsDone,
      cvDone,
      applicationsCount: input.jobApplications.length,
      interviewActivity,
    }),
  }
}
