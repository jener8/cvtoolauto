/** File types supported for CV upload in the application flow. */
export const SUPPORTED_CV_FILE_TYPES = [".pdf", ".txt", ".md"] as const

export const SUPPORTED_CV_FILE_ACCEPT = ".pdf,.txt,.md,text/plain,application/pdf"

export type CvFileExtractionResult =
  | { ok: true; text: string; fileName: string; charCount: number }
  | {
      ok: false
      fileName: string
      error: string
      supportedTypes: readonly string[]
      textDetected: boolean
    }

/** Extract plain text from uploaded CV files (.txt, .md, PDF via pdfjs-dist). */
export async function extractTextFromCvFile(file: File): Promise<string> {
  const result = await extractCvFileWithDiagnostics(file)
  if (!result.ok) throw new Error(result.error)
  return result.text
}

export async function extractCvFileWithDiagnostics(
  file: File,
): Promise<CvFileExtractionResult> {
  const name = file.name
  const lower = name.toLowerCase()

  const isSupported =
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".pdf")

  if (!isSupported) {
    return {
      ok: false,
      fileName: name,
      error:
        "This file type is not supported. Upload a PDF, TXT, or Markdown (.md) resume file, or paste your CV text instead.",
      supportedTypes: SUPPORTED_CV_FILE_TYPES,
      textDetected: false,
    }
  }

  try {
    let text = ""
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = (await file.text()).trim()
    } else if (lower.endsWith(".pdf")) {
      const buffer = await file.arrayBuffer()
      const { extractPdfText } = await import("@/lib/extract-pdf-text")
      text = await extractPdfText(new Uint8Array(buffer))
    }

    const charCount = text.length
    const { assessCvTextQuality } = await import("@/lib/cv-text-quality")
    const quality = assessCvTextQuality(text)

    if (!quality.ok) {
      return {
        ok: false,
        fileName: name,
        error: quality.reason,
        supportedTypes: SUPPORTED_CV_FILE_TYPES,
        textDetected: charCount > 0,
      }
    }

    return { ok: true, text, fileName: name, charCount }
  } catch (error) {
    console.error("[cv-import] File extraction failed:", error)
    return {
      ok: false,
      fileName: name,
      error:
        lower.endsWith(".pdf")
          ? "This PDF could not be read correctly. Please upload a text-based PDF, Word document, or paste your CV text."
          : "Could not read this file. Try a PDF or TXT export, or paste your CV text instead.",
      supportedTypes: SUPPORTED_CV_FILE_TYPES,
      textDetected: false,
    }
  }
}
