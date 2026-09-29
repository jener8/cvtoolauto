import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"
import { LandingProductPreview } from "@/components/landing-product-preview"
import { PRODUCT_HERO, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand"

type Feature = {
  icon: LucideIcon
  title: string
  text: string
}

export function MarketingHero() {
  return (
    <section className="ds-marketing-hero">
      <p className="ds-marketing-hero__brand">EquitAI</p>
      <h1 className="ds-marketing-hero__title">{PRODUCT_NAME}</h1>
      <p className="ds-marketing-hero__product">{PRODUCT_TAGLINE}</p>
      <p className="ds-marketing-hero__body">{PRODUCT_HERO.subtext}</p>
      <p className="ds-marketing-hero__closing">{PRODUCT_HERO.closing}</p>
      <div className="ds-marketing-hero__actions">
        <Link href="/app" className="ds-btn ds-btn--primary ds-btn--lg">
          {PRODUCT_HERO.primaryCta}
        </Link>
        <a href="#product-preview" className="ds-btn ds-btn--secondary ds-btn--lg">
          {PRODUCT_HERO.secondaryCta}
        </a>
      </div>
    </section>
  )
}

export function MarketingFeatureGrid({ features }: { features: Feature[] }) {
  return (
    <section className="ds-marketing-section">
      <p className="ds-section-kicker">Platform modules</p>
      <h2 className="ds-section-title">A career operating system, not just a CV builder</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {features.map((item) => (
          <article key={item.title} className="ds-feature-card">
            <span className="ds-feature-card__icon" aria-hidden>
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <h3 className="ds-card__title">{item.title}</h3>
            <p className="ds-card__body">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function MarketingProductPreviewSection() {
  return (
    <section
      id="product-preview"
      className="ds-marketing-section ds-marketing-section--muted px-4 sm:px-6"
    >
      <div className="ds-card ds-card--elevated overflow-hidden !p-0">
        <div className="border-b border-[var(--ds-border)] px-6 py-5 text-center sm:px-8">
          <p className="ds-card__eyebrow">Product preview</p>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--ds-text)] sm:text-2xl">
            {PRODUCT_NAME}
          </h2>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{PRODUCT_TAGLINE}</p>
        </div>
        <div className="p-4 sm:p-6">
          <LandingProductPreview />
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link href="/app" className="ds-btn ds-btn--primary ds-btn--lg gap-2">
              {PRODUCT_HERO.primaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="text-xs text-[var(--ds-text-muted)]">Sign in required</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function MarketingCtaBand() {
  return (
    <section className="ds-marketing-section">
      <div className="ds-cta-band">
        <div>
          <h2 className="ds-cta-band__title">Ready to open EquitAI?</h2>
          <p className="ds-cta-band__body">
            Start with the free workspace, or visit cv-by-design.com for coaching and personalised
            setup with Jennifer Simonds.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link href="/app" className="ds-btn ds-btn--primary ds-btn--lg">
            Start Free
          </Link>
          <a
            href="https://cv-by-design.com/"
            className="ds-btn ds-btn--ghost text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            cv-by-design.com
          </a>
        </div>
      </div>
    </section>
  )
}
