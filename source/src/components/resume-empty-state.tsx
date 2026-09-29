"use client"

import { useEffect } from "react"
import "./resume-empty-state.css"
import {
  Briefcase,
  Check,
  ClipboardList,
  Download,
  FileText,
  Files,
  History,
  Lightbulb,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react"

type ResumeEmptyStateProps = {
  onStart: () => void
  onOpenExisting: () => void
  onCreateApplication: () => void
}

export function ResumeEmptyState({
  onStart,
  onOpenExisting,
  onCreateApplication,
}: ResumeEmptyStateProps) {
  useEffect(() => {
    if (!onStart) console.warn("ResumeEmptyState: onStart prop is missing")
    if (!onOpenExisting) console.warn("ResumeEmptyState: onOpenExisting prop is missing")
    if (!onCreateApplication) console.warn("ResumeEmptyState: onCreateApplication prop is missing")
  }, [onStart, onOpenExisting, onCreateApplication])

  return (
    <div className="res-empty-page">
      <div className="res-empty-wrap">
        <div className="res-hero">
          <div className="res-hero-icon">
            <FileText aria-hidden="true" />
          </div>
          <h1 className="res-hero-title">Your German-style CV, tailored with confidence</h1>
          <p className="res-hero-sub">
            Paste your experience and a job description — AI helps you create a CV that speaks to
            German employers, built honestly from what you have actually done. You stay in control.
          </p>
        </div>

        <ol className="res-steps" aria-label="How it works">
          <li className="res-step">
            <div className="res-step-left">
              <div className="res-step-num" aria-hidden="true">
                1
              </div>
              <div className="res-step-line" aria-hidden="true" />
            </div>
            <div className="res-step-illus" style={{ background: "#E8F4F4" }}>
              <FileText style={{ color: "#3D7A7A" }} aria-hidden="true" />
            </div>
            <div className="res-step-body">
              <div className="res-step-title">Add your experience</div>
              <div className="res-step-desc">
                Give the tool your existing CV or work history — three ways to do it.
              </div>
              <div className="res-step-opts">
                <span className="res-opt">
                  <ClipboardList aria-hidden="true" /> Paste CV text
                </span>
                <span className="res-opt">
                  <Upload aria-hidden="true" /> Upload a PDF
                </span>
                <span className="res-opt">
                  <History aria-hidden="true" /> Use a previous CV
                </span>
              </div>
            </div>
          </li>

          <li className="res-step">
            <div className="res-step-left">
              <div className="res-step-num" aria-hidden="true">
                2
              </div>
              <div className="res-step-line" aria-hidden="true" />
            </div>
            <div className="res-step-illus" style={{ background: "#FEF3DC" }}>
              <Briefcase style={{ color: "#8A5A0A" }} aria-hidden="true" />
            </div>
            <div className="res-step-body">
              <div className="res-step-title">Paste the job description</div>
              <div className="res-step-desc">
                Copy the full job listing. The AI reads what the employer needs — keywords,
                priorities, skills — and matches your experience to it.
              </div>
              <div className="res-step-opts">
                <span className="res-opt res-opt-amber">
                  <Lightbulb aria-hidden="true" /> The more detail, the better the match
                </span>
              </div>
            </div>
          </li>

          <li className="res-step res-ai-step">
            <div className="res-ai-icon">
              <Sparkles aria-hidden="true" />
            </div>
            <div className="res-ai-body">
              <div className="res-ai-title">AI builds your tailored CV</div>
              <div className="res-ai-desc">
                In seconds — honest, keyword-matched, written clearly. Only uses what you gave it.
                Nothing invented.
              </div>
              <div className="res-ai-chips">
                <span className="res-ai-chip">
                  <Check aria-hidden="true" /> Matched to the job
                </span>
                <span className="res-ai-chip">
                  <Check aria-hidden="true" /> Honest — your words, improved
                </span>
                <span className="res-ai-chip">
                  <Check aria-hidden="true" /> Ready in under 30 seconds
                </span>
              </div>
            </div>
          </li>

          <li className="res-step">
            <div className="res-step-left">
              <div className="res-step-num" aria-hidden="true">
                3
              </div>
              <div className="res-step-line" aria-hidden="true" />
            </div>
            <div className="res-step-illus" style={{ background: "#EEEDFE" }}>
              <SlidersHorizontal style={{ color: "#534AB7" }} aria-hidden="true" />
            </div>
            <div className="res-step-body">
              <div className="res-step-title">Refine until it sounds like you</div>
              <div className="res-step-desc">
                Chat with the AI to redirect it, edit text directly, or adjust the tone. You are
                always in charge of the final version.
              </div>
              <div className="res-step-opts">
                <span className="res-opt res-opt-purple">
                  <MessageSquare aria-hidden="true" /> &quot;Make it more direct&quot;
                </span>
                <span className="res-opt res-opt-purple">
                  <Pencil aria-hidden="true" /> Edit inline
                </span>
                <span className="res-opt res-opt-purple">
                  <SlidersHorizontal aria-hidden="true" /> Tone controls
                </span>
              </div>
            </div>
          </li>

          <li className="res-step">
            <div className="res-step-left">
              <div className="res-step-num" aria-hidden="true">
                4
              </div>
            </div>
            <div className="res-step-illus" style={{ background: "#EAF3DE" }}>
              <Download style={{ color: "#3B6D11" }} aria-hidden="true" />
            </div>
            <div className="res-step-body">
              <div className="res-step-title">Export — ready for any HR system</div>
              <div className="res-step-desc">
                Three PDF styles, all ATS-optimised so they pass automated screening. Download as PDF
                or Word.
              </div>
              <div className="res-step-opts">
                <span className="res-opt res-opt-green">
                  <Check aria-hidden="true" /> ATS ready
                </span>
                <span className="res-opt res-opt-green">
                  <ShieldCheck aria-hidden="true" /> AI transparency included
                </span>
                <span className="res-opt res-opt-green">
                  <Files aria-hidden="true" /> Matched cover letter too
                </span>
              </div>
            </div>
          </li>
        </ol>

        <div className="res-ctas">
          <button type="button" className="res-cta-main" onClick={onStart}>
            <Plus aria-hidden="true" /> Start — create my tailored CV
          </button>
          <button type="button" className="res-cta-sec" onClick={onOpenExisting}>
            <Upload aria-hidden="true" /> I already have a CV here — open it
          </button>
        </div>

        <div className="res-divider">
          <div className="res-div-line" />
          <span className="res-div-txt">Applying for a specific job?</span>
          <div className="res-div-line" />
        </div>

        <div className="res-apply-banner">
          <div className="res-apply-icon">
            <Briefcase aria-hidden="true" />
          </div>
          <div className="res-apply-body">
            <div className="res-apply-title">Create a full application</div>
            <div className="res-apply-desc">
              Track the role, attach your tailored CV, generate a cover letter — all in one place.
            </div>
          </div>
          <button type="button" className="res-apply-btn" onClick={onCreateApplication}>
            <Plus aria-hidden="true" /> New application
          </button>
        </div>

        <p className="res-privacy">
          <Lock aria-hidden="true" />
          Your information is private and only visible to you
        </p>
      </div>
    </div>
  )
}
