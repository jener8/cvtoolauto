import type { ReactNode } from "react"
import { Fraunces, Inter } from "next/font/google"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-cvd-serif",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-cvd-sans",
  display: "swap",
})

export default function CvByDesignTransitionLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${inter.variable} font-[family-name:var(--font-cvd-sans)] [&_h1]:font-[family-name:var(--font-cvd-serif)] [&_h2]:font-[family-name:var(--font-cvd-serif)]`}>
      {children}
    </div>
  )
}
