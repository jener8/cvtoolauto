"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  compressLogoToDataUrl,
  compressProfilePhotoToDataUrl,
  flattenImageDataUrl,
} from "@/lib/compress-image"
import { Upload, X } from "lucide-react"

export type CoverLetterImageFieldProps = {
  id: string
  label: string
  hint?: string
  value: string | null
  onChange: (value: string | null) => void
  maxWidth?: number
  previewShape?: "circle" | "rectangle"
}

export function CoverLetterImageField({
  id,
  label,
  hint,
  value,
  onChange,
  maxWidth = 400,
  previewShape = "rectangle",
}: CoverLetterImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadMaxWidth = previewShape === "circle" ? Math.max(maxWidth, 400) : maxWidth

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl =
        previewShape === "circle"
          ? await compressProfilePhotoToDataUrl(file, uploadMaxWidth)
          : await compressLogoToDataUrl(file, maxWidth)
      onChange(dataUrl)
    } catch (err) {
      console.error("[cover-letter] Image upload failed:", err)
      const reader = new FileReader()
      reader.onloadend = () => {
        void (async () => {
          const raw = reader.result as string
          try {
            onChange(
              await flattenImageDataUrl(raw, {
                maxWidth: uploadMaxWidth,
                quality: 0.92,
                backgroundColor: "#ffffff",
              }),
            )
          } catch {
            onChange(raw)
          }
        })()
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ""
  }

  const isLogo = previewShape === "rectangle"

  return (
    <div className="min-w-0 space-y-2 overflow-hidden">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {/* Wrap when the editor column is narrow so the button is never clipped. */}
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        {value ? (
          <div className="relative shrink-0">
            {isLogo ? (
              <div
                className="flex items-center justify-center overflow-visible bg-white"
                style={{
                  maxWidth: 96,
                  maxHeight: 52,
                  padding: 4,
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={value}
                  alt=""
                  className="block bg-white"
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: 88,
                    maxHeight: 44,
                    objectFit: "contain",
                    objectPosition: "center",
                  }}
                />
              </div>
            ) : (
              <img
                src={value}
                alt=""
                className="h-16 w-16 rounded-full border-2 border-border object-cover"
              />
            )}
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            className={
              previewShape === "circle"
                ? "flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/40"
                : "flex h-[52px] w-[96px] shrink-0 items-center justify-center border border-dashed border-border bg-white"
            }
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 basis-[9.5rem] space-y-1">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full max-w-full justify-center"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{value ? "Replace image" : "Upload image"}</span>
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full max-w-full text-xs"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          ) : null}
          {hint ? <p className="text-xs text-muted-foreground break-words">{hint}</p> : null}
        </div>
      </div>
    </div>
  )
}
