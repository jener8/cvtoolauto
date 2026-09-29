import { buildParseDebug, parseLinkedInHtml } from "@/lib/linkedin-html-parse"
import {
  countPopulatedSections,
  hasMeaningfulLinkedInContent,
  sectionsToGeneralCv,
} from "@/lib/linkedin-profile-sections"
import { EMPTY_LINKEDIN_SECTIONS } from "@/lib/linkedin-profile-types"
import type {
  LinkedInSyncApiResponse,
  LinkedInSyncDebug,
  LinkedInSyncStatus,
} from "@/lib/linkedin-sync-types"
import { normalizeLinkedInProfileUrl, validateLinkedInProfileUrl } from "@/lib/user-profile"

const FETCH_TIMEOUT_MS = 14_000
const RETRY_DELAY_MS = 700

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

function logSync(debug: LinkedInSyncDebug, message: string) {
  console.info("[linkedin/sync]", message, JSON.stringify(debug))
}

function resolveStatus(
  meaningful: boolean,
  populated: number,
  loginWall: boolean,
  parseFailed: boolean,
  fetchError?: string,
): LinkedInSyncStatus {
  if (fetchError && !meaningful) return "failed"
  if (loginWall && !meaningful) return "blocked"
  if (!meaningful) return parseFailed ? "failed" : "blocked"
  if (populated >= 2 && !loginWall) return "synced"
  return "partial"
}

function userMessageForStatus(
  status: LinkedInSyncStatus,
  debug: LinkedInSyncDebug,
): string {
  switch (status) {
    case "synced":
      return "Profile synced successfully."
    case "partial":
      return "We imported part of your profile. Review the sections below and add anything missing."
    case "blocked":
      return "LinkedIn blocked automatic access to this profile."
    case "failed":
      if (debug.fetchError) return `Sync failed: ${debug.fetchError}`
      if (debug.parseFailed) return "We received a page from LinkedIn but could not extract profile sections."
      if (debug.emptyContent) return "LinkedIn returned a page with no usable public profile text."
      return "Sync failed. Try again or use a manual import."
    default:
      return ""
  }
}

async function fetchProfilePage(
  url: string,
  attempt: number,
): Promise<{
  html: string
  httpStatus: number
  finalUrl: string
  fetchError?: string
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const ua = USER_AGENTS[(attempt - 1) % USER_AGENTS.length]

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": attempt > 1 ? "en-GB,en;q=0.9" : "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      redirect: "follow",
    })

    const html = await res.text()
    return {
      html,
      httpStatus: res.status,
      finalUrl: res.url || url,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error"
    return {
      html: "",
      httpStatus: 0,
      finalUrl: url,
      fetchError: message,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function attemptSync(
  canonicalUrl: string,
  attempt: number,
): Promise<LinkedInSyncApiResponse> {
  const { html, httpStatus, finalUrl, fetchError } = await fetchProfilePage(
    canonicalUrl,
    attempt,
  )

  if (fetchError || !html) {
    const debug: LinkedInSyncDebug = {
      httpStatus,
      finalUrl,
      attempt,
      fetchError,
      emptyContent: true,
      loginWall: false,
      parseFailed: false,
      populatedSections: 0,
      reason: fetchError ?? "Empty response",
    }
    logSync(debug, "Fetch failed or empty HTML")
    return {
      status: "failed",
      profileText: null,
      sections: { ...EMPTY_LINKEDIN_SECTIONS },
      url: canonicalUrl,
      error: fetchError ?? "Could not fetch LinkedIn profile page",
      userMessage: userMessageForStatus("failed", debug),
      debug,
    }
  }

  const parsed = parseLinkedInHtml(html, httpStatus)
  const debug = buildParseDebug(parsed, httpStatus, html.length, attempt)
  debug.finalUrl = finalUrl
  debug.retried = attempt > 1

  const profileText =
    parsed.profileText?.trim() || sectionsToGeneralCv(parsed.sections) || null
  const meaningful = hasMeaningfulLinkedInContent(parsed.sections, profileText)
  const populated = countPopulatedSections(parsed.sections)
  const status = resolveStatus(
    meaningful,
    populated,
    parsed.loginWall,
    parsed.parseFailed,
    fetchError,
  )

  logSync(debug, `Attempt ${attempt}: status=${status} meaningful=${meaningful} loginWall=${parsed.loginWall}`)

  if (parsed.loginWall) {
    logSync(debug, "Login wall detected")
  }
  if (parsed.emptyContent) {
    logSync(debug, "No usable content extracted")
  }
  if (parsed.parseFailed) {
    logSync(debug, "Parsing produced no structured fields")
  }

  return {
    status,
    profileText: meaningful ? profileText : profileText || null,
    sections: parsed.sections,
    url: canonicalUrl,
    error:
      status === "blocked"
        ? debug.reason ?? "LinkedIn blocked automatic access"
        : status === "failed"
          ? debug.reason ?? debug.fetchError
          : undefined,
    userMessage: userMessageForStatus(status, debug),
    debug,
  }
}

/** Run LinkedIn sync with one automatic server-side retry on weak/blocked results. */
export async function runLinkedInSync(rawUrl: string): Promise<LinkedInSyncApiResponse> {
  const validation = validateLinkedInProfileUrl(rawUrl)
  if (!validation.valid || !validation.normalized) {
    const debug: LinkedInSyncDebug = {
      attempt: 0,
      reason: validation.error,
      parseFailed: true,
    }
    logSync(debug, "URL validation failed")
    return {
      status: "failed",
      profileText: null,
      sections: { ...EMPTY_LINKEDIN_SECTIONS },
      url: rawUrl,
      error: validation.error ?? "Invalid LinkedIn URL",
      userMessage: validation.error ?? "Invalid LinkedIn profile URL",
      debug,
    }
  }

  const canonicalUrl = validation.normalized
  logSync({ attempt: 1, reason: canonicalUrl }, "Starting sync")

  let result = await attemptSync(canonicalUrl, 1)

  const shouldRetry =
    (result.status === "blocked" || result.status === "failed" || result.status === "partial") &&
    (result.debug.populatedSections ?? 0) < 2

  if (shouldRetry) {
    logSync(result.debug, "Scheduling automatic retry")
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    const retryResult = await attemptSync(canonicalUrl, 2)
    retryResult.debug.retried = true

    const retryBetter =
      (retryResult.debug.populatedSections ?? 0) >
        (result.debug.populatedSections ?? 0) ||
      (retryResult.status === "synced" && result.status !== "synced")

    if (retryBetter) {
      logSync(retryResult.debug, "Retry improved results")
      result = retryResult
    } else {
      logSync(result.debug, "Retry did not improve; keeping first attempt")
      result.debug.retried = true
    }
  }

  return result
}

/** Legacy helper */
export async function runLinkedInProfileFetch(rawUrl: string): Promise<LinkedInSyncApiResponse> {
  const normalized = normalizeLinkedInProfileUrl(rawUrl)
  if (!normalized) {
    return runLinkedInSync(rawUrl)
  }
  return runLinkedInSync(normalized)
}
