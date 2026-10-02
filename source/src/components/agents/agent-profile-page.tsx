"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { loadQualificationProfile } from "@/lib/qualification-profile/storage"
import type { AgentProfileFact } from "@/lib/agents/types"
import {
  detectProfileLocale,
  getProfileCopy,
  type ProfileLocale,
} from "@/lib/agents/profile-copy"
import {
  evaluateProfileReadiness,
  groupFactsBySection,
  PROFILE_SECTION_ORDER,
  resolveProfileStep,
  sourceLabelForFact,
  type ProfileSectionId,
  type ProfileStep,
} from "@/lib/agents/profile-readiness"
import { AGENTS_ACCENT } from "@/lib/agents/copy"
import {
  extractCvFileWithDiagnostics,
  SUPPORTED_CV_FILE_ACCEPT,
} from "@/lib/extract-document-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import {
  ArrowLeft,
  Check,
  Compass,
  Linkedin,
  Loader2,
  Plus,
  Upload,
} from "lucide-react"

type WorkspaceResume = { id: string; name: string }
type WorkspacePerson = { key: string; displayName: string; count: number }

type HandSection = "experience" | "achievement" | "education" | "skills" | "languages"

async function fetchFacts(): Promise<AgentProfileFact[]> {
  const res = await fetch("/api/agents/profile", { credentials: "same-origin" })
  if (res.status === 404) throw new Error("Job agents are disabled")
  const data = (await res.json()) as { facts?: AgentProfileFact[]; error?: string }
  if (!res.ok) throw new Error(data.error ?? "Failed to load")
  return data.facts ?? []
}

async function loadWorkspaceCvContext(): Promise<{
  people: WorkspacePerson[]
  resumesByPerson: Record<string, WorkspaceResume[]>
  defaultOwnerKey: string | null
}> {
  try {
    const [{ loadAllResumesForAccount }, { groupResumesByPerson, pickOwnResumePerson }] =
      await Promise.all([
        import("@/lib/resume-persistence"),
        import("@/lib/agents/own-resumes"),
      ])
    const local = await loadAllResumesForAccount()
    const withText = local.filter((v) => v.resumeText?.trim())
    if (withText.length === 0) {
      return { people: [], resumesByPerson: {}, defaultOwnerKey: null }
    }
    const groups = groupResumesByPerson(withText)
    const people = groups
      .filter((g) => g.key !== "unknown" || groups.length === 1)
      .map((g) => ({
        key: g.key,
        displayName: g.displayName,
        count: g.withTextCount,
      }))
    const resumesByPerson: Record<string, WorkspaceResume[]> = {}
    for (const g of groups) {
      resumesByPerson[g.key] = g.versions.map((v) => ({
        id: v.id,
        name: (v.name || "Untitled CV").trim() || "Untitled CV",
      }))
    }
    const picked = pickOwnResumePerson(withText)
    return {
      people,
      resumesByPerson,
      defaultOwnerKey: picked?.key ?? people[0]?.key ?? null,
    }
  } catch {
    return { people: [], resumesByPerson: {}, defaultOwnerKey: null }
  }
}

async function loadClientResumesForSeed(): Promise<
  Array<{
    id: string
    name: string
    resumeText: string
    contactInfo: import("@/lib/types").ResumeVersion["contactInfo"]
  }>
> {
  const { loadAllResumesForAccount } = await import("@/lib/resume-persistence")
  const all = await loadAllResumesForAccount()
  return all
    .filter((v) => v.resumeText?.trim())
    .slice(0, 40)
    .map((v) => ({
      id: v.id,
      name: (v.name || "Untitled CV").trim() || "Untitled CV",
      resumeText: v.resumeText.slice(0, 80_000),
      contactInfo: v.contactInfo,
    }))
}

