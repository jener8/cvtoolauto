"use server"

import { generateText } from "ai"

export async function generateJobStrategy(
  jobDescription: string,
  backgroundSummary: string,
): Promise<{
  intent: string
  strategicFit: string
  positioning: string
  constraints: string
  successCriteria: string
}> {
  const prompt = `You are a Job Application Strategy Assistant. Generate a strategic framework for a job application.

Job Description:
${jobDescription}

Candidate Background:
${backgroundSummary}

Create a Job Strategy using this structure:

1. Intent (2-3 sentences)
   - Why is the candidate applying for this role?
   - What kind of role is this (bridge, anchor, stretch, option)?

2. Strategic Fit (2-3 sentences)
   - Why this company?
   - Why this role now?
   - Where is the mutual value?

3. Positioning Choice (2-3 sentences)
   - How should the candidate position themselves?
   - What strengths to emphasize?
   - What to deliberately not emphasize?

4. Constraints & Truths (2-3 sentences)
   - What must remain factually accurate?
   - What constraints apply?
   - What must not conflict with previous roles or references?

5. Success Criteria (2-3 sentences)
   - What would success look like in 12–24 months?
   - What are early warning signs?
   - What would make this the wrong role?

Return JSON with keys: intent, strategicFit, positioning, constraints, successCriteria`

  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt,
  })

  // Parse JSON response
  try {
    const strategy = JSON.parse(text)
    return strategy
  } catch {
    // If parsing fails, return structured text
    return {
      intent: text.split("1. Intent")[1]?.split("2. Strategic Fit")[0]?.trim() || "",
      strategicFit: text.split("2. Strategic Fit")[1]?.split("3. Positioning Choice")[0]?.trim() || "",
      positioning: text.split("3. Positioning Choice")[1]?.split("4. Constraints & Truths")[0]?.trim() || "",
      constraints: text.split("4. Constraints & Truths")[1]?.split("5. Success Criteria")[0]?.trim() || "",
      successCriteria: text.split("5. Success Criteria")[1]?.trim() || "",
    }
  }
}
