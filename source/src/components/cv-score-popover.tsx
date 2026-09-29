"use client"

import type { CvReviewInsights } from "@/lib/cv-review-insights"
import { cn } from "@/lib/utils"

export function CvScorePopoverContent({ insights }: { insights: CvReviewInsights }) {
  const { score, factors, suggestions } = insights

  return (
    <div className="formatter-score-explainer">
      <div className="formatter-score-explainer__hero">
        <span className="formatter-score-explainer__badge" aria-hidden>
          {score}
        </span>
        <div>
          <p className="formatter-score-explainer__title">CV readiness score</p>
          <p className="formatter-score-explainer__subtitle">
            Based on structure, content, and how well your resume is set up for applications.
            Scores are capped at 96.
          </p>
        </div>
      </div>

      {factors.length > 0 ? (
        <div className="formatter-score-explainer__factors">
          <p className="formatter-popover-eyebrow">How it&apos;s calculated</p>
          <ul className="formatter-score-factor-list">
            {factors.map((factor) => (
              <li key={factor.label} className="formatter-score-factor">
                <div className="formatter-score-factor__head">
                  <span className="formatter-score-factor__label">{factor.label}</span>
                  <span
                    className={cn(
                      "formatter-score-factor__points",
                      factor.points > 0 && "formatter-score-factor__points--earned",
                    )}
                  >
                    {factor.points}/{factor.maxPoints}
                  </span>
                </div>
                <p className="formatter-score-factor__detail">{factor.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="formatter-score-explainer__suggestions">
          <p className="formatter-popover-eyebrow">Suggestions</p>
          <ul className="formatter-score-suggestion-list">
            {suggestions.map((item) => (
              <li
                key={item.text}
                className={cn(
                  "formatter-score-suggestion",
                  item.tone === "positive"
                    ? "formatter-score-suggestion--positive"
                    : "formatter-score-suggestion--warning",
                )}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
