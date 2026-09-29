import Link from "next/link"
import { TOOL_ENTRY_PATH } from "@/lib/marketing-site"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type MissionContainerProps = {
  children: ReactNode
  className?: string
}

export function MissionContainer({ children, className }: MissionContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1100px] px-6 lg:px-20", className)}>{children}</div>
  )
}

type MissionSectionProps = {
  id?: string
  variant?: "white" | "alt" | "dark"
  className?: string
  children: ReactNode
}

export function MissionSection({ id, variant = "white", className, children }: MissionSectionProps) {
  const bg =
    variant === "alt"
      ? "bg-[#F5F4F0]"
      : variant === "dark"
        ? "bg-[#1A1A1A] text-white"
        : "bg-white"

  return (
    <section id={id} className={cn("w-full py-16 md:py-24", bg, className)}>
      <MissionContainer>{children}</MissionContainer>
    </section>
  )
}

export function MissionEyebrow({
  children,
  className,
  accent,
}: {
  children: ReactNode
  className?: string
  accent?: boolean
}) {
  return (
    <p
      className={cn(
        "mb-4 text-xs font-semibold uppercase tracking-[0.14em]",
        accent ? "text-[var(--color-primary-light)]" : "text-[#6B7280]",
        className,
      )}
    >
      {children}
    </p>
  )
}

export function MissionH2({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "text-[1.75rem] font-bold leading-tight tracking-tight text-[#1A1A1A] md:text-[2.25rem]",
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function MissionBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-base leading-relaxed text-[#6B7280] md:text-[1.05rem]", className)}>
      {children}
    </p>
  )
}

export function MissionCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </article>
  )
}

export function GetInTouchButton({
  className,
  size = "default",
  variant = "primary",
}: {
  className?: string
  size?: "default" | "large"
  variant?: "primary" | "outline"
}) {
  const base =
    size === "large" ? "px-8 py-3.5 text-base" : "px-5 py-2 text-sm"
  const styles =
    variant === "outline"
      ? "border border-[var(--color-primary-light)] bg-transparent text-[var(--color-primary-light)] hover:bg-[var(--color-primary-light)]/5"
      : "bg-[var(--color-primary-light)] text-white hover:bg-[#256952]"

  return (
    <a
      href="mailto:info@jennifersimonds.com"
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors",
        base,
        styles,
        className,
      )}
    >
      Get in Touch →
    </a>
  )
}

export function OpenToolButton({
  className,
  size = "default",
}: {
  className?: string
  size?: "default" | "large"
}) {
  return (
    <Link
      href={TOOL_ENTRY_PATH}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--color-primary-light)] font-medium text-white transition-colors hover:bg-[#256952]",
        size === "large" ? "px-8 py-3.5 text-base" : "px-5 py-2 text-sm",
        className,
      )}
    >
      Open the Tool →
    </Link>
  )
}
