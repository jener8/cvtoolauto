#!/usr/bin/env node
/**
 * Upload merged localStorage backup → Supabase (resume_versions, cover_letters,
 * job_applications, folders). Run from source/src:
 *   node scripts/upload-localstorage-to-supabase.mjs [backup.json]
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(__dirname, "..")

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function parseArray(raw) {
  if (raw == null || raw === "") return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

function wireToCompact(raw) {
  if (!raw || typeof raw !== "object") return null
  const r = raw
  if (r.v === 2 && typeof r.i === "string" && typeof r.t === "string") {
    const meta = r.cl
    return {
      id: r.i,
      name: r.n || "Untitled Resume",
      updatedAt: r.u,
      createdAt: r.a,
      folderId: r.f,
      resumeText: r.t,
      contactInfo: r.c || {},
      accentColor: r.ac,
      accentColorHex: r.ah,
      profilePhotoBorder: r.pb,
      targetBoxBgColor: r.bg,
      targetBoxBorderColor: r.bc,
      jobDescription: r.j,
      profileImage: r.pi,
      companyLogo: r.lg,
      coverLetterMeta: meta
        ? {
            id: meta.i,
            name: meta.n,
            updatedAt: meta.u,
            contentEn: meta.en,
            contentDe: meta.de,
            contactPersonName: meta.p,
            hiringManager: meta.h,
            recipientCompany: meta.rc,
            profileImage: meta.pi,
            companyLogo: meta.lg,
            applicantName: meta.an,
            applicantAddress: meta.adr,
            applicantEmail: meta.em,
            applicantPhone: meta.ph,
          }
        : null,
    }
  }
  if (typeof r.id === "string" && typeof r.resumeText === "string") {
    return {
      id: r.id,
      name: r.name || "Untitled Resume",
      updatedAt: r.updatedAt ?? Date.now(),
      createdAt: r.createdAt ?? Date.now(),
      folderId: r.folderId,
      resumeText: r.resumeText,
      contactInfo: r.contactInfo || {},
      accentColor: r.accentColor,
      accentColorHex: r.accentColorHex,
      profilePhotoBorder: r.profilePhotoBorder,
      targetBoxBgColor: r.targetBoxBgColor,
      targetBoxBorderColor: r.targetBoxBorderColor,
      jobDescription: r.jobDescription,
      profileImage: r.profileImage,
      companyLogo: r.companyLogo,
      coverLetterMeta: r.coverLetter ?? null,
    }
  }
  return null
}

function expandContact(raw) {
  if (!raw || typeof raw !== "object") return {}
  return {
    email: raw.e ?? raw.email ?? "",
    linkedin: raw.li ?? raw.linkedin ?? "",
    phone: raw.p ?? raw.phone ?? "",
    address: raw.ad ?? raw.address ?? "",
    citizenship: raw.cz ?? raw.citizenship ?? "",
    portfolios: raw.pf ?? raw.portfolios ?? [],
    showPortfolio: raw.sp ?? raw.showPortfolio,
    professionalTitle: raw.pt ?? raw.professionalTitle ?? "",
    name: raw.nm ?? raw.name ?? "",
    language: raw.l ?? raw.language ?? "en",
    targetCompany: raw.tc ?? raw.targetCompany ?? "",
    targetRole: raw.tr ?? raw.targetRole ?? "",
    jobAdvertSource: raw.ja ?? raw.jobAdvertSource ?? "",
    portfolio: raw.po ?? raw.portfolio ?? "",
  }
}

function expandResume(compact) {
  const meta = compact.coverLetterMeta
  const coverLetter = meta
    ? {
        id: meta.id,
        name: meta.name || `Cover Letter - ${compact.name}`,
        contentEn: meta.contentEn ?? "",
        contentDe: meta.contentDe ?? "",
        contactPersonName: meta.contactPersonName ?? meta.hiringManager ?? "",
        hiringManager: meta.hiringManager,
        recipientCompany: meta.recipientCompany ?? "",
        profileImage: meta.profileImage ?? null,
        companyLogo: meta.companyLogo ?? null,
        applicantName: meta.applicantName ?? "",
        applicantAddress: meta.applicantAddress ?? "",
        applicantEmail: meta.applicantEmail ?? "",
        applicantPhone: meta.applicantPhone ?? "",
        createdAt: meta.createdAt ?? meta.updatedAt ?? compact.createdAt,
        updatedAt: meta.updatedAt ?? compact.updatedAt,
      }
    : null

  return {
    id: compact.id,
    name: compact.name,
    resumeText: compact.resumeText ?? "",
    profileImage: compact.profileImage ?? null,
    companyLogo: compact.companyLogo ?? null,
    createdAt: compact.createdAt,
    updatedAt: compact.updatedAt,
    contactInfo: expandContact(compact.contactInfo),
    accentColor: compact.accentColor,
    accentColorHex: compact.accentColorHex,
    profilePhotoBorder: compact.profilePhotoBorder,
    targetBoxBgColor: compact.targetBoxBgColor,
    targetBoxBorderColor: compact.targetBoxBorderColor,
    jobDescription: compact.jobDescription,
    folderId: compact.folderId,
    coverLetter,
  }
}

function resumeToDbRow(v) {
  const createdAtIso = new Date(v.createdAt ?? Date.now()).toISOString()
  const updatedAtIso = new Date(v.updatedAt ?? Date.now()).toISOString()
  return {
    id: v.id,
    name: v.name || "Untitled Resume",
    resume_text: v.resumeText || "",
    profile_image: v.profileImage || null,
    company_logo: v.companyLogo || null,
    contact_info: v.contactInfo,
    accent_color: v.accentColor || v.accentColorHex || null,
    job_description: v.jobDescription || null,
    folder_id: v.folderId || null,
    profile_photo_border: v.profilePhotoBorder !== false,
    target_box_bg_color: v.targetBoxBgColor || null,
    target_box_border_color: v.targetBoxBorderColor || null,
    user_id: null,
    created_at: createdAtIso,
    updated_at: updatedAtIso,
  }
}

function coverLetterToDbRow(cl, folderId) {
  const createdAt = cl.createdAt ?? Date.now()
  const updatedAt = cl.updatedAt ?? createdAt
  return {
    id: cl.id,
    name: cl.name || `Cover Letter - ${folderId ?? "Resume"}`,
    content_en: cl.contentEn ?? "",
    content_de: cl.contentDe ?? "",
    contact_person_name: cl.contactPersonName ?? cl.hiringManager ?? "",
    folder_id: folderId || null,
    user_id: null,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function jobToDbRow(app) {
  const company = (app.company || "").trim() || "Unknown Company"
  const role = (app.jobTitle || "").trim() || "Untitled role"
  return {
    id: app.id,
    role,
    company,
    job_description: {
      content: app.jobDescription ?? "",
      summary: app.jobDescriptionSummary ?? "",
      url: app.jobDescriptionUrl ?? "",
      resumeVersionId: app.resumeVersionId ?? "",
      contactPerson: app.contactPersonName ?? "",
      salary: app.salaryExpectation ?? "",
      employmentType: app.employmentType ?? "full-time",
      firstInterviewDate: app.firstInterviewDate
        ? new Date(app.firstInterviewDate).toISOString()
        : null,
      additionalInterviewDates: (app.additionalInterviewDates ?? []).map((v) =>
        new Date(v).toISOString(),
      ),
      rejectionDate: app.rejectionDate ? new Date(app.rejectionDate).toISOString() : null,
      offerDate: app.offerDate ? new Date(app.offerDate).toISOString() : null,
      pipeline: (app.pipeline ?? []).map((record) => ({
        stage: record.stage,
        outcome: record.outcome,
        date: record.date ? new Date(record.date).toISOString() : null,
        notes: record.notes ?? null,
      })),
      location: app.location?.trim() || null,
    },
    job_strategy: app.jobStrategy ?? null,
    why_content: { text: app.why ?? "" },
    company_info: app.companyInfo ?? null,
    contacts: app.contacts ?? [],
    cover_letter: app.coverLetter ?? null,
    cover_letter_id: app.coverLetterId || null,
    resume_version_id: app.resumeVersionId || null,
    interview_prep: app.interviewPrep ?? null,
    fit_scores: app.fitScores ?? null,
    red_flags: app.redFlags ?? null,
    status: app.status || "applied",
    folder_id: app.folderId || null,
    user_id: null,
    applied_date: new Date(app.appliedDate ?? Date.now()).toISOString(),
    created_at: new Date(app.appliedDate ?? Date.now()).toISOString(),
    updated_at: new Date(app.lastModified ?? Date.now()).toISOString(),
  }
}

function folderToDbRow(f) {
  return {
    id: f.id,
    name: f.name,
    profile_image: f.profileImage || null,
    contact_info: f.contactInfo || null,
    user_id: null,
    created_at: new Date(f.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(f.updatedAt ?? Date.now()).toISOString(),
  }
}

async function upsert(supabase, table, rows) {
  if (!rows.length) return { count: 0, error: null }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" })
  return { count: rows.length, error }
}

async function main() {
  const env = loadEnvFile(resolve(srcRoot, ".env.local"))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
    process.exit(1)
  }

  const backupPath =
    process.argv[2] ??
    resolve(
      srcRoot,
      "../../backups/cv-merged-localStorage-localhost-jobs-plus-production-resumes.json",
    )

  const backup = JSON.parse(readFileSync(backupPath, "utf8"))
  const keys = backup.keys ?? backup

  const folders = parseArray(keys.cv_local_folders)
  const rawResumes = parseArray(keys.cv_local_resume_versions)
  const jobs = parseArray(keys.cv_local_job_applications)
  const standaloneLetters = parseArray(keys.cv_local_cover_letters)

  const resumes = rawResumes.map(wireToCompact).filter(Boolean).map(expandResume)

  const coverLettersById = new Map()
  for (const cl of standaloneLetters) {
    if (cl?.id) coverLettersById.set(cl.id, cl)
  }
  for (const resume of resumes) {
    if (resume.coverLetter?.id && (resume.coverLetter.contentEn || resume.coverLetter.contentDe)) {
      coverLettersById.set(resume.coverLetter.id, {
        ...resume.coverLetter,
        name: resume.coverLetter.name || `Cover Letter - ${resume.name}`,
        folderId: resume.folderId,
      })
    }
  }

  const supabase = createClient(url, key)

  console.log("Uploading from:", backupPath)
  console.log("Supabase:", url)

  const before = await Promise.all([
    supabase.from("resume_versions").select("id", { count: "exact", head: true }),
    supabase.from("cover_letters").select("id", { count: "exact", head: true }),
    supabase.from("job_applications").select("id", { count: "exact", head: true }),
    supabase.from("folders").select("id", { count: "exact", head: true }),
  ])

  const folderResult = await upsert(
    supabase,
    "folders",
    folders.map(folderToDbRow),
  )
  const resumeResult = await upsert(
    supabase,
    "resume_versions",
    resumes.map(resumeToDbRow),
  )
  const letterResult = await upsert(
    supabase,
    "cover_letters",
    [...coverLettersById.values()].map((cl) => coverLetterToDbRow(cl, cl.folderId)),
  )
  const jobResult = await upsert(
    supabase,
    "job_applications",
    jobs.map(jobToDbRow),
  )

  const after = await Promise.all([
    supabase.from("resume_versions").select("id", { count: "exact", head: true }),
    supabase.from("cover_letters").select("id", { count: "exact", head: true }),
    supabase.from("job_applications").select("id", { count: "exact", head: true }),
    supabase.from("folders").select("id", { count: "exact", head: true }),
  ])

  const results = [
    ["folders", folderResult],
    ["resume_versions", resumeResult],
    ["cover_letters", letterResult],
    ["job_applications", jobResult],
  ]

  for (const [table, result] of results) {
    if (result.error) {
      console.error(`FAILED ${table}:`, result.error.message)
    } else {
      console.log(`OK ${table}: uploaded ${result.count} row(s)`)
    }
  }

  console.log("\nSupabase row counts (before → after):")
  console.log(
    "  resumes:",
    before[0].count ?? "?",
    "→",
    after[0].count ?? "?",
    `(${resumes.filter((r) => (r.resumeText || "").length > 0).length} with CV text)`,
  )
  console.log("  cover letters:", before[1].count ?? "?", "→", after[1].count ?? "?")
  console.log("  job applications:", before[2].count ?? "?", "→", after[2].count ?? "?")
  console.log("  folders:", before[3].count ?? "?", "→", after[3].count ?? "?")

  const referenced = new Set(jobs.map((j) => j.resumeVersionId).filter(Boolean))
  const uploaded = new Set(resumes.map((r) => r.id))
  const missing = [...referenced].filter((id) => !uploaded.has(id))
  if (missing.length) {
    console.log("\nStill missing resume snapshots for", missing.length, "linked application(s).")
    console.log("Those jobs are in Supabase but their CV text was not in any backup.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
