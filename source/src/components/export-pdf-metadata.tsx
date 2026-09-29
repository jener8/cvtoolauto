"use client"

import { useEffect } from "react"

/** Injects PDF file-property metadata into document head for server-side PDF export. */
export function ExportPdfMetadata({ content }: { content: string }) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement("meta")
      meta.setAttribute("name", "description")
      document.head.appendChild(meta)
    }
    meta.setAttribute("content", content)
  }, [content])

  return null
}
