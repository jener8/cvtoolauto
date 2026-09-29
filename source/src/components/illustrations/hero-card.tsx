"use client"

import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Illustration } from "@/components/illustrations/illustration"
import type { IllustrationSlot } from "@/lib/illustration-slots"
import { cn } from "@/lib/utils"
import "./illustration.css"

export type HeroIllustrationCardProps = {
  slot: IllustrationSlot
  title: string
  body: string
  checks?: string[]
  cta?: string
  onCta?: () => void
  className?: string
  aside?: ReactNode
}

export function HeroIllustrationCard({
  slot,
  title,
  body,
  checks,
  cta,
  onCta,
  className,
  aside,
}: HeroIllustrationCardProps) {
  return (
    <div
      className={cn(
        "equit-hero-card",
        aside ? "equit-hero-card--with-aside" : undefined,
        className,
      )}
    >
      <div className="equit-hero-card__visual">
        <Illustration slot={slot} size="hero" />
      </div>
      <div className="equit-hero-card__body">
        <h2 className="equit-hero-card__title">{title}</h2>
        <p className="equit-hero-card__text">{body}</p>
        {checks && checks.length > 0 ? (
          <div className="equit-hero-card__aside mt-3">
            {checks.map((check) => (
              <span key={check} className="equit-hero-card__check">
                <span className="equit-hero-card__check-icon" aria-hidden>
                  <Check className="h-3 w-3" />
                </span>
                {check}
              </span>
            ))}
          </div>
        ) : null}
        {cta && onCta ? (
          <div className="equit-hero-card__actions">
            <Button type="button" onClick={onCta}>
              {cta}
            </Button>
          </div>
        ) : null}
      </div>
      {aside ? <div className="equit-hero-card__aside">{aside}</div> : null}
    </div>
  )
}
