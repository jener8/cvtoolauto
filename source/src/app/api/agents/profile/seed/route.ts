import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { buildSeedFacts } from "@/lib/agents/seed-facts"
import { mapAgentProfileFactRow } from "@/lib/agents/profile-facts"
import { mapResumeVersionRow } from "@/lib/resume-persistence"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import type { ResumeVersion } from "@/lib/types"

export const runtime = "nodejs"

const MAX_CLIENT_RESUMES = 24
const MAX_CLIENT_RESUME_TEXT = 80_000

type ClientResumePayload = {
  id?: string
  name?: string | null
  resumeText?: string | null
  contactInfo?: ResumeVersion["contactInfo"] | null
}

function normalizeClientResumes(raw: unknown): ResumeVersion[] {
  if (!Array.isArray(raw)) return []
  const out: ResumeVersion[] = []
  for (const item of raw.slice(0, MAX_CLIENT_RESUMES)) {
    if (!item || typeof item !== "object") continue
    const row = item as ClientResumePayload
    const text = typeof row.resumeText === "string" ? row.resumeText.trim() : ""
    if (!text) continue
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `client-${out.length}-${text.length}`
    out.push({
      id,
      name: (typeof row.name === "string" && row.name.trim()) || "Saved CV",
      resumeText: text.slice(0, MAX_CLIENT_RESUME_TEXT),
      profileImage: null,
      companyLogo: null,
      timestamp: Date.now(),
      contactInfo: (row.contactInfo ?? {
        email: "",
        linkedin: "",
        phone: "",
        address: "",
        citizenship: "",
        portfolio: "",
        portfolios: [],
        showPortfolio: false,
        professionalTitle: "",
        name: "",
        language: "en",
        targetCompany: "",
        targetRole: "",
        jobAdvertSource: "",
      }) as ResumeVersion["contactInfo"],
    })
  }
  return out
}

/**
 * POST /api/agents/profile/seed
 * Seeds unconfirmed facts from resume_versions (server read) + optional client
 * workspace CVs (browser localStorage) + qualification profile.
 * Idempotent via source_key unique index.
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: {
    qualificationProfile?: QualificationProfile | null
    resumeText?: string | null
    resumeLabel?: string | null
    resumeVersionId?: string | null
    allWorkspaceResumes?: boolean
    clientResumes?: ClientResumePayload[]
    ownerKey?: string | null
    ownerHint?: string | null
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // empty body is fine — resume-only seed
  }

  try {
    const { data: rows, error: resumeError } = await ctx.supabase
      .from("resume_versions")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .abortSignal(ctx.controller.signal)

    if (resumeError) {
      console.error("[api/agents/profile/seed] resume load", resumeError)
      return NextResponse.json({ error: resumeError.message }, { status: 503 })
    }

    let versionRows = rows ?? []
    if (versionRows.length === 0) {
      // Older workspaces / remapped auth: fall back to whatever RLS returns for this session
      const { data: visible, error: visibleError } = await ctx.supabase
        .from("resume_versions")
        .select("*")
        .order("created_at", { ascending: false })
        .abortSignal(ctx.controller.signal)
      if (visibleError) {
        console.error("[api/agents/profile/seed] resume fallback", visibleError)
      } else {
        versionRows = visible ?? []
      }
    }

    const versions = versionRows.map((row) =>
      mapResumeVersionRow(row as Record<string, unknown>),
    )
    const clientVersions = normalizeClientResumes(body.clientResumes)

    const { facts: seedFacts, resumeId, resumeName, directions, resumeCount, ownerLabel } =
      buildSeedFacts({
      versions,
      clientVersions,
      qualificationProfile: body.qualificationProfile ?? null,
      resumeText: body.resumeText ?? null,
      resumeLabel: body.resumeLabel ?? null,
      resumeVersionId: body.resumeVersionId ?? null,
      allWorkspaceResumes: body.allWorkspaceResumes === true,
      ownerKey: body.ownerKey ?? null,
      ownerHint: body.ownerHint ?? null,
    })

    if (seedFacts.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: 0,
        facts: [],
        resumeId,
        resumeName,
        directions: [],
        resumeCount,
        ownerLabel,
        message:
          clientVersions.length === 0 && versions.length === 0
            ? "No CVs found in this browser or the cloud. Open your workspace CVs here, or upload a file."
            : "No readable CV text found for that person. Pick your name, or upload a CV.",
      })
    }

    const rowsToInsert = seedFacts.map((fact) => ({
      user_id: ctx.userId,
      category: fact.category,
      fact_text: fact.factText,
      status: "unconfirmed" as const,
      source: fact.source,
      source_ref: fact.sourceRef ?? {},
      source_key: fact.sourceKey,
      sort_order: fact.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    }))

    // Upsert on (user_id, source_key) — only inserts new keys; does not overwrite edited facts
    const { data: upserted, error: insertError } = await ctx.supabase
      .from("agent_profile_facts")
      .upsert(rowsToInsert, {
        onConflict: "user_id,source_key",
        ignoreDuplicates: true,
      })
      .select("*")
      .abortSignal(ctx.controller.signal)

    if (insertError) {
      // Partial unique index may not map to onConflict in all PostgREST versions —
      // fall back to per-row insert ignoring duplicates.
      console.warn("[api/agents/profile/seed] upsert failed, falling back:", insertError.message)
      let inserted = 0
      let skipped = 0
      const created: ReturnType<typeof mapAgentProfileFactRow>[] = []

      for (const row of rowsToInsert) {
        const { data, error } = await ctx.supabase
          .from("agent_profile_facts")
          .insert(row)
          .select("*")
          .abortSignal(ctx.controller.signal)
          .maybeSingle()

        if (error) {
          if (error.code === "23505") {
            skipped += 1
            continue
          }
          console.error("[api/agents/profile/seed] insert", error)
          return NextResponse.json({ error: error.message }, { status: 503 })
        }
        if (data) {
          inserted += 1
          created.push(mapAgentProfileFactRow(data as Parameters<typeof mapAgentProfileFactRow>[0]))
        } else {
          skipped += 1
        }
      }

      return NextResponse.json({
        inserted,
        skipped,
        facts: created,
        resumeId,
        resumeName,
        directions,
        resumeCount,
        ownerLabel,
        totalCandidates: seedFacts.length,
      })
    }

    const facts = (upserted ?? []).map((row) =>
      mapAgentProfileFactRow(row as Parameters<typeof mapAgentProfileFactRow>[0]),
    )
    const inserted = facts.length
    const skipped = seedFacts.length - inserted

    return NextResponse.json({
      inserted,
      skipped,
      facts,
      resumeId,
      resumeName,
      directions,
      resumeCount,
      ownerLabel,
      totalCandidates: seedFacts.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to seed profile facts"
    console.error("[api/agents/profile/seed]", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
