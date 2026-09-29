/** When true, A4 debug outlines and page labels are shown in resume preview. */
export function isPdfDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PDF_DEBUG === "true") return true
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("pdfDebug") === "1"
}
