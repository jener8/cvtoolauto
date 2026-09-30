"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search, UserCheck } from "lucide-react"

export function AgentsHomePage() {
  return (
    <div
      className="min-h-[70vh] px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,122,95,0.12), transparent), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
      }}
    >
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/app">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>

        <p className="text-sm font-medium tracking-wide" style={{ color: "#2D7A5F" }}>
          EquitAI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Job agents
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Confirm your master profile, then run listing searches from allowed job APIs. Drafting and
          sends come later — never auto-apply without your approval.
        </p>

        <div className="mt-10 space-y-4">
          <Link
            href="/app/agents/profile"
            className="group flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-[#2D7A5F]/40 hover:shadow-md"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: "#2D7A5F" }}
            >
              <UserCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold text-stone-900 group-hover:text-[#2D7A5F]">
                Master profile
              </span>
              <span className="mt-1 block text-sm text-stone-600">
                Seed facts from your resume and qualifications, then confirm, edit, or delete each
                one.
              </span>
            </span>
          </Link>

          <Link
            href="/app/agents/settings"
            className="group flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-[#2D7A5F]/40 hover:shadow-md"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: "#2D7A5F" }}
            >
              <Search className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold text-stone-900 group-hover:text-[#2D7A5F]">
                Search settings
              </span>
              <span className="mt-1 block text-sm text-stone-600">
                Keywords, location, remote, languages, seniority — then Run search to fetch and
                de-duplicate listings.
              </span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
