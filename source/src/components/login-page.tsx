"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Info, KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react"
import { getCvUser, setCvUser, fetchCvUserFromSession } from "@/lib/cv-auth"
import { ensureSupabaseAuthSession } from "@/lib/supabase/app-auth"
import { openAppForUser } from "@/lib/cv-workspace-routing"

export function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)

  useEffect(() => {
    async function redirectIfAuthenticated() {
      const existing = getCvUser()
      if (existing) {
        setRedirecting(true)
        router.replace(openAppForUser(existing))
        return
      }
      try {
        const user = await fetchCvUserFromSession()
        if (user) {
          setCvUser(user)
          setRedirecting(true)
          router.replace(openAppForUser(user))
        }
      } catch {
        /* stay on login */
      }
    }
    void redirectIfAuthenticated()
  }, [router])

  async function handleLogin() {
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json()) as { user?: { username: string; role: string }; error?: string }
      if (!res.ok || !data.user) {
        setError(data.error ?? "Username or password incorrect. Please try again.")
        return
      }
      setCvUser({
        username: data.user.username,
        role: data.user.role as "admin" | "demo" | "user",
      })
      setRedirecting(true)
      await ensureSupabaseAuthSession()
      router.replace(
        openAppForUser({
          username: data.user.username,
          role: data.user.role as "admin" | "demo" | "user",
        }),
      )
    } catch {
      setError("Unable to sign in. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleForgotPassword() {
    const subject = encodeURIComponent("EquitAI password reset request")
    const body = encodeURIComponent(
      "Hi Jennifer,\n\nI've forgotten my password for EquitAI and would like it reset.\n\nMy username is: [your first name]\n\nThanks!",
    )
    window.location.href = `mailto:jennifer@simondsresearch.com?subject=${subject}&body=${body}`
    setShowForgotModal(false)
  }

  function handleRequestAccount() {
    const subject = encodeURIComponent("EquitAI account request")
    const body = encodeURIComponent(
      "Hi Jennifer,\n\nI'd like to request access to EquitAI.\n\nMy name is [your name].\n\nThanks!",
    )
    window.location.href = `mailto:jennifer@simondsresearch.com?subject=${subject}&body=${body}`
    setShowRequestModal(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleLogin()
  }

  if (redirecting) {
    return (
      <div className="login-wrap">
        <div className="login-card text-center">
          <p className="login-title">Opening your workspace…</p>
          <p className="login-sub">One moment while we load EquitAI.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-mark">cv</div>
            <span className="login-logo-text">EquitAI</span>
          </div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub">Sign in to access your workspace.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="field-input"
                type="text"
                placeholder="Your first name"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError("")
                }}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="field-input"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
              />
              <button
                type="button"
                className="forgot-link"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </button>
            </div>

            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="login-btn" type="submit" disabled={submitting}>
              <LogIn className="h-4 w-4" aria-hidden />
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="test-hint">
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>
              Try the demo: username <strong>Test</strong> with the demo password
            </span>
          </div>

          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">No account yet?</span>
            <div className="login-divider-line" />
          </div>

          <button
            type="button"
            className="request-btn"
            onClick={() => setShowRequestModal(true)}
          >
            <Mail className="h-4 w-4" aria-hidden />
            Request an account
          </button>

          <p className="privacy-notice">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden />
            <span>
              Your name is used only to give you access to this tool. No personal data is shared
              with third parties.{" "}
              <a href="mailto:jennifer@simondsresearch.com" className="privacy-link">
                Questions? Contact Jennifer.
              </a>
            </span>
          </p>
        </div>
      </div>

      {showForgotModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Forgot password"
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="modal-title">
              <KeyRound className="h-4 w-4" aria-hidden />
              Forgot your password?
            </div>
            <p className="modal-sub">
              Your password is personal to you — if you&apos;re stuck, send Jennifer a quick email
              and she&apos;ll reset it for you within 1–2 working days.
            </p>
            <button type="button" className="modal-btn" onClick={handleForgotPassword}>
              <Mail className="h-4 w-4" aria-hidden />
              Email Jennifer to reset
            </button>
            <button type="button" className="modal-cancel" onClick={() => setShowForgotModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showRequestModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Request an account"
          onClick={() => setShowRequestModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="modal-title">
              <Mail className="h-4 w-4" aria-hidden />
              Request an account
            </div>
            <p className="modal-sub">
              This opens your email app with a pre-filled message. Just hit send — I&apos;ll set up
              your account within 1–2 working days.
            </p>
            <div className="email-preview">
              <div className="email-row">
                <span className="email-field">To:</span>
                <span>jennifer@simondsresearch.com</span>
              </div>
              <div className="email-row">
                <span className="email-field">Re:</span>
                <span>EquitAI account request</span>
              </div>
              <div className="email-row email-row--body">
                Hi Jennifer, I&apos;d like to request access...
              </div>
            </div>
            <button type="button" className="modal-btn" onClick={handleRequestAccount}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open in email app
            </button>
            <button type="button" className="modal-cancel" onClick={() => setShowRequestModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
