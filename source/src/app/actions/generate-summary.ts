"use server"

import { generateText } from "ai"

export async function generateJobSummary(jobDescription: string) {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `You are a professional job application assistant. Create a concise 5-line summary of the following job description. Focus on the key responsibilities, requirements, and benefits. Keep it professional and clear.

Job Description:
${jobDescription}

Provide only the summary, no additional commentary.`,
      maxOutputTokens: 500,
      temperature: 0.7,
    })

    return { success: true, summary: text }
  } catch (error) {
    console.error("[v0] Error generating summary:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate summary",
    }
  }
}
