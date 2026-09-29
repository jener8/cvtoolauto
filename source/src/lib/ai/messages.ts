/** User-facing copy for AI configuration — safe to show in the UI. */

export const OPENAI_ENV_VAR = "OPENAI_API_KEY"

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI analysis requires an API key. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY) in .env.local, then restart the dev server."

/** @deprecated Use AI_NOT_CONFIGURED_MESSAGE — kept for existing imports */
export const OPENAI_NOT_CONFIGURED_MESSAGE = AI_NOT_CONFIGURED_MESSAGE

export const OPENAI_NOT_CONFIGURED_HINT_LOCAL =
  "Copy OPENAI_API_KEY from Vercel → Project → Settings → Environment Variables (Production) into .env.local, then restart with npm run dev."

export const OPENAI_NOT_CONFIGURED_HINT_VERCEL =
  "Production: add OPENAI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy."

export function getAiConfigurationMessage(configured: boolean): string {
  return configured ? "AI configured" : AI_NOT_CONFIGURED_MESSAGE
}
