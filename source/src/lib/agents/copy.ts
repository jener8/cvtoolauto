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
  runNow: string
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
  lastPipeline: (v: {
    fetched: number
    relevant: number
    drafted: number
    cap: number
    errors: number
  }) => string
  addToApplications: string
  addToApplicationsHint: string
  tabs: {
    all: (n: number) => string
    new: (n: number) => string
    potentialFit: (n: number) => string
    notAFit: (n: number) => string
    manual: (n: number) => string
    shortlisted: (n: number) => string
    skipped: (n: number) => string
    drafting: (n: number) => string
    draftsReady: (n: number) => string
    changes: (n: number) => string
    documentsApproved: (n: number) => string
    sending: (n: number) => string
    sent: (n: number) => string
    rejected: (n: number) => string
  }
  queues: {
    choose: (n: number) => string
    documents: (n: number) => string
    send: (n: number) => string
    sentHistory: (n: number) => string
    overviewChoose: string
    overviewDocuments: string
    overviewSend: string
    shortlist: string
    skip: string
    approveDocuments: string
    waitingRedraft: string
    readyToSubmit: string
    openPortal: string
    sendBlockedFlags: string
    emptyChoose: string
    emptyDocuments: string
    emptySend: string
    selected: (n: number) => string
  }
  confirmSendSubject: (title: string) => string
  confirmSendAttachments: string
  confirmSendMode: (mode: "live" | "test") => string
  confirmSendCoverLabel: string
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
  confirmSendTitle: string
  confirmSendDescription: (to: string | null) => string
  confirmSendConfirm: string
  confirmSendCancel: string
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
    emailSent: string
    gmailStub: string
    gmailSendFailed: string
    loadFailed: string
    actionFailed: string
    pipelineComplete: string
    addedToApplications: string
    alreadyInApplications: string
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
  runNow: "Run now",
  refresh: "Refresh",
  loadingQueue: "Loading queue…",
  lastReview: (v) =>
    `Last review: ${v.reviewed} reviewed · ${v.relevant} fits · ${v.notRelevant} not a fit · ${v.manual} manual · ${v.errors} errors`,
  lastDraft: (v) =>
    `Last draft run: ${v.drafted} drafted · flags ${v.flags} · cap ${v.cap} (already today ${v.already}) · ${v.errors} errors`,
  lastPipeline: (v) =>
    `Last run: fetched ${v.fetched} · relevant ${v.relevant} · drafted ${v.drafted} (cap ${v.cap}) · ${v.errors} errors`,
  addToApplications: "Add to my applications",
  addToApplicationsHint:
    "Creates a new tracker row from this job and draft. Does not change existing applications or submit to employers.",
  tabs: {
    all: (n) => `All (${n})`,
    new: (n) => `New (${n})`,
    potentialFit: (n) => `Potential fit (${n})`,
    notAFit: (n) => `Not a fit (${n})`,
    manual: (n) => `Manual (${n})`,
    shortlisted: (n) => `Shortlisted (${n})`,
    skipped: (n) => `Skipped (${n})`,
    drafting: (n) => `Drafting (${n})`,
    draftsReady: (n) => `Drafts ready (${n})`,
    changes: (n) => `Changes (${n})`,
    documentsApproved: (n) => `Documents approved (${n})`,
    sending: (n) => `Sending (${n})`,
    sent: (n) => `Sent (${n})`,
    rejected: (n) => `Rejected (${n})`,
  },
  queues: {
    choose: (n) => `Choose jobs (${n})`,
    documents: (n) => `Check documents (${n})`,
    send: (n) => `Ready to send (${n})`,
    sentHistory: (n) => `Sent (${n})`,
    overviewChoose: "Choose jobs",
    overviewDocuments: "Check documents",
    overviewSend: "Ready to send",
    shortlist: "Shortlist",
    skip: "Skip",
    approveDocuments: "Approve documents",
    waitingRedraft: "Waiting for redraft",
    readyToSubmit: "Ready to submit",
    openPortal: "Open portal",
    sendBlockedFlags: "Cannot send while fabrication flags are open — resolve flags first.",
    emptyChoose: "No jobs waiting for a shortlist decision.",
    emptyDocuments: "No drafts waiting for document review.",
    emptySend: "No applications ready to send.",
    selected: (n) => `${n} selected`,
  },
  confirmSendSubject: (title) => `Application: ${title}`,
  confirmSendAttachments: "Attachments",
  confirmSendMode: (mode) =>
    mode === "live" ? "Send mode: Live (Gmail)" : "Send mode: Test (stub / no Gmail)",
  confirmSendCoverLabel: "Cover letter",
  empty: {
    title: "No jobs in this view",
    body: "Confirm profile facts, run a search, review fits, then draft and approve applications here.",
    noNewToday: "No new jobs found today",
    noFits: "No potential fits waiting for your decision",
    noApproved: "No applications with approved documents yet",
    noSent: "Nothing marked as sent yet",
    noRejected: "No rejected jobs",
  },
  status: {
    new: "New",
    potential_fit: "Potential fit",
    not_a_fit: "Not a fit",
    manual: "Manual review",
    shortlisted: "Shortlisted",
    skipped: "Skipped",
    drafting: "Drafting",
    drafts_ready: "Drafts ready",
    changes_requested: "Changes requested",
    documents_approved: "Documents approved",
    sending: "Sending…",
    sent: "Sent",
    rejected: "Rejected",
    // legacy aliases (normalized by API, kept for safety)
    reviewing: "Potential fit",
    not_relevant: "Not a fit",
    needs_manual_review: "Manual review",
    approved: "Documents approved",
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
  startEmailSend: "Send email…",
  confirmSendTitle: "Send this application email?",
  confirmSendDescription: (to) =>
    to
      ? `This starts a 30-second undo window, then sends the cover letter to ${to} via Gmail (if connected). Only this one job — never a batch.`
      : "This starts a 30-second undo window, then attempts Gmail send for this one job only. No recipient email is set — send will be skipped unless you add one.",
  confirmSendConfirm: "Confirm send",
  confirmSendCancel: "Cancel",
  undoSend: "Undo send",
  undoCountdown: (seconds) => `Sending in ${seconds}s — undo available`,
  gmailNotConnected:
    "Gmail is not connected. Email was not sent. You can send it yourself, then mark as sent.",
  markAsSent: "Mark as sent",
  portalReadyHint:
    "Ready to submit on the employer portal yourself. Use Mark as sent after you apply — EquitAI never submits to portals.",
  emailApprovedHint:
    "Approved for email. Confirm send for a 30-second undo window, then EquitAI sends via Gmail if OAuth env is configured.",
  sendingHint:
    "Undo window active. After it ends, EquitAI sends via Gmail when credentials are set; otherwise send is skipped.",
  sentHint: "Sent (or marked sent). This job stays in the queue so it will not be fetched again.",
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
    sendUndone: "Send undone — back to documents approved",
    markedSent: "Marked as sent",
    emailSent: "Email sent via Gmail",
    gmailStub: "Gmail not connected — send skipped",
    gmailSendFailed: "Gmail send failed — back to documents approved",
    loadFailed: "Could not load job queue",
    actionFailed: "Action failed",
    pipelineComplete: "Pipeline complete",
    addedToApplications: "Added to your applications",
    alreadyInApplications: "Already in your applications",
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
  runNow: "Jetzt ausführen",
  refresh: "Aktualisieren",
  loadingQueue: "Warteschlange wird geladen…",
  lastReview: (v) =>
    `Letzte Prüfung: ${v.reviewed} geprüft · ${v.relevant} Passungen · ${v.notRelevant} nicht passend · ${v.manual} manuell · ${v.errors} Fehler`,
  lastDraft: (v) =>
    `Letzter Entwurfslauf: ${v.drafted} entworfen · Hinweise ${v.flags} · Limit ${v.cap} (heute schon ${v.already}) · ${v.errors} Fehler`,
  lastPipeline: (v) =>
    `Letzter Lauf: geholt ${v.fetched} · relevant ${v.relevant} · entworfen ${v.drafted} (Limit ${v.cap}) · ${v.errors} Fehler`,
  addToApplications: "Zu meinen Bewerbungen hinzufügen",
  addToApplicationsHint:
    "Erstellt eine neue Tracker-Zeile aus diesem Job und Entwurf. Ändert keine bestehenden Bewerbungen und sendet nichts an Arbeitgeber.",
  tabs: {
    all: (n) => `Alle (${n})`,
    new: (n) => `Neu (${n})`,
    potentialFit: (n) => `Mögliche Passung (${n})`,
    notAFit: (n) => `Nicht passend (${n})`,
    manual: (n) => `Manuell (${n})`,
    shortlisted: (n) => `Shortlist (${n})`,
    skipped: (n) => `Übersprungen (${n})`,
    drafting: (n) => `Wird entworfen (${n})`,
    draftsReady: (n) => `Entwürfe bereit (${n})`,
    changes: (n) => `Änderungen (${n})`,
    documentsApproved: (n) => `Dokumente freigegeben (${n})`,
    sending: (n) => `Wird gesendet (${n})`,
    sent: (n) => `Gesendet (${n})`,
    rejected: (n) => `Abgelehnt (${n})`,
  },
  queues: {
    choose: (n) => `Jobs wählen (${n})`,
    documents: (n) => `Dokumente prüfen (${n})`,
    send: (n) => `Bereit zum Senden (${n})`,
    sentHistory: (n) => `Gesendet (${n})`,
    overviewChoose: "Jobs wählen",
    overviewDocuments: "Dokumente prüfen",
    overviewSend: "Bereit zum Senden",
    shortlist: "Auf Shortlist",
    skip: "Überspringen",
    approveDocuments: "Dokumente freigeben",
    waitingRedraft: "Wartet auf Neu-Entwurf",
    readyToSubmit: "Bereit zur Einreichung",
    openPortal: "Portal öffnen",
    sendBlockedFlags:
      "Versand nicht möglich, solange Erfindungshinweise offen sind — zuerst beheben.",
    emptyChoose: "Keine Jobs zur Shortlist-Entscheidung.",
    emptyDocuments: "Keine Entwürfe zur Dokumentenprüfung.",
    emptySend: "Keine Bewerbungen bereit zum Senden.",
    selected: (n) => `${n} ausgewählt`,
  },
  confirmSendSubject: (title) => `Bewerbung: ${title}`,
  confirmSendAttachments: "Anhänge",
  confirmSendMode: (mode) =>
    mode === "live" ? "Versandmodus: Live (Gmail)" : "Versandmodus: Test (Stub / kein Gmail)",
  confirmSendCoverLabel: "Anschreiben",
  empty: {
    title: "Keine Jobs in dieser Ansicht",
    body: "Profilfakten bestätigen, Suche starten, Passungen prüfen, dann hier entwerfen und freigeben.",
    noNewToday: "Heute keine neuen Jobs gefunden",
    noFits: "Keine möglichen Passungen zur Entscheidung",
    noApproved: "Noch keine Bewerbungen mit freigegebenen Dokumenten",
    noSent: "Noch nichts als gesendet markiert",
    noRejected: "Keine abgelehnten Jobs",
  },
  status: {
    new: "Neu",
    potential_fit: "Mögliche Passung",
    not_a_fit: "Nicht passend",
    manual: "Manuelle Prüfung",
    shortlisted: "Shortlist",
    skipped: "Übersprungen",
    drafting: "Wird entworfen",
    drafts_ready: "Entwürfe bereit",
    changes_requested: "Änderungen angefordert",
    documents_approved: "Dokumente freigegeben",
    sending: "Wird gesendet…",
    sent: "Gesendet",
    rejected: "Abgelehnt",
    reviewing: "Mögliche Passung",
    not_relevant: "Nicht passend",
    needs_manual_review: "Manuelle Prüfung",
    approved: "Dokumente freigegeben",
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
  startEmailSend: "E-Mail senden…",
  confirmSendTitle: "Diese Bewerbungs-E-Mail senden?",
  confirmSendDescription: (to) =>
    to
      ? `Startet ein 30-Sekunden-Rückgängig-Fenster und sendet danach das Anschreiben an ${to} per Gmail (falls verbunden). Nur dieser eine Job — nie im Stapel.`
      : "Startet ein 30-Sekunden-Rückgängig-Fenster und versucht danach den Gmail-Versand nur für diesen Job. Keine Empfängeradresse gesetzt — Versand wird übersprungen, bis eine Adresse vorhanden ist.",
  confirmSendConfirm: "Versand bestätigen",
  confirmSendCancel: "Abbrechen",
  undoSend: "Versand rückgängig",
  undoCountdown: (seconds) => `Versand in ${seconds}s — Rückgängig möglich`,
  gmailNotConnected:
    "Gmail ist nicht verbunden. Es wurde keine E-Mail gesendet. Sie können selbst senden und dann als gesendet markieren.",
  markAsSent: "Als gesendet markieren",
  portalReadyHint:
    "Bereit zur eigenen Einreichung im Arbeitgeberportal. Nach der Bewerbung „Als gesendet markieren“ — EquitAI reicht nie auf Portalen ein.",
  emailApprovedHint:
    "Für E-Mail freigegeben. Versand bestätigen für 30-Sekunden-Rückgängig; danach sendet EquitAI per Gmail, wenn OAuth-Env gesetzt ist.",
  sendingHint:
    "Rückgängig-Fenster aktiv. Danach sendet EquitAI per Gmail, wenn Zugangsdaten gesetzt sind; sonst wird der Versand übersprungen.",
  sentHint: "Gesendet (oder als gesendet markiert). Der Job bleibt in der Warteschlange und wird nicht erneut geholt.",
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
    sendUndone: "Versand rückgängig — Dokumente wieder freigegeben",
    markedSent: "Als gesendet markiert",
    emailSent: "E-Mail per Gmail gesendet",
    gmailStub: "Gmail nicht verbunden — Versand übersprungen",
    gmailSendFailed: "Gmail-Versand fehlgeschlagen — Dokumente wieder freigegeben",
    loadFailed: "Warteschlange konnte nicht geladen werden",
    actionFailed: "Aktion fehlgeschlagen",
    pipelineComplete: "Pipeline abgeschlossen",
    addedToApplications: "Zu Bewerbungen hinzugefügt",
    alreadyInApplications: "Bereits in Ihren Bewerbungen",
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
