/**
 * Job agents feature flag.
 * Default: off (pre-job-agents-v2 behaviour).
 *
 * Server/API: JOB_AGENT_ENABLED=true alone gates all /api/agents/* (and cron).
 * NEXT_PUBLIC_JOB_AGENT_ENABLED must NOT unlock APIs by itself.
 * Client nav/UI: NEXT_PUBLIC_JOB_AGENT_ENABLED=true (browser bundle only).
 */

/** Server gate — APIs, cron, and SSR agents pages. Ignores the public flag. */
export function isJobAgentEnabled(): boolean {
  return process.env.JOB_AGENT_ENABLED?.trim().toLowerCase() === "true"
}

/** Explicit alias for API/cron docs and call sites. */
export function isJobAgentApiEnabled(): boolean {
  return isJobAgentEnabled()
}

/** Client-safe check (only sees NEXT_PUBLIC_*). */
export function isJobAgentEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_JOB_AGENT_ENABLED?.trim().toLowerCase() === "true"
}
