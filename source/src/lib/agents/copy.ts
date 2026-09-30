/**
 * Job agents UI copy — DE/EN dict for i18n-ready strings (Phase 6).
 * Pass locale from the UI; default English.
 */

export type AgentsLocale = "en" | "de"

export const AGENTS_ACCENT = "#2D7A5F"

/** Email / initiative undo window before finalize (ms). */
export const SEND_UNDO_MS = 30_000

type AgentsCopyTree = {
  brand: string
  title: string
  subtitle: string
  backWorkspace: string
  masterProfile: string
  searchSettings: string
  reviewNewJobs: string
  draftApplications: string
  refresh: string
  loadingQueue: string
  lastReview: (v: {
    reviewed: number
    relevant: number
    notRelevant: number
    manual: number
    errors: number
  }) => string
  lastDraft: (v: {
    drafted: number
    flags: number
    cap: number
    already: number
    errors: number
  }) => string
  tabs: {
    all: (n: number) => string
    new: (n: number) => string
    reviewing: (n: number) => string
    changes: (n: number) => string
    approved: (n: number) => string
    sending: (n: number) => string
    sent: (n: number) => string
    rejected: (n: number) => string
    notRelevant: (n: number) => string
    manual: (n: number) => string
  }
  empty: {
    title: string
    body: string
    noNewToday: string
    noFits: string
    noApproved: string
    noSent: string
    noRejected: string
  }
  status: Record<string, string>
  kind: { listing: string; initiative: string }
  applyMethod: { email: string; portal: string; unknown: string }
  posted: (date: string) => string
  postedUnknown: string
  companyUnknown: string
  untitledRole: string
  listingLink: string
  review: string
  draft: string
  redraft: string
  requestChanges: string
  approve: string
  reject: string
  rejectReasonLabel: string
  rejectReasonPlaceholder: string
  rejectConfirm: string
  rejectCancel: string
  startEmailSend: string
  undoSend: string
  undoCountdown: (seconds: number) => string
  gmailNotConnected: string
  markAsSent: string
  portalReadyHint: string
  emailApprovedHint: string
  sendingHint: string
  sentHint: string
  rejectedHint: (reason: string | null) => string
  noDraftYet: string
  notReviewedYet: string
  requirementsMet: string
  requirementsNotMet: string
  evidence: string
  reviewError: (msg: string) => string
  draftsHeading: (version: number) => string
  saveText: string
  fabricationFlags: string
  fabricationPassed: string
  tailoredCv: string
  coverLetter: string
  citedFacts: (n: number) => string
  toast: {
    reviewComplete: string
    draftReady: string
    draftSaved: string
    approved: string
    rejected: string
    sendingStarted: string
    sendUndone: string
    markedSent: string
    gmailStub: string
    loadFailed: string
    actionFailed: string
  }
  a11y: {
    filterTabs: string
    jobList: string
    undoLive: string
    localeToggle: string
  }
}

