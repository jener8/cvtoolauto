/**
 * Static "how to" steps for default document checklist tasks.
 *
 * ⚠️ REVIEW REQUIRED BEFORE PRODUCTION SHIP
 * Replace with fact-checked German-context guidance before major releases.
 * `reviewRequired` is for internal tracking only — not shown in the UI.
 */

export type DefaultDocumentTaskGuidance = {
  systemId: string
  label: string
  steps: string[]
  /** Internal flag for content review — not shown in the UI */
  reviewRequired: boolean
}

export const DEFAULT_DOCUMENT_TASK_GUIDANCE: DefaultDocumentTaskGuidance[] = [
  {
    systemId: "residence-work-permit",
    label: "Residence title and work permission (if applicable to your situation)",
    reviewRequired: false,
    steps: [
      "Check your current residence title (Aufenthaltstitel) or registration status.",
      "Ask your Jobcenter, migration advisor, or Ausländerbehörde what work is allowed on your permit.",
      "Keep copies of your permit and any employment conditions in one folder.",
    ],
  },
  {
    systemId: "tax-id",
    label: "Tax identification number (Steueridentifikationsnummer)",
    reviewRequired: false,
    steps: [
      "After Anmeldung, your tax ID is usually sent by post within a few weeks.",
      "If it has not arrived, contact your local Finanzamt with passport and registration proof.",
      "Employers need this number for payroll — you do not need to memorise it, just keep the letter safe.",
    ],
  },
  {
    systemId: "social-insurance",
    label: "Social insurance number (Sozialversicherungsnummer)",
    reviewRequired: false,
    steps: [
      "If you worked in Germany before, you may already have a number from the Deutsche Rentenversicherung.",
      "Otherwise it is often assigned when you start your first insured job.",
      "Ask your employer or Jobcenter advisor if you are unsure which number to use.",
    ],
  },
  {
    systemId: "bank-account",
    label: "Bank account for salary payments",
    reviewRequired: false,
    steps: [
      "Choose a bank that offers an account suitable for your residence status (some require Anmeldung).",
      "Bring passport, registration confirmation, and sometimes your employment contract or Jobcenter letter.",
      "Ask about monthly fees and whether online banking is available in a language you are comfortable with.",
    ],
  },
  {
    systemId: "childcare",
    label: "Childcare arrangements if relevant to your working hours",
    reviewRequired: false,
    steps: [
      "List the hours you could work and when you would need care.",
      "Contact your local Jugendamt, Kita portal, or family support centre for waiting lists and subsidies.",
      "Tell employers honestly about care constraints — many roles can flex if you ask early.",
    ],
  },
  {
    systemId: "recognition-documents",
    label: "Recognition documents or certificates required for regulated professions",
    reviewRequired: false,
    steps: [
      "Check whether your target role is regulated in Germany (healthcare, teaching, engineering, etc.).",
      "Gather originals, certified translations, and transcripts before meeting a recognition advisor.",
      "Ask which authority applies (ZAB, IHK, chamber) — it depends on your qualification and Bundesland.",
    ],
  },
  {
    systemId: "health-insurance",
    label: "Health insurance proof for employment registration",
    reviewRequired: false,
    steps: [
      "Confirm whether you are on public (gesetzlich) or private insurance, or still need to enrol.",
      "Your employer will need insurance details for registration — ask your insurer for a membership certificate.",
      "If you are between statuses, ask Jobcenter or a migration advisor before your start date.",
    ],
  },
  {
    systemId: "jobcenter-questions",
    label: "Write down any questions you have before your Jobcenter appointment",
    reviewRequired: false,
    steps: [
      "List documents you are still missing and deadlines you are worried about.",
      "Note any letters you did not fully understand — bring them to the appointment.",
      "Ask who your main contact is and how to reach them between appointments.",
    ],
  },
]

export function getDefaultTaskGuidance(systemId: string): DefaultDocumentTaskGuidance | undefined {
  return DEFAULT_DOCUMENT_TASK_GUIDANCE.find((item) => item.systemId === systemId)
}

export function buildDefaultDocumentTasks(): Array<{
  id: string
  label: string
  isSystem: true
  systemId: string
  done: boolean
}> {
  return DEFAULT_DOCUMENT_TASK_GUIDANCE.map((item) => ({
    id: `system-${item.systemId}`,
    label: item.label,
    isSystem: true as const,
    systemId: item.systemId,
    done: false,
  }))
}
