import type { Metadata } from "next"
import { MissionShell } from "@/components/marketing/mission-shell"
import {
  MissionContactSection,
  MissionExperimentsSection,
  MissionHeroSection,
  MissionProcessSection,
  MissionStatementSection,
  MissionTrustSection,
  MissionWhoSection,
} from "@/components/marketing/mission-sections"
import { SITE_ORIGIN } from "@/lib/brand"

const description =
  "EquitAI is an open initiative for AI-automated CV building and job applications — helping people tailor resumes, track applications, and move through hiring with clarity."

export const metadata: Metadata = {
  title: "EquitAI — AI-Automated CV Building and Job Applications",
  description,
  openGraph: {
    title: "EquitAI — AI-Automated CV Building and Job Applications",
    description,
    url: `${SITE_ORIGIN}/`,
    siteName: "EquitAI",
    type: "website",
    images: [
      {
        url: "/og-cv-tool-v3.jpg",
        width: 1200,
        height: 630,
        alt: "EquitAI — AI-Automated CV Building and Job Applications",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EquitAI — AI-Automated CV Building and Job Applications",
    description,
    images: ["/og-cv-tool-v3.jpg"],
  },
}

export default function HomePage() {
  return (
    <MissionShell>
      <main>
        <MissionHeroSection />
        <MissionStatementSection />
        <MissionWhoSection />
        <MissionExperimentsSection />
        <MissionProcessSection />
        <MissionTrustSection />
        <MissionContactSection />
      </main>
    </MissionShell>
  )
}
