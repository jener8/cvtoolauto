import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  Brain,
  Briefcase,
  FileText,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"

const PIPELINE_STAGES = [
  { label: "Saved", count: 3, tone: "bg-slate-100 text-slate-700" },
  { label: "Applied", count: 8, tone: "bg-teal-50 text-teal-800" },
  { label: "Interview", count: 4, tone: "bg-amber-50 text-amber-900" },
  { label: "Offer", count: 1, tone: "bg-emerald-50 text-emerald-800" },
]

const LEARNING_CARDS = [
  { title: "Product roles convert 2× better", detail: "Lean into PM titles this quarter." },
  { title: "Shorter cover letters win replies", detail: "Under 220 words performed best." },
]

/**
 * Static marketing preview — mirrors the in-app Career Dashboard without live data.
 */
export function LandingProductPreview() {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--ds-radius-lg)] border border-border/80 bg-gradient-to-br from-[var(--ds-page-bg)] via-white to-[var(--ds-brand-bg)]/40 shadow-[var(--ds-shadow-sm)]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-[var(--ds-brand-dark)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
        </div>
        <p className="ml-2 text-xs font-medium text-white/90">EquitAI</p>
        <Badge
          variant="secondary"
          className="ml-auto border-0 bg-white/15 text-[10px] text-white hover:bg-white/15"
        >
          Career Dashboard
        </Badge>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-12 sm:p-5">
        {/* Opportunity match */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            Opportunity match
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-[var(--ds-brand-text)]">87</span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
            <Badge className="mb-1 ml-auto border-0 bg-emerald-100 text-[10px] text-emerald-800">
              Strong fit
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Senior Product Manager · HealthTech · Remote
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[87%] rounded-full bg-[var(--ds-brand)]" />
          </div>
        </div>

        {/* Pipeline */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-8">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            Application pipeline
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.label} className={`rounded-md px-2.5 py-2 ${stage.tone}`}>
                <p className="text-lg font-semibold tabular-nums">{stage.count}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                  {stage.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI application answers */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            AI application answers
          </div>
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-dashed border-[var(--ds-brand)]/30 bg-[var(--ds-brand-bg)]/50 px-2.5 py-2">
              <p className="text-[10px] font-medium text-[var(--ds-brand-text)]">Why this role?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                I&apos;ve shipped regulated health products end-to-end and align with your patient
                outcomes mission…
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-[var(--ds-brand)]" />
              Tailored to job description + your experience
            </div>
          </div>
        </div>

        {/* Interview insights */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            Interview success
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--ds-brand-text)]">42%</p>
          <p className="text-[10px] text-muted-foreground">Application → interview rate</p>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
            <TrendingUp className="h-3 w-3" />
            +12% vs last quarter
          </div>
        </div>

        {/* Documents capability (CV as one module) */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            Documents
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            CVs, cover letters, and exports — one capability inside your career OS.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Tailored CV", "Cover letter", "PDF export"].map((label) => (
              <span
                key={label}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/80"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Career learning */}
        <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm sm:col-span-12">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-[var(--ds-brand)]" />
            Career learning
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {LEARNING_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-md border border-border/50 bg-muted/20 px-3 py-2"
              >
                <p className="text-xs font-medium leading-snug text-foreground">{card.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
