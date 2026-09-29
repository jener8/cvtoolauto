/**
 * Run: node scripts/test-application-role-label.mjs
 */

function parseCombinedApplicationLabel(label) {
  const LABEL_SEPARATORS = [" — ", " - ", " | ", ": "]
  const trimmed = label.trim()
  if (!trimmed) return null

  for (const sep of LABEL_SEPARATORS) {
    const index = trimmed.indexOf(sep)
    if (index > 0) {
      const company = trimmed.slice(0, index).trim()
      const role = trimmed.slice(index + sep.length).trim()
      if (company && role) return { company, role }
    }
  }

  return null
}

function resolveApplicationRole(job, version) {
  const storedTitle = job.jobTitle?.trim() ?? ""
  const storedCompany = job.company?.trim() ?? ""
  const storedLocation = job.location?.trim() ?? ""

  const versionRole = version?.contactInfo?.targetRole?.trim() ?? ""
  const versionCompany = version?.contactInfo?.targetCompany?.trim() ?? ""
  const versionName = version?.name?.trim() ?? ""
  const parsedFromName = versionName ? parseCombinedApplicationLabel(versionName) : null
  const parsedFromTitle = storedTitle ? parseCombinedApplicationLabel(storedTitle) : null

  let jobTitle = storedTitle || versionRole || parsedFromName?.role || parsedFromTitle?.role || ""
  let company = storedCompany || versionCompany || parsedFromName?.company || parsedFromTitle?.company || ""

  if (!jobTitle && versionName) {
    jobTitle = versionName
  }

  return { jobTitle, company, location: storedLocation }
}

const cases = [
  {
    name: "Head of UX stays full title when inferred from resume name",
    run: () => {
      const role = resolveApplicationRole(
        { jobTitle: "", company: "" },
        { name: "Head of UX", contactInfo: {} },
      )
      return role.jobTitle === "Head of UX" && role.company === ""
    },
  },
  {
    name: "Explicit separator still splits company and role",
    run: () => {
      const parsed = parseCombinedApplicationLabel("Heraeus — Responsible AI Manager")
      return parsed?.company === "Heraeus" && parsed?.role === "Responsible AI Manager"
    },
  },
  {
    name: "Multi-word title without separator is not split",
    run: () => parseCombinedApplicationLabel("Director of Engineering") === null,
  },
  {
    name: "Stored title takes precedence over resume name",
    run: () => {
      const role = resolveApplicationRole(
        { jobTitle: "Senior UX Designer", company: "Acme" },
        { name: "Head of UX", contactInfo: {} },
      )
      return role.jobTitle === "Senior UX Designer" && role.company === "Acme"
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  if (c.run()) {
    passed++
    console.log(`✓ ${c.name}`)
  } else {
    failed++
    console.error(`✗ ${c.name}`)
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