const en: AgentsCopyTree = {
  brand: "EquitAI",
  title: "Job agents",
  subtitle:
    "Review fit explanations, edit drafts, then approve or reject. Nothing is sent or submitted to employer portals automatically.",
  backWorkspace: "Back to workspace",
  masterProfile: "Master profile",
  searchSettings: "Search settings",
  reviewNewJobs: "Review new jobs",
  draftApplications: "Draft applications",
  refresh: "Refresh",
  loadingQueue: "Loading queue…",
  lastReview: (v) =>
    `Last review: ${v.reviewed} reviewed · ${v.relevant} fits · ${v.notRelevant} not a fit · ${v.manual} manual · ${v.errors} errors`,
  lastDraft: (v) =>
    `Last draft run: ${v.drafted} drafted · flags ${v.flags} · cap ${v.cap} (already today ${v.already}) · ${v.errors} errors`,
  tabs: {
    all: (n) => `All (${n})`,
    new: (n) => `New (${n})`,
    reviewing: (n) => `Potential fits (${n})`,
    changes: (n) => `Changes (${n})`,
    approved: (n) => `Approved (${n})`,
    sending: (n) => `Sending (${n})`,
    sent: (n) => `Sent (${n})`,
    rejected: (n) => `Rejected (${n})`,
    notRelevant: (n) => `Not a fit (${n})`,
    manual: (n) => `Manual (${n})`,
  },
  empty: {
    title: "No jobs in this view",
    body: "Confirm profile facts, run a search, review fits, then draft and approve applications here.",
    noNewToday: "No new jobs found today",
    noFits: "No potential fits waiting for your decision",
    noApproved: "No approved applications yet",
    noSent: "Nothing marked as sent yet",
    noRejected: "No rejected jobs",
  },
  status: {
    new: "New",
    reviewing: "Potential fit",
    not_relevant: "Not a fit",
    needs_manual_review: "Needs manual review",
    changes_requested: "Changes requested",
    approved: "Approved",
    sending: "Sending…",
    sent: "Sent",
    rejected: "Rejected",
  },
  kind: { listing: "Listing", initiative: "Initiative" },
  applyMethod: { email: "Email", portal: "Portal", unknown: "Apply method unknown" },
  posted: (date) => `Posted ${date}`,
  postedUnknown: "Posted date unknown",
  companyUnknown: "Company unknown",
  untitledRole: "Untitled role",
  listingLink: "Listing",
  review: "Review",
  draft: "Draft",
  redraft: "Redraft",
  requestChanges: "Request changes",
  approve: "Approve",
  reject: "Reject",
  rejectReasonLabel: "Rejection reason (optional)",
  rejectReasonPlaceholder: "Why this role is not going forward…",
  rejectConfirm: "Confirm reject",
  rejectCancel: "Cancel",
  startEmailSend: "Start email send (30s undo)",
  undoSend: "Undo send",
  undoCountdown: (seconds) => `Sending in ${seconds}s — undo available`,
  gmailNotConnected:
    "Gmail is not connected. Email was not sent. You can send it yourself, then mark as sent.",
  markAsSent: "Mark as sent",
  portalReadyHint:
    "Ready to submit on the employer portal yourself. Use Mark as sent after you apply — EquitAI never submits to portals.",
  emailApprovedHint:
    "Approved for email. Start the send flow for a 30-second undo window. Actual Gmail send requires a connected account (not yet).",
  sendingHint: "Undo window active. After it ends, EquitAI will attempt email send if Gmail is connected.",
  sentHint: "Marked as sent. This job stays in the queue so it will not be fetched again.",
  rejectedHint: (reason) =>
    reason
      ? `Rejected — kept so it will not be fetched again. Reason: ${reason}`
      : "Rejected — kept so it will not be fetched again.",
  noDraftYet: "No draft yet — use Draft applications or Draft on this listing.",
  notReviewedYet: "Not reviewed yet — use Review new jobs or Review on this listing.",
  requirementsMet: "Requirements met",
  requirementsNotMet: "Requirements not met",
  evidence: "Evidence",
  reviewError: (msg) => `Review could not be completed: ${msg}`,
  draftsHeading: (version) => `Drafts (v${version})`,
  saveText: "Save text",
  fabricationFlags: "Fabrication flags",
  fabricationPassed: "Fact check passed — no unsupported claims flagged.",
  tailoredCv: "Tailored CV (editable)",
  coverLetter: "Cover letter / Anschreiben (editable)",
  citedFacts: (n) => `Cited facts snapshot (${n})`,
  toast: {
    reviewComplete: "Relevance review complete",
    draftReady: "Drafts ready",
    draftSaved: "Draft saved",
    approved: "Application approved",
    rejected: "Job rejected",
    sendingStarted: "Send started — you have 30 seconds to undo",
    sendUndone: "Send undone — back to approved",
    markedSent: "Marked as sent",
    gmailStub: "Gmail not connected — send skipped",
    loadFailed: "Could not load job queue",
    actionFailed: "Action failed",
  },
  a11y: {
    filterTabs: "Filter jobs by status",
    jobList: "Job review queue",
    undoLive: "Send undo countdown",
    localeToggle: "Interface language",
  },
}

