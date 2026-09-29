/**
 * Job agents feature flag.
 * Default: off (pre-job-agents-v2 behaviour).
 *
 * Server/API: JOB_AGENT_ENABLED=true
 * Client nav/UI: also set NEXT_PUBLIC_JOB_AGENT_ENABLED=true
 * (Next only inlines NEXT_PUBLIC_* into the browser bundle.)
 */
export function isJobAgentEnabled(): boolean {
  const server = process.env.JOB_AGENT_ENABLED?.trim().toLowerCase()
  const pub = process.env.NEXT_PUBLIC_JOB_AGENT_ENABLED?.trim().toLowerCase()
  return server === "true" || pub === "true"
}

/** Client-safe check (only sees NEXT_PUBLIC_*). */
export function isJobAgentEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_JOB_AGENT_ENABLED?.trim().toLowerCase() === "true"
}
