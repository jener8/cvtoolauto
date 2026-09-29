import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { buildSeedFacts } from "@/lib/agents/seed-facts"
import { mapAgentProfileFactRow } from "@/lib/agents/profile-facts"
import { mapResumeVersionRow } from "@/lib/resume-persistence"
import type { QualificationProfile } from "@/lib/qualification-profile/types"

export const runtime = "nodejs"

/**
 * POST /api/agents/profile/seed
 * Seeds unconfirmed facts from resume_versions (server read) + qualification profile
 * (client-supplied JSON — localStorage only; never written back).
 * Idempotent via source_key unique index.
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { qualificationProfile?: QualificationProfile | null } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // empty body is fine — resume-only seed
  }

  try {
    const { data: rows, error: resumeError } = await ctx.supabase
      .from("resume_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .abortSignal(ctx.controller.signal)

    if (resumeError) {
      console.error("[api/agents/profile/seed] resume load", resumeError)
      return NextResponse.json({ error: resumeError.message }, { status: 503 })
    }

    const versions = (rows ?? []).map((row) =>
      mapResumeVersionRow(row as Record<string, unknown>),
    )

    const { facts: seedFacts, resumeId, resumeName } = buildSeedFacts({
      versions,
      qualificationProfile: body.qualificationProfile ?? null,
    })

    if (seedFacts.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: 0,
        facts: [],
        resumeId,
        resumeName,
        message:
          "No facts found. Add a master CV and/or complete your qualification profile, then seed again.",
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
      totalCandidates: seedFacts.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to seed profile facts"
    console.error("[api/agents/profile/seed]", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