function StepBar({
  step,
  copy,
}: {
  step: ProfileStep
  copy: ReturnType<typeof getProfileCopy>
}) {
  const items: Array<{ id: ProfileStep; label: string }> = [
    { id: 1, label: copy.steps.add },
    { id: 2, label: copy.steps.check },
    { id: 3, label: copy.steps.ready },
  ]
  return (
    <ol
      className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
      aria-label={copy.a11y.stepProgress}
    >
      {items.map((item, index) => {
        const current = item.id === step
        const done = item.id < step
        return (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {index > 0 ? (
              <span className="hidden text-stone-300 sm:inline" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1.5 font-medium ${
                current
                  ? "bg-[#2D7A5F] text-white"
                  : done
                    ? "bg-stone-200 text-stone-800"
                    : "bg-stone-100 text-stone-500"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {item.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function AgentProfilePage() {
  const [locale, setLocale] = useState<ProfileLocale>("en")
  const copy = useMemo(() => getProfileCopy(locale), [locale])
  const [facts, setFacts] = useState<AgentProfileFact[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [onlyUnchecked, setOnlyUnchecked] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [workspaceResumes, setWorkspaceResumes] = useState<WorkspaceResume[]>([])
  const [workspacePeople, setWorkspacePeople] = useState<WorkspacePerson[]>([])
  const [ownerKey, setOwnerKey] = useState<string | null>(null)
  const [resumesByPerson, setResumesByPerson] = useState<Record<string, WorkspaceResume[]>>({})
  const [showHand, setShowHand] = useState(false)
  const [handSection, setHandSection] = useState<HandSection | null>(null)
  const [adding, setAdding] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const linkedinRef = useRef<HTMLInputElement>(null)

  // Hand form fields
  const [jobTitle, setJobTitle] = useState("")
  const [employer, setEmployer] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [isCurrent, setIsCurrent] = useState(false)
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [whatYouDid, setWhatYouDid] = useState("")
  const [result, setResult] = useState("")
  const [whichRole, setWhichRole] = useState("")
  const [degree, setDegree] = useState("")
  const [institution, setInstitution] = useState("")
  const [year, setYear] = useState("")
  const [skills, setSkills] = useState("")
  const [language, setLanguage] = useState("")
  const [langLevel, setLangLevel] = useState("fluent")

  useEffect(() => {
    setLocale(detectProfileLocale())
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [next, cvContext] = await Promise.all([fetchFacts(), loadWorkspaceCvContext()])
      setFacts(next)
      setWorkspacePeople(cvContext.people)
      setResumesByPerson(cvContext.resumesByPerson)
      setOwnerKey((prev) =>
        prev && cvContext.resumesByPerson[prev] ? prev : cvContext.defaultOwnerKey,
      )
    } catch (error) {
      toast({
        title: copy.toast.loadFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [copy.toast.loadFail])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!ownerKey) {
      setWorkspaceResumes([])
      return
    }
    setWorkspaceResumes(resumesByPerson[ownerKey] ?? [])
  }, [ownerKey, resumesByPerson])

  const step = resolveProfileStep(facts)
  const readiness = evaluateProfileReadiness(facts, copy)
  const checked = facts.filter((f) => f.status === "confirmed").length
  const unchecked = facts.length - checked
  const grouped = groupFactsBySection(facts)

  const nextSentence =
    step === 1
      ? copy.next.add
      : step === 2
        ? copy.next.check(unchecked)
        : readiness.ready
          ? copy.next.readyDone
          : copy.next.readyMissing

  const runImport = async (body: Record<string, unknown>) => {
    setImporting(true)
    try {
      const qualificationProfile = loadQualificationProfile()
      const needsClientResumes =
        body.allWorkspaceResumes === true || typeof body.resumeVersionId === "string"
      const clientResumes = needsClientResumes ? await loadClientResumesForSeed() : []
      const res = await fetch("/api/agents/profile/seed", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          qualificationProfile,
          ...(clientResumes.length > 0 ? { clientResumes } : {}),
          ...(body.allWorkspaceResumes === true && ownerKey
            ? { ownerKey }
            : {}),
        }),
      })
      const data = (await res.json()) as {
        inserted?: number
        message?: string
        error?: string
        directions?: string[]
        resumeCount?: number
        ownerLabel?: string | null
      }
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const directions = data.directions ?? []
      const resumeCount = data.resumeCount ?? 0
      if (body.allWorkspaceResumes && resumeCount === 0) {
        toast({
          title: copy.toast.importFail,
          description: data.message ?? copy.empty.allCvsEmptyHint,
          variant: "destructive",
        })
        return
      }
      toast({
        title: copy.toast.importOk,
        description:
          resumeCount > 0 && body.allWorkspaceResumes
            ? copy.toast.importOkOwn(
                resumeCount,
                data.ownerLabel ?? null,
                directions,
              )
            : resumeCount > 0 && directions.length > 0
              ? copy.toast.importOkDirections(resumeCount, directions)
              : (data.message ?? `Imported ${data.inserted ?? 0}`),
      })
      setOnlyUnchecked(true)
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.importFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
    }
  }

  const handleFileImport = async (file: File | null, label: string) => {
    if (!file) return
    setImporting(true)
    try {
      const extracted = await extractCvFileWithDiagnostics(file)
      if (!extracted.ok) throw new Error(extracted.error)
      await runImport({
        resumeText: extracted.text,
        resumeLabel: `${label}: ${extracted.fileName}`,
      })
    } catch (error) {
      setImporting(false)
      toast({
        title: copy.toast.importFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const patchFact = async (
    id: string,
    body: { factText?: string; status?: "confirmed" | "unconfirmed" },
  ) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/agents/profile/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { fact?: AgentProfileFact; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Update failed")
      if (data.fact) {
        setFacts((prev) => prev.map((f) => (f.id === id ? data.fact! : f)))
      }
      setEditingId(null)
    } catch (error) {
      toast({
        title: copy.toast.updateFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const deleteFact = async (id: string) => {
    if (!window.confirm(copy.check.removeConfirm)) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/agents/profile/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      setFacts((prev) => prev.filter((f) => f.id !== id))
    } catch (error) {
      toast({
        title: copy.toast.removeFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const postConfirmedItem = async (factText: string, category: string) => {
    setAdding(true)
    try {
      const res = await fetch("/api/agents/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factText,
          category,
          status: "confirmed",
          source: "manual",
        }),
      })
      const data = (await res.json()) as { fact?: AgentProfileFact; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Create failed")
      if (data.fact) setFacts((prev) => [...prev, data.fact!])
      toast({ title: copy.toast.addOk })
      setHandSection(null)
      setShowHand(false)
      resetHandForm()
    } catch (error) {
      toast({
        title: copy.toast.addFail,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const resetHandForm = () => {
    setJobTitle("")
    setEmployer("")
    setFromDate("")
    setToDate("")
    setIsCurrent(false)
    setLocation("")
    setDescription("")
    setWhatYouDid("")
    setResult("")
    setWhichRole("")
    setDegree("")
    setInstitution("")
    setYear("")
    setSkills("")
    setLanguage("")
    setLangLevel("fluent")
  }

  const saveHandForm = async () => {
    if (handSection === "experience") {
      if (!jobTitle.trim() || !employer.trim()) return
      const to = isCurrent ? "current" : toDate.trim()
      const parts = [
        `${jobTitle.trim()} · ${employer.trim()}`,
        fromDate.trim() || to ? `${fromDate.trim() || "?"}–${to || "?"}` : null,
        location.trim() || null,
        description.trim() || null,
      ].filter(Boolean)
      await postConfirmedItem(parts.join(" · "), "experience")
      return
    }
    if (handSection === "achievement") {
      if (!whatYouDid.trim()) return
      const text = [whatYouDid.trim(), result.trim() || null, whichRole.trim() ? `(${whichRole.trim()})` : null]
        .filter(Boolean)
        .join(" — ")
      await postConfirmedItem(text, "achievement")
      return
    }
    if (handSection === "education") {
      if (!degree.trim() || !institution.trim()) return
      const text = [degree.trim(), institution.trim(), year.trim() || null].filter(Boolean).join(" · ")
      await postConfirmedItem(text, "education")
      return
    }
    if (handSection === "skills") {
      const tags = skills
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (!tags.length) return
      for (const tag of tags) {
        await postConfirmedItem(tag, "skill")
      }
      return
    }
    if (handSection === "languages") {
      if (!language.trim()) return
      const levelLabel =
        copy.hand.levels[langLevel as keyof typeof copy.hand.levels] ?? langLevel
      await postConfirmedItem(`${language.trim()} — ${levelLabel}`, "language")
    }
  }

  const scrollToCheck = () => {
    document.getElementById("profile-check")?.scrollIntoView({ behavior: "smooth" })
  }
  const scrollToReady = () => {
    document.getElementById("profile-ready")?.scrollIntoView({ behavior: "smooth" })
  }
  const scrollToEmpty = () => {
    document.getElementById("profile-add")?.scrollIntoView({ behavior: "smooth" })
  }

  const primaryAction =
    step === 1 ? (
      <Button
        style={{ backgroundColor: AGENTS_ACCENT }}
        className="text-white hover:opacity-90"
        onClick={scrollToEmpty}
      >
        {copy.primary.add}
      </Button>
    ) : step === 2 ? (
      <Button
        style={{ backgroundColor: AGENTS_ACCENT }}
        className="text-white hover:opacity-90"
        onClick={scrollToCheck}
      >
        {copy.primary.check}
      </Button>
    ) : readiness.ready ? (
      <Button asChild style={{ backgroundColor: AGENTS_ACCENT }} className="text-white hover:opacity-90">
        <Link href="/app/agents">{copy.primary.goAgents}</Link>
      </Button>
    ) : (
      <Button
        style={{ backgroundColor: AGENTS_ACCENT }}
        className="text-white hover:opacity-90"
        onClick={scrollToReady}
      >
        {copy.primary.addMissing}
      </Button>
    )

  const sectionLabel = (id: ProfileSectionId) => copy.sections[id]

  return (
    <div
      className="min-h-0 px-4 py-8 sm:px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,122,95,0.12), transparent), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/agents">
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
              {copy.backAgents}
            </Link>
          </Button>
          <div
            className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-stone-200"
            role="group"
            aria-label={copy.a11y.localeToggle}
          >
            {(["en", "de"] as ProfileLocale[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${
                  locale === lang ? "bg-[#2D7A5F] text-white" : "text-stone-700 hover:bg-stone-50"
                }`}
                aria-pressed={locale === lang}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm font-medium tracking-wide" style={{ color: AGENTS_ACCENT }}>
          {copy.brand}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">{copy.subtitle}</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{copy.confirmedExplain}</p>

        <StepBar step={step} copy={copy} />

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-stone-800">{nextSentence}</p>
          {primaryAction}
        </div>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            …
          </div>
        ) : null}

        {/* Step 1 empty / import */}
        {!loading && facts.length === 0 ? (
          <section id="profile-add" className="mt-10 scroll-mt-6" aria-labelledby="add-heading">
            <h2 id="add-heading" className="sr-only">
              {copy.steps.add}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <Upload className="h-6 w-6 text-[#2D7A5F]" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-stone-900">
                  {copy.empty.uploadTitle}
                </h3>
                <p className="mt-2 flex-1 text-sm text-stone-600">{copy.empty.uploadBody}</p>
                <input
                  ref={uploadRef}
                  type="file"
                  accept={SUPPORTED_CV_FILE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    void handleFileImport(e.target.files?.[0] ?? null, "CV")
                    e.target.value = ""
                  }}
                />
                <Button
                  className="mt-4"
                  style={{ backgroundColor: AGENTS_ACCENT }}
                  disabled={importing}
                  onClick={() => uploadRef.current?.click()}
                >
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {copy.empty.uploadCta}
                </Button>
              </div>

              <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <Linkedin className="h-6 w-6 text-[#2D7A5F]" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-stone-900">
                  {copy.empty.linkedinTitle}
                </h3>
                <p className="mt-2 flex-1 text-sm text-stone-600">{copy.empty.linkedinBody}</p>
                <a
                  href="https://www.linkedin.com/mypreferences/d/download-my-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm font-medium text-[#2D7A5F] underline underline-offset-2"
                >
                  {copy.empty.linkedinHowTo}
                </a>
                <input
                  ref={linkedinRef}
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    void handleFileImport(e.target.files?.[0] ?? null, "LinkedIn")
                    e.target.value = ""
                  }}
                />
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={importing}
                  onClick={() => linkedinRef.current?.click()}
                >
                  {copy.empty.linkedinCta}
                </Button>
              </div>

              <div className="flex flex-col rounded-xl border border-[#2D7A5F]/30 bg-white p-5 shadow-sm ring-1 ring-[#2D7A5F]/10">
                <Compass className="h-6 w-6 text-[#2D7A5F]" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-stone-900">
                  {copy.empty.allCvsTitle}
                </h3>
                <p className="mt-2 flex-1 text-sm text-stone-600">
                  {workspaceResumes.length > 0
                    ? copy.empty.allCvsBody(workspaceResumes.length)
                    : copy.empty.allCvsBodyUnknown}
                </p>
                {workspacePeople.length > 1 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-stone-700">{copy.empty.whoseCvs}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{copy.empty.whoseCvsHint}</p>
                    <Select
                      value={ownerKey ?? undefined}
                      onValueChange={(key) => setOwnerKey(key)}
                      disabled={importing}
                    >
                      <SelectTrigger className="mt-2 bg-white">
                        <SelectValue placeholder={copy.empty.whoseCvs} />
                      </SelectTrigger>
                      <SelectContent>
                        {workspacePeople.map((person) => (
                          <SelectItem key={person.key} value={person.key}>
                            {person.displayName} ({person.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : workspacePeople.length === 1 ? (
                  <p className="mt-3 text-xs text-stone-500">
                    {copy.empty.whoseCvsHint}{" "}
                    <span className="font-medium text-stone-700">
                      {workspacePeople[0]?.displayName}
                    </span>
                  </p>
                ) : null}
                <Button
                  className="mt-4"
                  style={{ backgroundColor: AGENTS_ACCENT }}
                  disabled={importing || (workspacePeople.length > 0 && !ownerKey)}
                  onClick={() => {
                    void runImport({ allWorkspaceResumes: true })
                  }}
                >
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {copy.empty.allCvsCta}
                </Button>
                {workspaceResumes.length > 1 ? (
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <p className="mb-2 text-xs text-stone-500">{copy.empty.orPickOne}</p>
                    <Select
                      onValueChange={(id) => {
                        void runImport({ resumeVersionId: id })
                      }}
                      disabled={importing}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={copy.empty.workspaceCta} />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaceResumes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm font-medium text-stone-700 underline underline-offset-2"
                onClick={() => {
                  setShowHand(true)
                  setHandSection(null)
                }}
              >
                {copy.empty.orHand}
              </button>
            </div>
          </section>
        ) : null}

        {/* Hand add */}
        {(showHand || handSection) && (
          <section
            className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
            aria-labelledby="hand-heading"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="hand-heading" className="text-base font-semibold text-stone-900">
                {copy.hand.title}
              </h2>
              {facts.length > 0 && !showHand ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowHand(false)
                    setHandSection(null)
                    resetHandForm()
                  }}
                >
                  {copy.hand.cancel}
                </Button>
              )}
            </div>

            {!handSection ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <p className="w-full text-sm text-stone-600">{copy.hand.pickSection}</p>
                {(
                  [
                    ["experience", copy.hand.experience],
                    ["achievement", copy.hand.achievement],
                    ["education", copy.hand.education],
                    ["skills", copy.hand.skills],
                    ["languages", copy.hand.languages],
                  ] as const
                ).map(([id, label]) => (
                  <Button key={id} variant="outline" onClick={() => setHandSection(id)}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    {label}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {handSection === "experience" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="jobTitle">{copy.hand.jobTitle}</Label>
                        <Input
                          id="jobTitle"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder={copy.hand.placeholders.jobTitle}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="employer">{copy.hand.employer}</Label>
                        <Input
                          id="employer"
                          value={employer}
                          onChange={(e) => setEmployer(e.target.value)}
                          placeholder={copy.hand.placeholders.employer}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="from">{copy.hand.from}</Label>
                        <Input
                          id="from"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          placeholder="2021"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="to">{copy.hand.to}</Label>
                        <Input
                          id="to"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          placeholder="2024"
                          className="mt-1"
                          disabled={isCurrent}
                        />
                        <label className="mt-2 flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={isCurrent}
                            onChange={(e) => setIsCurrent(e.target.checked)}
                          />
                          {copy.hand.current}
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="location">{copy.hand.location}</Label>
                        <Input
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder={copy.hand.placeholders.location}
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="desc">{copy.hand.description}</Label>
                        <Textarea
                          id="desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={copy.hand.placeholders.description}
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {handSection === "achievement" ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="did">{copy.hand.whatYouDid}</Label>
                      <Textarea
                        id="did"
                        value={whatYouDid}
                        onChange={(e) => setWhatYouDid(e.target.value)}
                        placeholder={copy.hand.placeholders.whatYouDid}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="result">{copy.hand.result}</Label>
                      <Input
                        id="result"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        placeholder={copy.hand.placeholders.result}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">{copy.hand.whichRole}</Label>
                      <Input
                        id="role"
                        value={whichRole}
                        onChange={(e) => setWhichRole(e.target.value)}
                        placeholder={copy.hand.placeholders.jobTitle}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : null}

                {handSection === "education" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="degree">{copy.hand.degree}</Label>
                      <Input
                        id="degree"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        placeholder={copy.hand.placeholders.degree}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="inst">{copy.hand.institution}</Label>
                      <Input
                        id="inst"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder={copy.hand.placeholders.institution}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">{copy.hand.year}</Label>
                      <Input
                        id="year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2018"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : null}

                {handSection === "skills" ? (
                  <div>
                    <Label htmlFor="skills">{copy.hand.skillTags}</Label>
                    <Input
                      id="skills"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder={copy.hand.placeholders.skills}
                      className="mt-1"
                    />
                  </div>
                ) : null}

                {handSection === "languages" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="lang">{copy.hand.language}</Label>
                      <Input
                        id="lang"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder={copy.hand.placeholders.language}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="level">{copy.hand.level}</Label>
                      <Select value={langLevel} onValueChange={setLangLevel}>
                        <SelectTrigger id="level" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(copy.hand.levels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    style={{ backgroundColor: AGENTS_ACCENT }}
                    className="text-white hover:opacity-90"
                    disabled={adding}
                    onClick={() => void saveHandForm()}
                  >
                    {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {copy.hand.save}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHandSection(null)
                      resetHandForm()
                    }}
                  >
                    {copy.hand.cancel}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 2 check items */}
        {!loading && facts.length > 0 ? (
          <section id="profile-check" className="mt-10 scroll-mt-6" aria-labelledby="check-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="check-heading" className="text-lg font-semibold text-stone-900">
                  {copy.steps.check}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {copy.check.progress(checked, facts.length)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <Switch checked={onlyUnchecked} onCheckedChange={setOnlyUnchecked} />
                {copy.check.onlyUnchecked}
              </label>
            </div>

            {unchecked === 0 ? (
              <div className="mt-6 rounded-xl border border-[#2D7A5F]/30 bg-[#2D7A5F]/5 p-5">
                <p className="font-semibold text-stone-900">{copy.check.allCheckedTitle}</p>
                <p className="mt-1 text-sm text-stone-600">{copy.check.allCheckedBody}</p>
                <Button
                  asChild
                  className="mt-4 text-white hover:opacity-90"
                  style={{ backgroundColor: AGENTS_ACCENT }}
                >
                  <Link href="/app/agents">{copy.primary.goAgents}</Link>
                </Button>
              </div>
            ) : null}

            <div className="mt-6 space-y-8" aria-label={copy.a11y.itemList}>
              {PROFILE_SECTION_ORDER.map((sectionId) => {
                let items = grouped[sectionId]
                if (onlyUnchecked) items = items.filter((f) => f.status !== "confirmed")
                if (!items.length) return null
                return (
                  <div key={sectionId}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                      {sectionLabel(sectionId)}
                    </h3>
                    <ul className="space-y-3">
                      {items.map((fact) => {
                        const busy = busyId === fact.id
                        const editing = editingId === fact.id
                        return (
                          <li
                            key={fact.id}
                            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                          >
                            {editing ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="min-h-[80px]"
                                  autoFocus
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    disabled={busy || !editText.trim()}
                                    onClick={() =>
                                      void patchFact(fact.id, { factText: editText.trim() })
                                    }
                                  >
                                    {copy.hand.save}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => setEditingId(null)}
                                  >
                                    {copy.hand.cancel}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm leading-relaxed text-stone-900">
                                  {fact.factText}
                                </p>
                                <p className="mt-2 text-xs text-stone-500">
                                  {copy.check.fromSource(sourceLabelForFact(fact, locale))}
                                  {fact.status === "confirmed" ? (
                                    <span className="ml-2 text-[#2D7A5F]">· ✓</span>
                                  ) : null}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {fact.status !== "confirmed" ? (
                                    <Button
                                      size="sm"
                                      disabled={busy}
                                      style={{ backgroundColor: AGENTS_ACCENT }}
                                      className="text-white hover:opacity-90"
                                      onClick={() =>
                                        void patchFact(fact.id, { status: "confirmed" })
                                      }
                                    >
                                      <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                                      {copy.check.correct}
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditingId(fact.id)
                                      setEditText(fact.factText)
                                    }}
                                  >
                                    {copy.check.edit}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-700 hover:bg-red-50"
                                    disabled={busy}
                                    onClick={() => void deleteFact(fact.id)}
                                  >
                                    {copy.check.remove}
                                  </Button>
                                </div>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowHand(true)
                  setHandSection(null)
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                {copy.hand.title}
              </Button>
            </div>
          </section>
        ) : null}

        {/* Step 3 ready */}
        {!loading && facts.length > 0 && unchecked === 0 ? (
          <section
            id="profile-ready"
            className="mt-10 scroll-mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
            aria-labelledby="ready-heading"
          >
            <h2 id="ready-heading" className="text-lg font-semibold text-stone-900">
              {copy.ready.heading}
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-stone-800">
              <li>{readiness.hasCurrentRole ? "☑" : "☐"} {copy.ready.currentRole}</li>
              <li>
                {readiness.achievementCount >= 3 ? "☑" : "☐"} {copy.ready.achievements}{" "}
                ({readiness.achievementCount}/3)
              </li>
              <li>{readiness.hasEducation ? "☑" : "☐"} {copy.ready.education}</li>
              <li>{readiness.hasLanguages ? "☑" : "☐"} {copy.ready.languages}</li>
            </ul>
            <p className="mt-3 text-sm text-stone-600">
              {copy.ready.stillMissing(readiness.missingLabels)}
            </p>
            {readiness.ready ? (
              <Button
                asChild
                className="mt-4 text-white hover:opacity-90"
                style={{ backgroundColor: AGENTS_ACCENT }}
              >
                <Link href="/app/agents">{copy.primary.goAgents}</Link>
              </Button>
            ) : readiness.missingLabels.includes(copy.ready.education) ? (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setShowHand(true)
                  setHandSection("education")
                }}
              >
                {copy.primary.addEducation}
              </Button>
            ) : (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setShowHand(true)
                  setHandSection(null)
                }}
              >
                {copy.primary.addMissing}
              </Button>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
