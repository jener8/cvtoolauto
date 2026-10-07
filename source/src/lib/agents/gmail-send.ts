/**
 * Phase 8 — Gmail API send for approved email / initiative applications.
 * Uses OAuth2 refresh-token credentials from env (no browser OAuth UI yet).
 * When credentials are missing, callers keep the safe stub / no-send path.
 */

export type GmailCredentials = {
  clientId: string
  clientSecret: string
  refreshToken: string
  fromEmail: string
}

export type GmailSendInput = {
  to: string
  subject: string
  bodyText: string
  /** Optional plain-text CV appendix (not a binary attachment). */
  cvText?: string | null
  signal?: AbortSignal
}

export type GmailSendResult = {
  messageId: string
  threadId?: string | null
}

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v || undefined
}

/**
 * Resolve Gmail OAuth credentials.
 * Prefers JOB_AGENT_GMAIL_* ; accepts GOOGLE_* / GMAIL_* aliases.
 */
export function getGmailCredentials(): GmailCredentials | null {
  const clientId =
    env("JOB_AGENT_GMAIL_CLIENT_ID") ?? env("GOOGLE_CLIENT_ID") ?? env("GMAIL_CLIENT_ID")
  const clientSecret =
    env("JOB_AGENT_GMAIL_CLIENT_SECRET") ??
    env("GOOGLE_CLIENT_SECRET") ??
    env("GMAIL_CLIENT_SECRET")
  const refreshToken =
    env("JOB_AGENT_GMAIL_REFRESH_TOKEN") ??
    env("GOOGLE_REFRESH_TOKEN") ??
    env("GMAIL_REFRESH_TOKEN")
  const fromEmail =
    env("JOB_AGENT_GMAIL_FROM") ?? env("GMAIL_FROM") ?? env("GMAIL_SENDER_EMAIL")

  if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
    return null
  }
  return { clientId, clientSecret, refreshToken, fromEmail }
}

/** True when refresh-token OAuth env is fully configured for a real send. */
export function hasGmailApiCredentials(): boolean {
  return getGmailCredentials() != null
}

/**
 * Connected for send purposes:
 * - real Gmail API credentials, or
 * - legacy local stub toggle JOB_AGENT_GMAIL_CONNECTED=true
 */
export function isGmailConnected(): boolean {
  if (hasGmailApiCredentials()) return true
  return process.env.JOB_AGENT_GMAIL_CONNECTED?.trim().toLowerCase() === "true"
}

function encodeRfc2047Subject(subject: string): string {
  // ASCII-safe path
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  const b64 = Buffer.from(subject, "utf8").toString("base64")
  return `=?UTF-8?B?${b64}?=`
}

function buildMimeMessage(input: {
  from: string
  to: string
  subject: string
  bodyText: string
  cvText?: string | null
}): string {
  const lines: string[] = []
  lines.push(`From: ${input.from}`)
  lines.push(`To: ${input.to}`)
  lines.push(`Subject: ${encodeRfc2047Subject(input.subject)}`)
  lines.push("MIME-Version: 1.0")
  lines.push('Content-Type: text/plain; charset="UTF-8"')
  lines.push("Content-Transfer-Encoding: 8bit")
  lines.push("")
  lines.push(input.bodyText.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"))
  const cv = input.cvText?.trim()
  if (cv) {
    lines.push("\r\n\r\n---\r\n")
    lines.push("CV / Lebenslauf (plain text):\r\n\r\n")
    lines.push(cv.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"))
  }
  return lines.join("\r\n")
}

/** Gmail API expects base64url of the raw RFC 2822 message. */
function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

async function refreshAccessToken(
  creds: GmailCredentials,
  signal?: AbortSignal,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  })

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  })

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`
    throw new Error(`Gmail OAuth token refresh failed: ${detail}`)
  }
  return data.access_token
}

/**
 * Send one application email via Gmail API (users.messages.send).
 * Requires gmail.send scope on the refresh token.
 */
export async function sendApplicationEmailViaGmail(
  input: GmailSendInput,
): Promise<GmailSendResult> {
  const creds = getGmailCredentials()
  if (!creds) {
    throw new Error("Gmail API credentials are not configured")
  }

  const to = input.to.trim()
  if (!to || !to.includes("@")) {
    throw new Error("Missing or invalid recipient email")
  }

  const subject = input.subject.trim() || "Application"
  const bodyText = input.bodyText.trim()
  if (!bodyText) {
    throw new Error("Cover letter / email body is empty — edit the draft before sending")
  }

  const accessToken = await refreshAccessToken(creds, input.signal)
  const raw = buildMimeMessage({
    from: creds.fromEmail,
    to,
    subject,
    bodyText,
    cvText: input.cvText,
  })

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
    signal: input.signal,
  })

  const data = (await res.json()) as {
    id?: string
    threadId?: string
    error?: { message?: string }
  }

  if (!res.ok || !data.id) {
    const detail = data.error?.message || `HTTP ${res.status}`
    throw new Error(`Gmail send failed: ${detail}`)
  }

  return { messageId: data.id, threadId: data.threadId ?? null }
}
