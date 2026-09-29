import { formatStatisticsForPrompt, type ApplicationStatistics } from "@/lib/application-statistics"
import { AI_EXPLAINABILITY_RULES } from "@/lib/personal-learning/explainability"
import type {
  StatisticsJobSummary,
  StatisticsVersionSummary,
} from "@/lib/statistics-strategy-payload"

export function buildStatisticsStrategyReportPrompt(
  stats: ApplicationStatistics,
  jobs: StatisticsJobSummary[],
  versions: StatisticsVersionSummary[],
  outputLanguage: "en" | "de",
): string {
  const langNote = outputLanguage === "de" ? "German JSON string values." : "English JSON string values."
  return `You are a personal career strategy analyst inside a CV application tool.

Analyze ONLY the workspace data below. Never reference other users, folders, or external benchmarks.

${AI_EXPLAINABILITY_RULES}

${langNote}

Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:

{
  "summary": "One-sentence executive summary",
  "whatWorked": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "bestRoles": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "bestResumes": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "successfulKeywords": [{ "title": "keyword or skill", "detail": "why it correlates with success", "evidence": "...", "confidence": "high|medium|low" }],
  "whatDidNotWork": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "underperformingRoles": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "recommendedRoles": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }],
  "strategyChanges": [{ "title": "...", "detail": "...", "evidence": "...", "confidence": "high|medium|low" }]
}

Rules:
- Each array: 2–5 concise items when data supports it; empty array [] if insufficient evidence.
- Cite counts, company names, or resume version names in evidence where possible.
- Label confidence honestly when sample size is small.
- Do not invent applications not present in the data.

---

${formatStatisticsForPrompt(stats, jobs, versions)}
`
}

export function buildStatisticsChatPrompt(
  stats: ApplicationStatistics,
  jobs: StatisticsJobSummary[],
  versions: StatisticsVersionSummary[],
  message: string,
  conversation: { role: "user" | "assistant"; content: string }[],
  outputLanguage: "en" | "de",
): string {
  const langNote = outputLanguage === "de" ? "Respond in German." : "Respond in English."
  const history =
    conversation.length > 0
      ? `RECENT CHAT:\n${conversation
          .slice(-10)
          .map((c) => `${c.role}: ${c.content}`)
          .join("\n")}\n`
      : ""

  return `You are a statistics & job-strategy coach for ONE workspace folder only.

${AI_EXPLAINABILITY_RULES}
${langNote}

Answer using ONLY the workspace statistics and application records below.
Discuss: what worked, what didn't, resume versions, keywords, role focus, wasted effort, strategy changes.

Format your reply with markdown (headings, bullet lists, bold for emphasis, tables when helpful).
Do not wrap the entire response in a code block.

${history}

${formatStatisticsForPrompt(stats, jobs, versions)}

USER MESSAGE:
${message.trim()}
`
}
