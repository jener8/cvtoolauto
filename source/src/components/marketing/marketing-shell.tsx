"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MarketingShellProps = {
  children: ReactNode
  className?: string
}

/** Public marketing chrome — nav structure matches cv-by-design.com; styles use shared design-system tokens. */
export function MarketingShell({ children, className }: MarketingShellProps) {
  return (
    <div className={cn("ds-marketing-page min-h-screen", className)}>
      <header className="ds-marketing-nav">
        <Link href="/" className="ds-marketing-nav__brand">
          Equit<span className="ds-marketing-nav__ai">AI</span>
        </Link>
        <nav aria-label="Main">
          <ul className="ds-marketing-nav__links hidden items-center gap-5 md:flex">
            <li>
              <a href="https://cv-by-design.com/#who" className="ds-nav-pillar">
                Who it&apos;s for
              </a>
            </li>
            <li>
              <a href="https://cv-by-design.com/#process">The process</a>
            </li>
            <li>
              <a href="https://cv-by-design.com/#pricing">Pricing</a>
            </li>
            <li>
              <a
                href="mailto:info@jennifersimonds.com"
                className="ds-btn ds-btn--secondary !min-h-8 !px-3 !text-xs !normal-case !tracking-normal"
              >
                Contact
              </a>
            </li>
            <li>
              <Link href="/app" className="ds-btn ds-btn--primary !min-h-8 !px-4 !text-xs">
                Start Free
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      {children}
      <footer className="ds-marketing-footer">
        <span className="text-sm font-medium text-white/90">EquitAI</span>
        <div className="flex flex-wrap gap-4">
          <a href="https://cv-by-design.com/">Marketing site</a>
          <a href="/login">Sign in</a>
          <a href="mailto:info@jennifersimonds.com">info@jennifersimonds.com</a>
        </div>
      </footer>
    </div>
  )
}
