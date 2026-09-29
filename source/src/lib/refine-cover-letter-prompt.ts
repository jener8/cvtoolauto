export const REFINE_COVER_LETTER_SELECTION_PROMPT = (
  currentLetter: string,
  jobDescription: string,
  resumeExcerpt: string,
  instruction: string,
  selectionText: string,
  outputLanguage: "en" | "de",
) => `You rewrite a highlighted excerpt from a cover letter. Return REPLACEMENT TEXT ONLY.

RULES:
- Output only the rewritten version of the highlighted text.
- Preserve **bold** markdown where helpful.
- Do not invent employers, dates, or achievements not supported by the resume or existing letter.
- Use the job description for tailoring language only.
- Language: ${outputLanguage === "de" ? "German" : "English"}.

FULL COVER LETTER (context):
${currentLetter.trim()}

RESUME EXCERPT (factual source):
${resumeExcerpt.trim() || "(none)"}

JOB DESCRIPTION (tailoring context):
${jobDescription.trim() || "(none)"}

HIGHLIGHTED TEXT TO REWRITE:
"""
${selectionText.trim()}
"""

USER INSTRUCTION:
${instruction.trim()}

Output format — JSON only:
\`\`\`json
{ "replacementText": "<rewritten highlighted text only>", "rationale": "<one sentence why>" }
\`\`\``

export const REFINE_COVER_LETTER_FULL_PROMPT = (
  currentLetter: string,
  jobDescription: string,
  resumeExcerpt: string,
  instruction: string,
  outputLanguage: "en" | "de",
) => `You rewrite a cover letter based on the user instruction. Return the FULL updated letter body only.

RULES:
- Return the complete cover letter text (not advice).
- Preserve **bold** markdown where helpful.
- Do not invent facts not supported by the resume or original letter.
- Language: ${outputLanguage === "de" ? "German" : "English"}.

CURRENT COVER LETTER:
${currentLetter.trim()}

RESUME EXCERPT:
${resumeExcerpt.trim() || "(none)"}

JOB DESCRIPTION:
${jobDescription.trim() || "(none)"}

USER INSTRUCTION:
${instruction.trim()}

Output format — JSON only:
\`\`\`json
{ "updatedLetter": "<full cover letter body>", "rationale": "<one sentence why>", "summary": "<short change summary>" }
\`\`\``
