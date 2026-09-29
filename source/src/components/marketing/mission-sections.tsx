import Image from "next/image"
import {
  GetInTouchButton,
  MissionBody,
  MissionCard,
  MissionContainer,
  MissionEyebrow,
  MissionH2,
  MissionSection,
  OpenToolButton,
} from "@/components/marketing/mission-primitives"
import { MARKETING_IMAGES, MARKETING_IMAGE_ALT } from "@/lib/marketing-images"
import { TOOL_ENTRY_PATH } from "@/lib/marketing-site"
import Link from "next/link"

const FOCUS_THEMES = [
  {
    title: "Human-centred AI automation",
    text: "Design automation around what people need to do well — not only around what software can execute.",
  },
  {
    title: "Workflow reinvention",
    text: "Question the current process before accelerating it. Redesign work, then decide what to automate.",
  },
  {
    title: "Responsible AI & oversight",
    text: "Keep human judgement where it matters: decisions, accountability, and meaningful review.",
  },
  {
    title: "Inclusion & accessibility",
    text: "Ask who a redesigned workflow might exclude — by language, digital confidence, career path, or access.",
  },
  {
    title: "Practical experimentation",
    text: "Prototype, evaluate, and share what we learn. Prefer measurable experiments over AI hype.",
  },
] as const

const RESEARCH_QUESTIONS = [
  "What should AI automate — and what should it only augment?",
  "Where must humans remain in control?",
  "Who could be excluded by a redesigned workflow?",
  "How can AI-supported work stay understandable and accessible?",
  "How do we measure whether automation improves experience and outcome?",
  "What guardrails and oversight are needed?",
] as const

const TRUST_CARDS = [
  {
    title: "Responsible by default",
    text: "EquitAI treats privacy, transparency, and human oversight as design requirements — not afterthoughts.",
  },
  {
    title: "Human judgement stays in the loop",
    text: "We explore where automation helps, and where people must remain accountable for decisions and outcomes.",
  },
  {
    title: "Inclusion as a design criterion",
    text: "Accessibility, language, digital confidence, and non-standard career histories shape how workflows are evaluated.",
  },
] as const

export function MissionHeroSection() {
  return (
    <section className="w-full bg-white">
      <MissionContainer className="grid min-h-[80vh] items-center gap-10 py-16 md:min-h-screen md:grid-cols-2 md:gap-12 md:py-24">
        <div className="text-left">
          <MissionEyebrow>EQUITAI · OPEN INITIATIVE</MissionEyebrow>
          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-[#1A1A1A] md:text-[2.75rem] lg:text-[3.25rem]">
            AI-Automated CV Building
            <br />
            and Job Applications
          </h1>
          <MissionBody className="mt-6 max-w-xl">
            EquitAI is an open initiative for AI-automated CV building and job applications —
            helping people tailor resumes, track applications, and move through hiring with clarity,
            while keeping human judgement at the centre.
          </MissionBody>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <OpenToolButton size="large" />
            <GetInTouchButton variant="outline" />
          </div>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F5F4F0] md:aspect-auto md:min-h-[28rem]">
          <Image
            src={MARKETING_IMAGES.heroPlatform}
            alt={MARKETING_IMAGE_ALT.heroPlatform}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </MissionContainer>
    </section>
  )
}

