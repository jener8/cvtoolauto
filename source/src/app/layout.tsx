import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { SITE_ORIGIN } from "@/lib/brand"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const siteOrigin = SITE_ORIGIN
/** Canonical URL for sharing (trailing slash matches og:url). */
const canonicalSiteUrl = `${siteOrigin}/`
/**
 * Share image for Facebook/WhatsApp — JPEG (~90KB) so Meta’s crawler reliably fetches it.
 * Large PNGs often fail silently → platforms fall back to the favicon. PNG stays in /public for other uses.
 */
const OG_SHARE_IMAGE = `${SITE_ORIGIN}/og-cv-tool-v3.jpg?v=1`

/** EquitAI — root layout defaults (mission site at `/`; tool routes override as needed). */
const pageTitle = "EquitAI"
const pageDescription =
  "EquitAI is an open initiative for AI-automated CV building and job applications — helping people tailor resumes, track applications, and move through hiring with clarity."

/** Open Graph / Twitter card — preview title matches homepage positioning. */
const socialTitle = "EquitAI — AI-Automated CV Building and Job Applications"
const socialDescription = pageDescription

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: pageTitle,
  description: pageDescription,
  generator: "v0.app",
  openGraph: {
    title: socialTitle,
    description: socialDescription,
    url: canonicalSiteUrl,
    siteName: "EquitAI",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: OG_SHARE_IMAGE,
        secureUrl: OG_SHARE_IMAGE,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "EquitAI — AI-Automated CV Building and Job Applications",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: socialDescription,
    images: [
      {
        url: OG_SHARE_IMAGE,
        width: 1200,
        height: 630,
        alt: "EquitAI — AI-Automated CV Building and Job Applications",
      },
    ],
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.jpg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // `suppressHydrationWarning` on <html> and <body> silences the
    // dev-only mismatch caused by browser extensions (ColorZilla,
    // Grammarly, dark-mode tools, etc.) that inject attributes like
    // `cz-shortcut-listen` onto these elements before React hydrates.
    // It only affects attribute diffs on the elements it's applied to,
    // not the rest of the tree.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full font-sans antialiased" suppressHydrationWarning>
        {children}
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
