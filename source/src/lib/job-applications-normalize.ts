import type { JobApplication } from "@/lib/types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidJobApplicationId(id: string | undefined | null): boolean {
  if (!id?.trim()) return false
  return UUID_RE.test(id.trim())
}

export type JobApplicationNormalizeResult = {
  applications: JobApplication[]
  duplicateIdsFixed: number
  invalidIdsFixed: number
}

/** Ensure every application has a unique, database-safe UUID. */
export function ensureJobApplicationIds(
  applications: JobApplication[],
): JobApplicationNormalizeResult {
  const seen = new Set<string>()
  let duplicateIdsFixed = 0
  let invalidIdsFixed = 0

  const normalized = applications.map((app) => {
    const trimmedId = app.id?.trim() ?? ""
    const invalid = !isValidJobApplicationId(trimmedId)
    const duplicate = trimmedId !== "" && seen.has(trimmedId)

    if (!invalid && !duplicate) {
      seen.add(trimmedId)
      return app
    }

    if (invalid) invalidIdsFixed += 1
    if (duplicate) duplicateIdsFixed += 1

    const id = crypto.randomUUID()
    seen.add(id)
    return { ...app, id }
  })

  return { applications: normalized, duplicateIdsFixed, invalidIdsFixed }
}

export function prepareJobApplicationsForWorkspace(
  applications: JobApplication[],
): JobApplication[] {
  return ensureJobApplicationIds(applications).applications
}

export type JobApplicationPipelineCounts = {
  loaded: number
  filtered: number
  duplicateIds: number
  invalidIds: number
  missingJobTitle: number
  missingCompany: number
}

export function analyzeJobApplicationPipeline(input: {
  loaded: JobApplication[]
  filtered: JobApplication[]
}): JobApplicationPipelineCounts {
  const idCounts = new Map<string, number>()
  for (const app of input.loaded) {
    const id = app.id?.trim() ?? ""
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
  }

  let duplicateIds = 0
  let invalidIds = 0
  for (const [id, count] of idCounts) {
    if (!isValidJobApplicationId(id)) invalidIds += count
    if (count > 1) duplicateIds += count - 1
  }

  return {
    loaded: input.loaded.length,
    filtered: input.filtered.length,
    duplicateIds,
    invalidIds,
    missingJobTitle: input.loaded.filter((app) => !app.jobTitle?.trim()).length,
    missingCompany: input.loaded.filter((app) => !app.company?.trim()).length,
  }
}
