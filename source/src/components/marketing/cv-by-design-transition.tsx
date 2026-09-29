import Image from "next/image"
import Link from "next/link"
import { SITE_ORIGIN } from "@/lib/brand"
import { MARKETING_IMAGES, MARKETING_IMAGE_ALT } from "@/lib/marketing-images"
import { ILLUSTRATION_SLOT_META } from "@/lib/illustration-slots"

const FEATURES = [
  {
    title: "Better applications",
    text: "Create German-style CVs and cover letters that highlight your true value.",
    icon: "document",
  },
  {
    title: "Understand the market",
    text: "Get guidance on the German job market, qualifications, and career pathways.",
    icon: "chart",
  },
  {
    title: "Stronger communication",
    text: "Prepare motivation, salary, and application answers with confidence.",
    icon: "chat",
  },
  {
    title: "Build confidence",
    text: "Tell your story, recognise your strengths, and step into opportunities.",
    icon: "person",
  },
  {
    title: "Use AI responsibly",
    text: "Learn how to use AI safely and transparently in your job search.",
    icon: "brain",
  },
  {
    title: "More opportunities",
    text: "Find roles that match your skills and track your applications.",
    icon: "briefcase",
  },
] as const

const TIMELINE = [
  { year: "2023", color: "bg-[#c97b5c]", text: "CV by Design. A personal AI career project begins." },
  {
    year: "2024",
    color: "bg-[#8fa88a]",
    text: "Research & learning. UX, responsible AI, accessibility and migration.",
  },
  {
    year: "2025+",
    color: "bg-[#0f4f4a]",
    text: "EquitAI. A platform for equal opportunities for women in Germany.",
  },
] as const

const PARTNERS = [
  "Migrant Women",
  "NGOs & Community Organisations",
  "Career Centres",
  "Employers & Partners",
] as const

function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href={SITE_ORIGIN}
      className={`inline-flex items-center justify-center rounded-full bg-[#0d4a45] px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3d39] ${className}`}
    >
      Continue to EquitAI →
    </Link>
  )
}

/** Shown when cv-by-design.com is served from the Next.js app (middleware rewrite). */
export function CvByDesignTransitionPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#3d4f56] antialiased">
      <header className="border-b border-[#e2e8e6] px-6 py-5">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0f4f4a] text-[0.65rem] font-bold text-[#0f4f4a]">
              CV
            </span>
            <span className="text-[0.9375rem] font-semibold text-[#1a2e35]">CV by Design</span>
          </div>
          <p className="text-sm text-[#6b7c82]">
            A new chapter <span className="text-[#c97b5c]">♥</span>
          </p>
        </div>
      </header>

      <section className="bg-gradient-to-b from-white to-[#faf8f4] px-6 py-14 lg:py-16">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#0f4f4a]">
              CV by Design has evolved
            </p>
            <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight text-[#1a2e35] md:text-[2.75rem]">
              A new mission. The same heart. <span className="text-[#c97b5c]">♥</span>
            </h1>
            <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed">
              <p>
                What started as a personal project to help people write better CVs has grown into something
                bigger — a platform built for women migrating to Germany who deserve more than templates and
                guesswork.
              </p>
              <p>
                EquitAI is the next chapter: ethical, human-centred AI that supports career integration —
                German-style applications, job search progress, confidence-building, and safe use of
                technology along the way.
              </p>
              <p>
                The promise stays the same: your experience matters, your story deserves to be heard, and
                you belong in your future.
              </p>
            </div>
            <div className="mt-8 flex flex-col items-start gap-4">
              <CtaButton />
              <a href="#what-this-means" className="text-sm font-medium text-[#0f4f4a] hover:underline">
                Learn more about the new mission ↓
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="aspect-square overflow-hidden rounded-[45%_55%_52%_48%/48%_45%_55%_52%] bg-[#eef5f2] shadow-lg">
              <Image
                src={ILLUSTRATION_SLOT_META["section.mentoringSupport"].src}
                alt={ILLUSTRATION_SLOT_META["section.mentoringSupport"].alt}
                width={640}
                height={640}
                className="h-full w-full object-cover object-top"
                priority
              />
            </div>
            <p className="absolute bottom-6 left-4 right-4 max-w-[16rem] rounded-xl bg-white p-3.5 text-xs leading-snug text-[#1a2e35] shadow-lg">
              Built from experience. Designed for impact. A future we build together.
            </p>
          </div>
        </div>
      </section>

      <section id="what-this-means" className="px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="text-center font-serif text-3xl font-medium text-[#1a2e35] md:text-[2.125rem]">
            What this means for you
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef5f2] text-[#0f4f4a]">
                  <span className="text-lg">•</span>
                </div>
                <h3 className="text-[0.9375rem] font-semibold text-[#1a2e35]">{f.title}</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#6b7c82]">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-[1120px] rounded-[1.75rem] bg-[#faf8f4] p-8 md:p-10">
          <h2 className="font-serif text-[1.75rem] font-medium text-[#1a2e35]">Our journey</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {TIMELINE.map((item) => (
              <div key={item.year} className="text-center">
                <div className={`mx-auto mb-4 h-9 w-9 rounded-full border-[3px] border-white shadow ${item.color}`} />
                <p className="font-bold text-[#1a2e35]">{item.year}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6b7c82]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-[#eef5f2]">
            <Image
              src={MARKETING_IMAGES.equity}
              alt={MARKETING_IMAGE_ALT.equity}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <p className="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1a2e35] shadow">
              Built with, not just for.
            </p>
          </div>
          <div>
            <h2 className="font-serif text-3xl font-medium text-[#1a2e35]">Built with, not just for.</h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed">
              The next chapter is being built together with migrant women, NGOs, career centres, and
              community organisations — so the platform reflects real journeys, not assumptions.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {PARTNERS.map((label) => (
                <p key={label} className="text-center text-[0.6875rem] font-medium leading-snug text-[#6b7c82]">
                  {label}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-[1120px] rounded-[1.75rem] bg-[#e8f2ee] px-6 py-12 text-center md:px-12">
          <h2 className="mx-auto max-w-xl font-serif text-2xl font-medium leading-snug text-[#1a2e35] md:text-3xl">
            Different name. Bigger purpose. Same promise: You belong in your future.
          </h2>
          <div className="mt-8">
            <CtaButton />
          </div>
          <p className="mt-5 text-sm text-[#6b7c82]">
            Thank you for being part of this journey. <span className="text-[#c97b5c]">♥</span>
          </p>
        </div>
      </section>

      <footer className="border-t border-[#e2e8e6] px-6 py-6 text-center text-[0.8125rem] text-[#6b7c82]">
        <p>© CV by Design · now EquitAI</p>
        <p className="mt-2 flex flex-wrap justify-center gap-4">
          <a href="https://cv-by-design.com/imprint.html" className="text-[#0f4f4a] hover:underline">
            Imprint
          </a>
          <Link href="/imprint" className="text-[#0f4f4a] hover:underline">
            EquitAI imprint
          </Link>
        </p>
      </footer>
    </div>
  )
}
