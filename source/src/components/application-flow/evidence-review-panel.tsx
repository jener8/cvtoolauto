"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  evidenceFitDescription,
  evidenceFitLabel,
  evidenceMaturityLabel,
  evidenceSourceLabel,
  evidenceTableLayoutLabel,
  shouldRecommendTwoColumnLayout,
  buildEvidenceTableMarkdown,
  type EvidenceAssessmentPlan,
  type EvidenceAssessmentRow,
  type EvidenceFit,
  type EvidenceMaturity,
  type EvidenceTableLayout,
  EVIDENCE_FITS,
  EVIDENCE_MATURITIES,
} from "@/lib/evidence-assessment"
import { ChevronDown, ChevronRight } from "lucide-react"

type EvidenceReviewPanelProps = {
  plan: EvidenceAssessmentPlan
  outputLanguage: "en" | "de"
  onBack: () => void
  onConfirm: (payload: {
    rows: EvidenceAssessmentRow[]
    layout: EvidenceTableLayout
  }) => void
  confirming?: boolean
}

function FitBadge({ fit, lang }: { fit: EvidenceFit; lang: "en" | "de" }) {
  const tone =
    fit === "direct"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
      : fit === "transferable"
        ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800"
        : fit === "partial"
          ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800"
          : "bg-muted text-muted-foreground border-border"

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {evidenceFitLabel(fit, lang)}
    </span>
  )
}

