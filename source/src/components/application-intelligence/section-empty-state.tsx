"use client"

import { Button } from "@/components/ui/button"
import { Illustration, type IllustrationSize } from "@/components/illustrations/illustration"
import type { IllustrationSlot } from "@/lib/illustration-slots"
import { cn } from "@/lib/utils"
import "@/components/illustrations/illustration.css"

type SectionEmptyStateProps = {
  heading: string
  body: string
  cta?: string
  note?: string
  slot?: IllustrationSlot
  /** Stacked layout — illustration full width above text (better in narrow cards). */
  layout?: "side" | "stacked"
  illustrationSize?: IllustrationSize
  onCta?: () => void
  className?: string
}

export function SectionEmptyState({
  heading,
  body,
  cta,
  note,
  slot,
  layout = "side",
  illustrationSize,
  onCta,
  className,
}: SectionEmptyStateProps) {
  if (slot) {
    const imageSize = illustrationSize ?? (layout === "stacked" ? "featured" : "hero")

    return (
      <div
        className={cn(
          "equit-empty-state",
          layout === "stacked" && "equit-empty-state--stacked",
          className,
        )}
      >
        <div className="equit-empty-state__inner">
          <div className="equit-empty-state__visual">
            <Illustration slot={slot} size={imageSize} />
          </div>
          <div>
            <h2 className="equit-empty-state__heading">{heading}</h2>
            <p className="equit-empty-state__body">{body}</p>
            {note ? <p className="equit-empty-state__note">{note}</p> : null}
            {cta && onCta ? (
              <div className="equit-empty-state__cta">
                <Button type="button" onClick={onCta}>
                  {cta}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--color-primary-light)]/25 bg-[var(--color-primary-light)]/[0.04] px-6 py-10 text-center sm:px-10",
        className,
      )}
    >
      <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">{heading}</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{body}</p>
      {note ? (
        <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-muted-foreground/90">
          {note}
        </p>
      ) : null}
      {cta && onCta ? (
        <Button type="button" className="mt-6" onClick={onCta}>
          {cta}
        </Button>
      ) : null}
    </div>
  )
}
