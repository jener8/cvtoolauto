import { hasStrategicProfileContent, type StrategicProfile } from "@/lib/strategic-profile"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { isQualificationWizardComplete } from "@/lib/qualification-profile/storage"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"
import { JOURNEY_STRIP_STEPS } from "@/lib/workspace-shell-copy"

export type JourneyStepState = "done" | "active" | "future"

export type SidebarJourneyStep = {
  id: string
  label: string
  done: boolean
}

export type WorkspaceJourneyProgress = {
  completedCount: number
  totalSteps: number
  nextStepLabel: string | null
  sidebarSteps: SidebarJourneyStep[]
  stripSteps: Array<{ id: string; label: string; state: JourneyStepState }>
}

function hasResumeContent(versions: ResumeVersion[]): boolean {
  return versions.some((v) => Boolean(v.resumeText?.trim()))
}

function hasCoverLetterContent(coverLetters: CoverLetter[]): boolean {
  return coverLetters.some((l) => Boolean(l.contentEn?.trim() || l.contentDe?.trim()))
}

function hasInterviewActivity(jobs: JobApplication[]): boolean {
  return jobs.some((job) => {
    const pipeline = job.pipeline ?? []
    const interviewStages = pipeline.some((stage) =>
      [
        "hiring_manager_interview_1",
        "hiring_manager_interview_2",
        "final_interview",
      ].includes(stage.stage),
    )
    if (interviewStages) return true
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

/** Sidebar milestones — derived from existing workspace data only. */
export function computeWorkspaceJourneyProgress(input: {
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  versions: ResumeVersion[]
  coverLetters: CoverLetter[]
  jobApplications: JobApplication[]
}): WorkspaceJourneyProgress {
  const sidebarSteps: SidebarJourneyStep[] = [
    {
      id: "story",
      label: "My story",
      done: hasStrategicProfileContent(input.strategicProfile),
    },
    {
      id: "cv",
      label: "Build your CV",
      done: hasResumeContent(input.versions) || hasCoverLetterContent(input.coverLetters),
    },
    {
      id: "applications",
      label: "My applications",
      done: input.jobApplications.length > 0,
    },
    {
      id: "recognition",
      label: "My qualifications",
      done: isQualificationWizardComplete(input.qualificationProfile),
    },
    {
      id: "workplaceGerman",
      label: "Workplace German",
      done: false,
    },
    {
      id: "bureaucracy",
      label: "Things to take care of",
      done: false,
    },
    {
      id: "support",
      label: "Find support",
      done: false,
    },
  ]

  const completedCount = sidebarSteps.filter((s) => s.done).length
  const next = sidebarSteps.find((s) => !s.done)

  const storyDone = sidebarSteps[0]!.done
  const cvDone = sidebarSteps[1]!.done
  const recognitionDone = sidebarSteps[3]!.done
  const applyDone = sidebarSteps[2]!.done
  const interviewDone = hasInterviewActivity(input.jobApplications)

  const stripCompletion = [storyDone, cvDone, recognitionDone, applyDone, interviewDone]
  let activeIndex = stripCompletion.findIndex((done) => !done)
  if (activeIndex === -1) activeIndex = JOURNEY_STRIP_STEPS.length - 1

  const stripSteps = JOURNEY_STRIP_STEPS.map((step, index) => {
    let state: JourneyStepState = "future"
    if (stripCompletion[index]) state = "done"
    else if (index === activeIndex) state = "active"
    return { id: step.id, label: step.label, state }
  })

  return {
    completedCount,
    totalSteps: sidebarSteps.length,
    nextStepLabel: next?.label ?? null,
    sidebarSteps,
    stripSteps,
  }
}
