/**
 * Authenticate Vercel cron (or manual curl) for /api/agents/cron.
 *
 * Set JOB_AGENT_CRON_SECRET, and set Vercel CRON_SECRET to the same value so
 * Vercel sends Authorization: Bearer <secret> on scheduled invocations.
 */

export function getJobAgentCronSecret(): string | null {
  const secret = process.env.JOB_AGENT_CRON_SECRET?.trim()
  return secret || null
}

/** True when Authorization Bearer or x-job-agent-cron-secret matches. */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = getJobAgentCronSecret()
  if (!secret) return false

  const auth = request.headers.get("authorization")?.trim()
  if (auth === `Bearer ${secret}`) return true

  const header = request.headers.get("x-job-agent-cron-secret")?.trim()
  if (header === secret) return true

  return false
}