export function EvidenceReviewPanel({
  plan,
  outputLanguage,
  onBack,
  onConfirm,
  confirming = false,
}: EvidenceReviewPanelProps) {
  const [rows, setRows] = useState<EvidenceAssessmentRow[]>(() =>
    plan.rows.map((r) => ({ ...r })),
  )
  const [layout, setLayout] = useState<EvidenceTableLayout>("two_column")
  const [expandedId, setExpandedId] = useState<string | null>(plan.rows[0]?.id ?? null)

  const lang = outputLanguage === "de" ? "de" : "en"

  const previewMarkdown = useMemo(
    () => buildEvidenceTableMarkdown(rows, { layout, outputLanguage: lang }),
    [rows, layout, lang],
  )

  const recommendTwoCol = useMemo(
    () => layout === "three_column" && shouldRecommendTwoColumnLayout(previewMarkdown),
    [layout, previewMarkdown],
  )

  const approvedCount = rows.filter((r) => r.approved).length

  const patchRow = (id: string, patch: Partial<EvidenceAssessmentRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
              userOverride: true,
            }
          : row,
      ),
    )
  }

  const copy = {
    title: lang === "de" ? "Belege prüfen" : "Review your evidence",
    subtitle:
      lang === "de"
        ? "Passung und Reife sind qualitative Einschätzungen — keine objektiven Match-Prozente. Genehmige Zeilen, bevor der Lebenslauf erzeugt wird."
        : "Fit and maturity are qualitative assessments — not objective match scores. Approve rows before the CV is generated.",
    problem: lang === "de" ? "Arbeitgeberproblem" : "Employer problem",
    layout: lang === "de" ? "CV-Tabelle" : "CV table layout",
    approve: lang === "de" ? "Für CV verwenden" : "Include on CV",
    requirement: lang === "de" ? "Anforderung" : "Job requirement",
    evidence: lang === "de" ? "Dein Beleg" : "Your evidence",
    fit: lang === "de" ? "Passung" : "Evidence fit",
    maturity: lang === "de" ? "Reife" : "Maturity",
    outcome: lang === "de" ? "Ergebnis / Status (optional)" : "Outcome / Status (optional)",
    why: lang === "de" ? "Begründung" : "Why this classification",
    back: lang === "de" ? "Zurück" : "Back",
    continue:
      lang === "de"
        ? `Lebenslauf erzeugen (${approvedCount} genehmigt)`
        : `Generate CV (${approvedCount} approved)`,
    skipTable:
      lang === "de"
        ? "Ohne Evidenztabelle fortfahren"
        : "Continue without evidence table",
    crowding:
      lang === "de"
        ? "Die dritte Spalte kann die Seite überfüllen — Zwei-Spalten-Layout empfohlen."
        : "The third column may crowd the page — two-column layout recommended.",
    disclaimer:
      lang === "de"
        ? "Keine Prozentwerte. Vorschläge sind keine umgesetzten Ergebnisse."
        : "No percentages. Proposals are not delivered results.",
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{copy.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{copy.subtitle}</p>
        <p className="text-xs text-muted-foreground">{copy.disclaimer}</p>
      </div>

      {plan.employerProblemSummary ? (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {copy.problem}
          </p>
          <p className="text-sm text-foreground leading-relaxed">{plan.employerProblemSummary}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {copy.layout}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(["two_column", "three_column"] as EvidenceTableLayout[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLayout(value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                layout === value
                  ? "border-foreground/30 bg-muted/60 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {evidenceTableLayoutLabel(value, lang)}
            </button>
          ))}
        </div>
        {recommendTwoCol || plan.layoutHint ? (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {recommendTwoCol ? copy.crowding : plan.layoutHint}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const open = expandedId === row.id
          return (
            <div key={row.id} className="rounded-lg border bg-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
                onClick={() => setExpandedId(open ? null : row.id)}
              >
                {open ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-medium text-foreground">{row.requirementPhrase}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {row.evidenceText ||
                      (lang === "de" ? "Kein Beleg ausgewählt" : "No evidence selected")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <FitBadge fit={row.fit} lang={lang} />
                    <span className="text-xs text-muted-foreground">
                      {evidenceMaturityLabel(row.maturity, lang)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {evidenceSourceLabel(row.evidenceSource, lang)}
                    </span>
                    {row.approved ? (
                      <span className="text-xs text-emerald-700 dark:text-emerald-300">
                        {lang === "de" ? "Genehmigt" : "Approved"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>

              {open ? (
                <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{copy.requirement}</Label>
                    <Textarea
                      value={row.requirementPhrase}
                      onChange={(e) => patchRow(row.id, { requirementPhrase: e.target.value })}
                      rows={2}
                      className="text-sm bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{copy.evidence}</Label>
                    <Textarea
                      value={row.evidenceText}
                      onChange={(e) =>
                        patchRow(row.id, {
                          evidenceText: e.target.value,
                          approved: e.target.value.trim().length > 0 && row.fit !== "not_evidenced",
                        })
                      }
                      rows={3}
                      className="text-sm bg-background"
                      placeholder={
                        lang === "de"
                          ? "Verifizierten Beleg einfügen oder ersetzen…"
                          : "Paste or replace verified evidence…"
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{copy.fit}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={row.fit}
                        onChange={(e) => {
                          const fit = e.target.value as EvidenceFit
                          patchRow(row.id, {
                            fit,
                            approved:
                              fit !== "not_evidenced" && row.evidenceText.trim().length > 0
                                ? row.approved
                                : false,
                          })
                        }}
                      >
                        {EVIDENCE_FITS.map((fit) => (
                          <option key={fit} value={fit}>
                            {evidenceFitLabel(fit, lang)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {evidenceFitDescription(row.fit, lang)}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{copy.maturity}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={row.maturity}
                        onChange={(e) =>
                          patchRow(row.id, { maturity: e.target.value as EvidenceMaturity })
                        }
                      >
                        {EVIDENCE_MATURITIES.map((m) => (
                          <option key={m} value={m}>
                            {evidenceMaturityLabel(m, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {layout === "three_column" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{copy.outcome}</Label>
                      <input
                        type="text"
                        value={row.outcomeLabel ?? ""}
                        onChange={(e) => patchRow(row.id, { outcomeLabel: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        placeholder={
                          lang === "de" ? "z. B. Prototyp entwickelt" : "e.g. Prototype developed"
                        }
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label className="text-xs">{copy.why}</Label>
                    <Textarea
                      value={row.fitRationale}
                      onChange={(e) => patchRow(row.id, { fitRationale: e.target.value })}
                      rows={2}
                      className="text-sm bg-background"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(row.approved)}
                      disabled={
                        row.fit === "not_evidenced" || row.evidenceText.trim().length === 0
                      }
                      onChange={(e) => patchRow(row.id, { approved: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    {copy.approve}
                  </label>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={confirming}>
          {copy.back}
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() =>
              onConfirm({
                rows: rows.map((r) => ({ ...r, approved: false })),
                layout: "two_column",
              })
            }
          >
            {copy.skipTable}
          </Button>
          <Button
            type="button"
            disabled={confirming}
            onClick={() => onConfirm({ rows, layout })}
          >
            {confirming
              ? lang === "de"
                ? "Wird erzeugt…"
                : "Generating…"
              : copy.continue}
          </Button>
        </div>
      </div>
    </div>
  )
}
