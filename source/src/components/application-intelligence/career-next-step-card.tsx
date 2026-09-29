"use client"

import { Illustration } from "@/components/illustrations/illustration"
import type { CareerJourneyGuide, CareerRecommendationDirectAction } from "@/lib/career-journey-guide"
import type { WorkspaceNavId } from "@/lib/workspace-navigation"
import { Check, Sprout } from "lucide-react"
import "./career-next-step.css"

type CareerNextStepCardProps = {
  guide: CareerJourneyGuide
  onNavigate: (id: WorkspaceNavId, directAction?: CareerRecommendationDirectAction) => void
  variant?: "card" | "sidebar" | "strip"
}

export function CareerNextStepCard({
  guide,
  onNavigate,
  variant = "card",
}: CareerNextStepCardProps) {
  const handleRecommendationClick = () => {
    const { navId, directAction } = guide.recommendation
    onNavigate(navId, directAction)
  }

  if (variant === "strip") {
    const showDynamic = guide.achievements.some((a) => a.id === "story")
    return (
      <section
        className="career-next-step career-next-step--strip"
        aria-labelledby="where-to-start-heading"
      >
        <h2 id="where-to-start-heading" className="career-next-step__strip-heading">
          Where to start
        </h2>
        <div className="career-next-step__strip-body">
          <p className="career-next-step__strip-message">
            {showDynamic ? guide.recommendation.description : guide.foundationMessage}
          </p>
          <button
            type="button"
            className="career-next-step__cta career-next-step__cta--strip"
            onClick={handleRecommendationClick}
          >
            {showDynamic ? guide.recommendation.ctaLabel : "Start your story →"}
          </button>
        </div>
      </section>
    )
  }

  if (variant === "sidebar") {
    return (
      <div className="career-next-step career-next-step--sidebar">
        <p className="career-next-step__eyebrow">
          <Sprout className="h-3 w-3" aria-hidden />
          Your next step
        </p>
        <p className="career-next-step__encouragement">{guide.foundationMessage}</p>

        {guide.achievements.length > 0 ? (
          <ul className="career-next-step__achievements" aria-label="What you've achieved">
            {guide.achievements.slice(0, 4).map((item) => (
              <li key={item.id} className="career-next-step__achievement">
                <Check className="h-3 w-3 shrink-0" aria-hidden />
                <span>{item.shortLabel}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="career-next-step__recommendation">
          <p className="career-next-step__rec-label">Recommended next</p>
          <p className="career-next-step__rec-title">
            <span aria-hidden>{guide.recommendation.emoji}</span> {guide.recommendation.title}
          </p>
          <button
            type="button"
            className="career-next-step__cta"
            onClick={handleRecommendationClick}
          >
            {guide.recommendation.ctaLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="career-next-step career-next-step--card" aria-labelledby="career-next-step-heading">
      <div className="career-next-step__card-body">
        <p className="career-next-step__eyebrow">
          <Sprout className="h-3.5 w-3.5" aria-hidden />
          Your next step
        </p>
        <h2 id="career-next-step-heading" className="career-next-step__headline">
          {guide.foundationMessage}
        </h2>
        <p className="career-next-step__sub-encouragement">{guide.encouragement}</p>

        {guide.achievements.length > 0 ? (
          <div className="career-next-step__chips" aria-label="What you've achieved">
            {guide.achievements.map((item) => (
              <span key={item.id} className="career-next-step__chip career-next-step__chip--done">
                <Check className="h-3 w-3" aria-hidden />
                {item.shortLabel}
              </span>
            ))}
          </div>
        ) : null}

        <div className="career-next-step__recommendation career-next-step__recommendation--card">
          <p className="career-next-step__rec-label">Next recommendation</p>
          <p className="career-next-step__rec-title career-next-step__rec-title--large">
            <span aria-hidden>{guide.recommendation.emoji}</span> {guide.recommendation.title}
          </p>
          <p className="career-next-step__rec-desc">{guide.recommendation.description}</p>
          {guide.recommendation.estimatedTime ? (
            <p className="career-next-step__rec-time">
              Estimated time: {guide.recommendation.estimatedTime}
            </p>
          ) : null}
          <button
            type="button"
            className="career-next-step__cta career-next-step__cta--card"
            onClick={handleRecommendationClick}
          >
            {guide.recommendation.ctaLabel}
          </button>
        </div>

        {guide.impact ? <p className="career-next-step__impact career-next-step__impact--card">{guide.impact}</p> : null}

        {guide.opportunities.length > 0 ? (
          <div className="career-next-step__opportunities">
            <p className="career-next-step__opp-label">When you're ready</p>
            <div className="career-next-step__chips">
              {guide.opportunities.slice(0, 4).map((item) => (
                <span key={item.id} className="career-next-step__chip career-next-step__chip--future">
                  {item.shortLabel}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="career-next-step__card-visual" aria-hidden>
        <Illustration slot="home.nextStep" size="hero" />
      </div>
    </section>
  )
}
