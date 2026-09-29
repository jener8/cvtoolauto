import { cleanCoverLetterBody } from "@/lib/cover-letter-contact"
import { appendStrategicProfileToPrompt } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

function buildGermanRule(): string {
  return `
WICHTIGE DEUTSCHE FORMATREGEL:
Nach der Anrede muss der erste Satz mit einem Kleinbuchstaben beginnen.

Richtig:
Sehr geehrte Damen und Herren,
ich bewerbe mich...

Falsch:
Sehr geehrte Damen und Herren,
Ich bewerbe mich...
`
}

export type BuildCoverLetterPromptInput = {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  strategicProfile?: StrategicProfile | null
  /** Body-only letters skip salutation/closing in output */
  bodyOnly?: boolean
  applicantName?: string
  applicantEmail?: string
  applicantAddress?: string
  applicantPhone?: string
  contactPerson?: string
}

export function buildCoverLetterPrompt(input: BuildCoverLetterPromptInput): string {
  const {
    language,
    jobTitle,
    company,
    jobDescription,
    resumeContent,
    strategicProfile,
    bodyOnly = true,
    applicantName,
    applicantEmail,
    applicantAddress,
    applicantPhone,
    contactPerson,
  } = input

  const applicantBlock = [
    applicantName ? `Applicant name: ${applicantName}` : "",
    applicantEmail ? `Applicant email: ${applicantEmail}` : "",
    applicantAddress ? `Applicant location: ${applicantAddress}` : "",
    applicantPhone ? `Applicant phone: ${applicantPhone}` : "",
    contactPerson ? `Contact person (if known): ${contactPerson}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const noPlaceholderRule =
    language === "en"
      ? "Never use bracket placeholders such as [Your Name], [Your Address], [Email Address], [Phone Number], or [Date]. Contact details are added separately — write only letter body paragraphs."
      : "Verwende niemals Platzhalter in eckigen Klammern wie [Ihr Name], [Ihre Adresse], [E-Mail] oder [Datum]. Kontaktdaten werden separat eingefügt — schreibe nur die Hauptabsätze."

  if (language === "en") {
    const bodyInstruction = bodyOnly
      ? "Provide only the body paragraphs (no sender block, recipient block, date line, salutation, or closing signature)."
      : "Include a professional salutation and closing, suitable for a formal cover letter."

    return appendStrategicProfileToPrompt(
      `Write a professional cover letter in English for ${jobTitle} at ${company}.

JOB DESCRIPTION:
${jobDescription || "[No job description provided]"}

RESUME:
${resumeContent || "[No resume provided]"}

${applicantBlock}

Instructions:
- Make it specific to the role and company.
- Highlight relevant experience from the resume only — do not invent facts.
- Keep the tone professional, warm, and confident.
- Avoid generic phrases.
- Use **bold** for key achievements or skills where helpful (format: **text**).
- Approximately 3–4 paragraphs for the main body.
- ${bodyInstruction}
- ${noPlaceholderRule}

Return only the cover letter text. Do not wrap it in a code block.`,
      strategicProfile,
      "en",
    )
  }

  const bodyInstruction = bodyOnly
    ? "Gib nur die Hauptabsätze an (keine Kopfzeile, keine Anrede, kein Datum, keine Schlussformel)."
    : "Füge eine professionelle Anrede und Schlussformel hinzu."

  return appendStrategicProfileToPrompt(
    `Schreibe ein professionelles Anschreiben auf Deutsch für ${jobTitle} bei ${company}.

STELLENBESCHREIBUNG:
${jobDescription || "[Keine Stellenbeschreibung]"}

LEBENSLAUF:
${resumeContent || "[Kein Lebenslauf]"}

${applicantBlock}

Anweisungen:
- Beziehe dich konkret auf die Rolle und das Unternehmen.
- Hebe nur relevante Erfahrungen aus dem Lebenslauf hervor — erfinde keine Fakten.
- Professioneller, klarer und selbstbewusster Ton.
- Vermeide generische Formulierungen.
- Verwende **Fettdruck** für wichtige Erfolge (Format: **Text**).
- Ungefähr 3–4 Absätze im Hauptteil.
- ${bodyInstruction}
- ${noPlaceholderRule}

${buildGermanRule()}

Gib nur den Anschreiben-Text zurück. Kein Code-Block.`,
    strategicProfile,
    "de",
  )
}

export function cleanCoverLetterAiOutput(
  text: string,
  language: "en" | "de" = "en",
): string {
  return cleanCoverLetterBody(text, language)
}
