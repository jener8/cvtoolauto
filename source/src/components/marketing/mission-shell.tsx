"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { MISSION_NAV } from "@/lib/marketing-nav"
import { MARKETING_CONTACT_HREF, TOOL_ENTRY_PATH } from "@/lib/marketing-site"
import { cn } from "@/lib/utils"

type MissionShellProps = {
  children: ReactNode
}

export function MissionShell({ children }: MissionShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1A1A] antialiased">
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6 lg:h-[4.5rem] lg:px-20">
          <Link href="/" className="group flex flex-col leading-none" onClick={closeMenu}>
            <span className="text-lg font-bold tracking-tight text-[#1A1A1A]">
              Equit<span className="text-[var(--color-primary-light)]">AI</span>
            </span>
            <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-light)]">
              Open initiative
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
            {MISSION_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#6B7280] transition-colors hover:text-[#1A1A1A]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={TOOL_ENTRY_PATH}
              className="text-sm font-medium text-[var(--color-primary-light)] transition-colors hover:text-[#256952]"
            >
              Open the Tool
            </Link>
            <a
              href={MARKETING_CONTACT_HREF}
              className="rounded-full bg-[var(--color-primary-light)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#256952]"
            >
              Get in Touch
            </a>
          </nav>

          <button
            type="button"
            className="inline-flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={cn("h-0.5 w-5 bg-[#1A1A1A] transition-transform", menuOpen && "translate-y-2 rotate-45")} />
            <span className={cn("h-0.5 w-5 bg-[#1A1A1A] transition-opacity", menuOpen && "opacity-0")} />
            <span className={cn("h-0.5 w-5 bg-[#1A1A1A] transition-transform", menuOpen && "-translate-y-2 -rotate-45")} />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-white px-6 pt-24 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <nav className="flex flex-col gap-6">
            {MISSION_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-2xl font-semibold text-[#1A1A1A]"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            ))}
            <Link
              href={TOOL_ENTRY_PATH}
              className="text-2xl font-semibold text-[var(--color-primary-light)]"
              onClick={closeMenu}
            >
              Open the Tool
            </Link>
            <a
              href={MARKETING_CONTACT_HREF}
              className="mt-4 inline-flex w-full justify-center rounded-full bg-[var(--color-primary-light)] px-5 py-3 text-base font-medium text-white"
              onClick={closeMenu}
            >
              Get in Touch
            </a>
          </nav>
        </div>
      ) : null}

      {children}

      <footer className="bg-[#1A1A1A] text-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-20">
          <div>
            <p className="text-lg font-bold tracking-tight">
              Equit<span className="text-[#4a9e7e]">AI</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/50">Open initiative</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            {MISSION_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={TOOL_ENTRY_PATH}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              Open the Tool
            </Link>
            <a
              href={MARKETING_CONTACT_HREF}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              Get in Touch
            </a>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-6 py-6 text-sm text-white/50 md:flex-row md:items-center md:justify-between lg:px-20">
            <span>© 2026 EquitAI · Jennifer Simonds · Berlin</span>
            <div className="flex flex-wrap gap-4">
              <a href="/imprint" className="transition-colors hover:text-white">
                Imprint
              </a>
              <a href={MARKETING_CONTACT_HREF} className="transition-colors hover:text-white">
                info@jennifersimonds.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
