import type {
  AssistantDocumentContext,
  AssistantSelectionContext,
} from "@/lib/assistant-selection-context"

export type AssistantIntent =
  | "resume_edit"
  | "cover_letter_edit"
  | "strategy"
  | "ats"
  | "cover_letter"
  | "interview"
  | "application_analysis"
  | "job_match"
  | "general"

const EDIT_ACTION_PATTERN =
  /make (it |this |the )?(shorter|longer|more senior|more strategic|stronger|more relevant)|rewrite|reduce repetition|tailor|match|align|emphasize|focus on|more to this|selected|highlight|keyword|apply (the )?changes|reframe|prioriti[sz]e|improve|edit|shorten|condense/i

const RESUME_EDIT_PATTERN =
  /make (it |this )?(shorter|longer|more senior|more strategic|stronger|more relevant)|rewrite|edit (my )?resume|reduce repetition|tailor|match|align|emphasize|focus on|bullet|experience section|summary|profile section|add ats|improve ats|leadership focus|ai focus|more to this|selected|highlight|keyword|apply (the )?changes|reframe|prioriti[sz]e|translate|übersetz/i

const COVER_LETTER_MENTION = /cover letter|anschreiben|application letter/i

const NON_EDIT_PATTERN =
  /should i apply|worth applying|what kind of role|should i|how should i position|career goal|strategic profile|analyze|explain|why|what are my|prep me|interview question/i

const RESUME_EXPLICIT_PATTERN = /\b(resume|cv|curriculum vitae)\b/i

export function classifyAssistantIntent(
  message: string,
  selection?: AssistantSelectionContext | null,
  documentContext: AssistantDocumentContext = "resume",
): AssistantIntent {
  const m = message.toLowerCase().trim()
  const hasSelection = Boolean(selection?.text?.trim())

  if (documentContext === "cover_letter" && !RESUME_EXPLICIT_PATTERN.test(m)) {
    if (
      EDIT_ACTION_PATTERN.test(m) ||
      (hasSelection &&
        /this|selected|shorter|longer|rewrite|tailor|improve|edit|match|align|stronger|senior|strategic/.test(
          m,
        ))
    ) {
      return "cover_letter_edit"
    }
    if (COVER_LETTER_MENTION.test(m)) return "cover_letter"
    if (/interview|prep question|star method|tell me about/.test(m)) return "interview"
    if (/analyze (this )?application|fit score|red flag|should i apply|worth applying/.test(m)) {
      return "application_analysis"
    }
    if (/match (the )?job|job description|align with|keywords from (the )?job/.test(m)) {
      return "job_match"
    }
    if (/ats|applicant tracking|keyword density|scan|parse/.test(m)) return "ats"
    if (
      /strategic profile|career direction|positioning|differentiator|long-term|what (kinds of )?roles/.test(
        m,
      )
    ) {
      return "strategy"
    }
    return "general"
  }

  if (selection?.source === "cover_letter") {
    if (
      EDIT_ACTION_PATTERN.test(m) ||
      (hasSelection &&
        /this|selected|shorter|longer|rewrite|tailor|improve|edit/.test(m))
    ) {
      return "cover_letter_edit"
    }
    return "cover_letter"
  }

  if (COVER_LETTER_MENTION.test(m) && EDIT_ACTION_PATTERN.test(m)) {
    return "cover_letter_edit"
  }

  if (NON_EDIT_PATTERN.test(m) && !/tailor|rewrite|make (it |this )?/.test(m)) {
    // fall through to specific intents below
  } else if (
    RESUME_EDIT_PATTERN.test(m) ||
    (hasSelection &&
      selection?.source !== "job_description" &&
      /this|selected|highlight|more to|tailor|match|align|stronger|senior|strategic|ats|leadership|ai/.test(
        m,
      ))
  ) {
    return "resume_edit"
  }

  if (
    /strategic profile|career direction|positioning|differentiator|long-term|what (kinds of )?roles|emphasize less|operational vs strategic|responsible ai role/.test(
      m,
    )
  ) {
    return "strategy"
  }

  if (/ats|applicant tracking|keyword density|scan|parse/.test(m)) {
    return "ats"
  }

  if (COVER_LETTER_MENTION.test(m)) {
    return "cover_letter"
  }

  if (/interview|prep question|star method|tell me about/.test(m)) {
    return "interview"
  }

  if (/analyze (this )?application|fit score|red flag|should i apply|worth applying/.test(m)) {
    return "application_analysis"
  }

  if (/match (the )?job|job description|align with|keywords from (the )?job/.test(m)) {
    return "job_match"
  }

  return "general"
}

export function intentLabel(intent: AssistantIntent): string {
  switch (intent) {
    case "resume_edit":
      return "Resume edit"
    case "cover_letter_edit":
      return "Cover letter edit"
    case "strategy":
      return "Career strategy"
    case "ats":
      return "ATS optimization"
    case "cover_letter":
      return "Cover letter"
    case "interview":
      return "Interview prep"
    case "application_analysis":
      return "Application analysis"
    case "job_match":
      return "Job matching"
    default:
      return "Career assistant"
  }
}
