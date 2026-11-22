import type {
  EvidenceFit,
  EvidenceMaturity,
  EvidenceSourceKind,
  EvidenceTableLayout,
} from "@/lib/evidence-assessment/types"

export function evidenceFitLabel(fit: EvidenceFit, lang: "en" | "de" = "en"): string {
  if (lang === "de") {
    switch (fit) {
      case "direct":
        return "Direkt"
      case "transferable":
        return "Übertragbar"
      case "partial":
        return "Teilweise"
      case "not_evidenced":
        return "Nicht belegt"
    }
  }
  switch (fit) {
    case "direct":
      return "Direct"
    case "transferable":
      return "Transferable"
    case "partial":
      return "Partial"
    case "not_evidenced":
      return "Not evidenced"
  }
}

export function evidenceFitDescription(fit: EvidenceFit, lang: "en" | "de" = "en"): string {
  if (lang === "de") {
    switch (fit) {
      case "direct":
        return "Deutlich dieselbe Fähigkeit oder Verantwortung nachgewiesen."
      case "transferable":
        return "Relevante Fähigkeit in einem anderen Kontext nachgewiesen."
      case "partial":
        return "Belege decken nur einen Teil der Anforderung ab."
      case "not_evidenced":
        return "Kein zuverlässiger Beleg identifiziert."
    }
  }
  switch (fit) {
    case "direct":
      return "Demonstrated substantially the same capability or responsibility."
    case "transferable":
      return "Demonstrated a relevant capability in another context."
    case "partial":
      return "Available evidence supports only part of the requirement."
    case "not_evidenced":
      return "No reliable supporting evidence identified."
  }
}

export function evidenceMaturityLabel(
  maturity: EvidenceMaturity,
  lang: "en" | "de" = "en",
): string {
  if (lang === "de") {
    switch (maturity) {
      case "delivered":
        return "Umgesetzt"
      case "in_progress":
        return "In Arbeit"
      case "proposed":
        return "Vorgeschlagen"
    }
  }
  switch (maturity) {
    case "delivered":
      return "Delivered"
    case "in_progress":
      return "In progress"
    case "proposed":
      return "Proposed"
  }
}

export function evidenceSourceLabel(
  source: EvidenceSourceKind,
  lang: "en" | "de" = "en",
): string {
  if (lang === "de") {
    switch (source) {
      case "experience":
        return "Berufserfahrung"
      case "project":
        return "Projekt"
      case "research":
        return "Forschung"
      case "other":
        return "Sonstiges"
    }
  }
  switch (source) {
    case "experience":
      return "Experience"
    case "project":
      return "Project"
    case "research":
      return "Research"
    case "other":
      return "Other"
  }
}

export function evidenceTableLayoutLabel(
  layout: EvidenceTableLayout,
  lang: "en" | "de" = "en",
): string {
  if (lang === "de") {
    return layout === "three_column"
      ? "Drei Spalten (Ergebnis / Status)"
      : "Zwei Spalten (Standard)"
  }
  return layout === "three_column"
    ? "Three columns (Outcome / Status)"
    : "Two columns (default)"
}

export function evidenceTableHeaders(
  layout: EvidenceTableLayout,
  lang: "en" | "de" = "en",
): string[] {
  if (lang === "de") {
    if (layout === "three_column") {
      return ["Rollenkriterium", "Stärkster Beleg", "Ergebnis / Status"]
    }
    return ["Rollenkriterium", "Stärkster Beleg"]
  }
  if (layout === "three_column") {
    return ["Role criterion", "Strongest evidence", "Outcome / Status"]
  }
  return ["Role criterion", "Strongest evidence"]
}

export function evidenceSectionHeading(lang: "en" | "de" = "en"): string {
  return lang === "de" ? "AUSGEWÄHLTE BELEGE" : "SELECTED EVIDENCE"
}
