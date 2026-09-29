import Image from "next/image"
import { ILLUSTRATION_SLOT_META, type IllustrationSlot } from "@/lib/illustration-slots"
import { cn } from "@/lib/utils"
import "./illustration.css"

export type IllustrationSize = "small" | "medium" | "large" | "hero" | "featured"

const ILLUSTRATION_SIZES: Record<IllustrationSize, number> = {
  small: 96,
  medium: 160,
  large: 220,
  hero: 380,
  featured: 480,
}

export type IllustrationProps = {
  slot: IllustrationSlot
  size?: IllustrationSize
  className?: string
}

export function Illustration({ slot, size = "medium", className }: IllustrationProps) {
  const { src, alt } = ILLUSTRATION_SLOT_META[slot]
  const dimension = ILLUSTRATION_SIZES[size]

  return (
    <div
      className={cn("equit-illustration", `equit-illustration--${size}`, className)}
      aria-hidden={!alt}
    >
      <Image
        src={src}
        alt={alt}
        width={dimension}
        height={dimension}
        className="equit-illustration__img"
        sizes={`(max-width: 640px) 100vw, ${dimension}px`}
      />
    </div>
  )
}

export type { IllustrationSlot }
