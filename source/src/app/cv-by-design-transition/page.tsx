import type { Metadata } from "next"
import { CvByDesignTransitionPage } from "@/components/marketing/cv-by-design-transition"

export const metadata: Metadata = {
  title: "CV by Design has become EquitAI",
  description:
    "CV by Design has evolved into EquitAI. Visit equitai.eu.com to continue your career journey.",
  robots: { index: true, follow: true },
}

export default function CvByDesignTransitionRoute() {
  return <CvByDesignTransitionPage />
}