export function MissionStatementSection() {
  return (
    <MissionSection id="mission" variant="alt">
      <div className="mx-auto max-w-3xl text-center">
        <MissionEyebrow className="text-center">THE FOCUS</MissionEyebrow>
        <MissionH2 className="text-center">
          Automation shouldn&apos;t just remove work.
          <br />
          It should redesign work around what humans do best.
        </MissionH2>
        <MissionBody className="mt-6">
          EquitAI sits at the intersection of AI, automation, human-centred design, responsible AI and
          inclusion. We explore how organisations and practitioners can redesign workflows with AI —
          while keeping judgement, accountability and opportunity with people.
        </MissionBody>
        <MissionBody className="mt-4">
          The initiative began in the GRAILS 2025 programme at Elisava (Barcelona School of Design and
          Engineering), and continues as an open space for practical experiments rather than finished
          products or consultancy claims.
        </MissionBody>
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          {FOCUS_THEMES.map((theme) => (
            <MissionCard key={theme.title}>
              <h3 className="text-base font-semibold text-[#1A1A1A]">{theme.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{theme.text}</p>
            </MissionCard>
          ))}
        </div>
      </div>
    </MissionSection>
  )
}

export function MissionWhoSection() {
  return (
    <MissionSection id="focus" variant="white">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 lg:order-1">
          <MissionEyebrow>WHO THIS IS FOR</MissionEyebrow>
          <MissionH2>
            Built for people redesigning
            <br />
            work with AI — carefully.
          </MissionH2>
          <MissionBody className="mt-6">
            EquitAI is for AI transformation, product, innovation and responsible-AI practitioners who
            want automation that improves outcomes without erasing human agency — and for anyone
            affected by how those systems are designed.
          </MissionBody>
          <ul className="mt-8 space-y-4">
            {RESEARCH_QUESTIONS.map((question) => (
              <li key={question} className="flex gap-3">
                <span
                  className="mt-0.5 shrink-0 text-[var(--color-primary-light)]"
                  aria-hidden
                >
                  →
                </span>
                <p className="text-sm leading-relaxed text-[#6B7280] md:text-base">{question}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative order-1 aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[#E5E7EB] lg:order-2 lg:sticky lg:top-28 lg:aspect-auto lg:min-h-[32rem]">
          <Image
            src={MARKETING_IMAGES.heroPerson}
            alt={MARKETING_IMAGE_ALT.heroPerson}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </div>
    </MissionSection>
  )
}

export function MissionExperimentsSection() {
  return (
    <MissionSection id="experiments" variant="alt">
      <MissionEyebrow>EXPERIMENTS</MissionEyebrow>
      <MissionH2>
        Practical cases that test
        <br />
        human-centred automation.
      </MissionH2>
      <MissionBody className="mt-6 max-w-2xl">
        EquitAI advances through concrete experiments. Each case explores a redesign question — what
        to automate, what to augment, and where people stay in control.
      </MissionBody>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-light)]">
            Case 01 · Live experiment
          </p>
          <h3 className="mt-3 text-xl font-bold text-[#1A1A1A]">Inclusive Job Application AI</h3>
          <p className="mt-4 text-sm font-medium leading-relaxed text-[#1A1A1A] md:text-base">
            How can AI help people communicate skills and experience that don&apos;t fit conventional
            recruitment patterns?
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#6B7280]">
            This experiment grew from exploring barriers faced by migrant women and people with
            non-standard career paths. It investigates AI-supported job applications and skills
            representation — keeping agency with the applicant rather than replacing their judgement.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#6B7280]">
            The live application tool is the working prototype for this case: tailor CVs and cover
            letters, track applications, and examine how AI can support — not overwrite — human
            storytelling.
          </p>
          <div className="mt-8">
            <Link
              href={TOOL_ENTRY_PATH}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-light)]"
            >
              Open Case 01 tool →
            </Link>
          </div>
        </article>

        <article className="flex flex-col rounded-2xl border border-dashed border-[#D1D5DB] bg-[#FBFBF9] p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
            Case 02 · Planned
          </p>
          <h3 className="mt-3 text-xl font-bold text-[#1A1A1A]">
            Human-Centred Workflow Automation
          </h3>
          <p className="mt-4 text-sm font-medium leading-relaxed text-[#1A1A1A] md:text-base">
            How can workplace workflows be redesigned with AI while keeping appropriate human
            judgement and oversight?
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#6B7280]">
            A future case for exploring how an existing workplace process could be redesigned with AI
            — without claiming production systems or completed outcomes.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[#6B7280]">
            {[
              "Current workflow & friction",
              "Automation vs augmentation decisions",
              "Human-in-the-loop points & AI agents",
              "Guardrails, risks and oversight",
              "Accessibility and inclusion checks",
              "Prototype, evaluation and measurable impact",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[var(--color-primary-light)]" aria-hidden>
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
            Structure ready · work not yet published
          </p>
        </article>
      </div>
    </MissionSection>
  )
}

/** @deprecated Prefer MissionExperimentsSection — kept for temporary imports during migration. */
export function MissionFosterSection() {
  return <MissionExperimentsSection />
}

export function MissionProcessSection() {
  return (
    <MissionSection id="how-it-works" variant="white">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E5E7EB] lg:aspect-auto lg:min-h-[28rem]">
          <Image
            src={MARKETING_IMAGES.equity}
            alt={MARKETING_IMAGE_ALT.equity}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        <div>
          <MissionEyebrow>ORIGINS</MissionEyebrow>
          <MissionH2>
            From recruitment barriers
            <br />
            to broader workflow design.
          </MissionH2>
          <MissionBody className="mt-6">
            EquitAI began by examining how conventional recruitment systems under-represent skills and
            career paths that do not fit a standard template — including barriers faced by migrant and
            refugee women.
          </MissionBody>
          <MissionBody className="mt-4">
            That work continues as Case 01. The initiative now expands the same human-centred question
            to workplace automation more broadly: how to redesign processes with AI while keeping
            people, judgement and opportunity at the centre.
          </MissionBody>
        </div>
      </div>
    </MissionSection>
  )
}

export function MissionTrustSection() {
  return (
    <MissionSection variant="alt">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <MissionEyebrow>OPEN BY DESIGN</MissionEyebrow>
          <MissionH2>
            Research and prototypes —
            <br />
            shared as we learn.
          </MissionH2>
          <MissionBody className="mt-6">
            EquitAI is an open initiative, not a commercial automation consultancy. We publish
            experiments, questions and design reasoning so others can examine, adapt and challenge the
            work.
          </MissionBody>
          <div className="mt-8 grid gap-4">
            {TRUST_CARDS.map((card) => (
              <MissionCard key={card.title}>
                <h3 className="text-base font-semibold text-[#1A1A1A]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{card.text}</p>
              </MissionCard>
            ))}
          </div>
        </div>
        <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] lg:ml-auto lg:aspect-auto lg:min-h-[28rem] lg:max-w-none">
          <Image
            src={MARKETING_IMAGES.trustShield}
            alt={MARKETING_IMAGE_ALT.trustShield}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 40vw"
          />
        </div>
      </div>
    </MissionSection>
  )
}

export function MissionContactSection() {
  return (
    <section id="contact" className="relative w-full overflow-hidden py-16 md:py-24">
      <Image
        src={MARKETING_IMAGES.cvTemplates}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[#1A1A1A]/85" aria-hidden />
      <MissionContainer className="relative z-10 text-center">
        <MissionEyebrow accent className="text-center">
          GET INVOLVED
        </MissionEyebrow>
        <h2 className="text-[1.75rem] font-bold leading-tight text-white md:text-[2.25rem]">
          Explore, critique, or collaborate.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-[1.05rem]">
          Whether you work on AI transformation, responsible AI, product design, or workflow change —
          we welcome conversation about experiments, methods and hard questions. Get in touch to
          collaborate or learn more.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <OpenToolButton size="large" />
          <GetInTouchButton
            size="large"
            variant="outline"
            className="border-white text-white hover:bg-white/10"
          />
        </div>
      </MissionContainer>
    </section>
  )
}