const de: AgentsCopyTree = {
  brand: "EquitAI",
  title: "Job-Agenten",
  subtitle:
    "Passung prüfen, Entwürfe bearbeiten, dann freigeben oder ablehnen. Nichts wird automatisch an Arbeitgeberportale gesendet oder dort eingereicht.",
  backWorkspace: "Zurück zum Arbeitsbereich",
  masterProfile: "Master-Profil",
  searchSettings: "Sucheinstellungen",
  reviewNewJobs: "Neue Jobs prüfen",
  draftApplications: "Bewerbungen entwerfen",
  refresh: "Aktualisieren",
  loadingQueue: "Warteschlange wird geladen…",
  lastReview: (v) =>
    `Letzte Prüfung: ${v.reviewed} geprüft · ${v.relevant} Passungen · ${v.notRelevant} nicht passend · ${v.manual} manuell · ${v.errors} Fehler`,
  lastDraft: (v) =>
    `Letzter Entwurfslauf: ${v.drafted} entworfen · Hinweise ${v.flags} · Limit ${v.cap} (heute schon ${v.already}) · ${v.errors} Fehler`,
  tabs: {
    all: (n) => `Alle (${n})`,
    new: (n) => `Neu (${n})`,
    reviewing: (n) => `Mögliche Passungen (${n})`,
    changes: (n) => `Änderungen (${n})`,
    approved: (n) => `Freigegeben (${n})`,
    sending: (n) => `Wird gesendet (${n})`,
    sent: (n) => `Gesendet (${n})`,
    rejected: (n) => `Abgelehnt (${n})`,
    notRelevant: (n) => `Nicht passend (${n})`,
    manual: (n) => `Manuell (${n})`,
  },
  empty: {
    title: "Keine Jobs in dieser Ansicht",
    body: "Profilfakten bestätigen, Suche starten, Passungen prüfen, dann hier entwerfen und freigeben.",
    noNewToday: "Heute keine neuen Jobs gefunden",
    noFits: "Keine möglichen Passungen zur Entscheidung",
    noApproved: "Noch keine freigegebenen Bewerbungen",
    noSent: "Noch nichts als gesendet markiert",
    noRejected: "Keine abgelehnten Jobs",
  },
  status: {
    new: "Neu",
    reviewing: "Mögliche Passung",
    not_relevant: "Nicht passend",
    needs_manual_review: "Manuelle Prüfung nötig",
    changes_requested: "Änderungen angefordert",
    approved: "Freigegeben",
    sending: "Wird gesendet…",
    sent: "Gesendet",
    rejected: "Abgelehnt",
  },
  kind: { listing: "Stellenanzeige", initiative: "Initiativ" },
  applyMethod: { email: "E-Mail", portal: "Portal", unknown: "Bewerbungsweg unbekannt" },
  posted: (date) => `Veröffentlicht ${date}`,
  postedUnknown: "Veröffentlichungsdatum unbekannt",
  companyUnknown: "Unternehmen unbekannt",
  untitledRole: "Unbenannte Rolle",
  listingLink: "Anzeige",
  review: "Prüfen",
  draft: "Entwerfen",
  redraft: "Neu entwerfen",
  requestChanges: "Änderungen anfordern",
  approve: "Freigeben",
  reject: "Ablehnen",
  rejectReasonLabel: "Ablehnungsgrund (optional)",
  rejectReasonPlaceholder: "Warum diese Stelle nicht weiterverfolgt wird…",
  rejectConfirm: "Ablehnung bestätigen",
  rejectCancel: "Abbrechen",
  startEmailSend: "E-Mail-Versand starten (30s Rückgängig)",
  undoSend: "Versand rückgängig",
  undoCountdown: (seconds) => `Versand in ${seconds}s — Rückgängig möglich`,
  gmailNotConnected:
    "Gmail ist nicht verbunden. Es wurde keine E-Mail gesendet. Sie können selbst senden und dann als gesendet markieren.",
  markAsSent: "Als gesendet markieren",
  portalReadyHint:
    "Bereit zur eigenen Einreichung im Arbeitgeberportal. Nach der Bewerbung „Als gesendet markieren“ — EquitAI reicht nie auf Portalen ein.",
  emailApprovedHint:
    "Für E-Mail freigegeben. Starten Sie den Versand mit 30-Sekunden-Rückgängig. Tatsächlicher Gmail-Versand braucht ein verbundenes Konto (noch nicht).",
  sendingHint:
    "Rückgängig-Fenster aktiv. Danach versucht EquitAI den Versand, wenn Gmail verbunden ist.",
  sentHint: "Als gesendet markiert. Der Job bleibt in der Warteschlange und wird nicht erneut geholt.",
  rejectedHint: (reason) =>
    reason
      ? `Abgelehnt — behalten, damit er nicht erneut geholt wird. Grund: ${reason}`
      : "Abgelehnt — behalten, damit er nicht erneut geholt wird.",
  noDraftYet: "Noch kein Entwurf — „Bewerbungen entwerfen“ oder „Entwerfen“ bei dieser Anzeige nutzen.",
  notReviewedYet: "Noch nicht geprüft — „Neue Jobs prüfen“ oder „Prüfen“ bei dieser Anzeige nutzen.",
  requirementsMet: "Erfüllte Anforderungen",
  requirementsNotMet: "Nicht erfüllte Anforderungen",
  evidence: "Beleg",
  reviewError: (msg) => `Prüfung konnte nicht abgeschlossen werden: ${msg}`,
  draftsHeading: (version) => `Entwürfe (v${version})`,
  saveText: "Text speichern",
  fabricationFlags: "Erfindungshinweise",
  fabricationPassed: "Faktenprüfung bestanden — keine unbelegten Aussagen.",
  tailoredCv: "Angepasster Lebenslauf (bearbeitbar)",
  coverLetter: "Anschreiben / Cover letter (bearbeitbar)",
  citedFacts: (n) => `Zitierte Fakten (Snapshot) (${n})`,
  toast: {
    reviewComplete: "Passungsprüfung abgeschlossen",
    draftReady: "Entwürfe bereit",
    draftSaved: "Entwurf gespeichert",
    approved: "Bewerbung freigegeben",
    rejected: "Job abgelehnt",
    sendingStarted: "Versand gestartet — 30 Sekunden zum Rückgängigmachen",
    sendUndone: "Versand rückgängig — wieder freigegeben",
    markedSent: "Als gesendet markiert",
    gmailStub: "Gmail nicht verbunden — Versand übersprungen",
    loadFailed: "Warteschlange konnte nicht geladen werden",
    actionFailed: "Aktion fehlgeschlagen",
  },
  a11y: {
    filterTabs: "Jobs nach Status filtern",
    jobList: "Job-Prüfwarteschlange",
    undoLive: "Rückgängig-Countdown für Versand",
    localeToggle: "Oberflächensprache",
  },
}

const COPY: Record<AgentsLocale, AgentsCopyTree> = { en, de }

export function getAgentsCopy(locale: AgentsLocale = "en"): AgentsCopyTree {
  return COPY[locale] ?? COPY.en
}

export function detectAgentsLocale(): AgentsLocale {
  if (typeof navigator === "undefined") return "en"
  const lang = (navigator.language || "en").toLowerCase()
  return lang.startsWith("de") ? "de" : "en"
}

export type AgentsCopy = AgentsCopyTree
