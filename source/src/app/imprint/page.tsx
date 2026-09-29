import type { Metadata } from "next"
import Link from "next/link"
import { MissionContainer, MissionEyebrow, MissionH2 } from "@/components/marketing/mission-primitives"
import { MissionShell } from "@/components/marketing/mission-shell"
import { MARKETING_CONTACT_HREF } from "@/lib/marketing-site"

export const metadata: Metadata = {
  title: "Imprint — EquitAI",
  description: "Legal imprint and contact details for EquitAI.",
}

export default function ImprintPage() {
  return (
    <MissionShell>
      <main className="bg-white py-16 md:py-24">
        <MissionContainer>
          <MissionEyebrow>Legal</MissionEyebrow>
          <MissionH2>Imprint</MissionH2>
          <div className="mt-8 max-w-2xl space-y-6 text-base leading-relaxed text-[#6B7280]">
            <p>
              <strong className="text-[#1A1A1A]">EquitAI</strong>
              <br />
              Jennifer Simonds
              <br />
              Berlin, Germany
            </p>
            <p>
              Email:{" "}
              <a href={MARKETING_CONTACT_HREF} className="text-[var(--color-primary-light)] hover:underline">
                info@jennifersimonds.com
              </a>
            </p>
            <p>
              EquitAI is an open Human-Centred AI initiative exploring how automation can redesign
              work while keeping judgement, inclusion and opportunity with people. This site is a
              research and experiment platform — not a commercial product listing.
            </p>
            <p>
              <Link href="/" className="text-[var(--color-primary-light)] hover:underline">
                ← Back to EquitAI
              </Link>
            </p>
          </div>
        </MissionContainer>
      </main>
    </MissionShell>
  )
}
