/** Safe probe of an API key env var — never logs the full secret. */
export type EnvKeyProbe = {
  present: boolean
  length?: number
  /** First few characters only, for debugging which key type was loaded */
  prefix?: string
}

export function probeEnvKey(value: string | undefined): EnvKeyProbe {
  const trimmed = value?.trim()
  if (!trimmed) return { present: false }
  return {
    present: true,
    length: trimmed.length,
    prefix: trimmed.length > 8 ? `${trimmed.slice(0, 7)}…` : `${trimmed.slice(0, 3)}…`,
  }
}

export type AiEnvDiagnostics = {
  OPENAI_API_KEY: EnvKeyProbe
  OPENAI_MODEL: string
  ANTHROPIC_API_KEY: EnvKeyProbe
  AI_GATEWAY_API_KEY: EnvKeyProbe
  NODE_ENV: string | undefined
  cwd: string | undefined
}

export function collectAiEnvDiagnostics(): AiEnvDiagnostics {
  return {
    OPENAI_API_KEY: probeEnvKey(process.env.OPENAI_API_KEY),
    OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || "(default: gpt-4o)",
    ANTHROPIC_API_KEY: probeEnvKey(process.env.ANTHROPIC_API_KEY),
    AI_GATEWAY_API_KEY: probeEnvKey(process.env.AI_GATEWAY_API_KEY),
    NODE_ENV: process.env.NODE_ENV,
    cwd: process.cwd(),
  }
}

/** Logs which keys exist (not values). Call at generation start. */
export function logAiEnvDiagnostics(logTag: string): AiEnvDiagnostics {
  const diagnostics = collectAiEnvDiagnostics()
  console.info(`[${logTag}] AI environment (.env.local loaded by Next.js)`, diagnostics)
  return diagnostics
}
