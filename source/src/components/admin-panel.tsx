"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, KeyRound, Shield, Trash2 } from "lucide-react"
import type { PublicAccount } from "@/lib/cv-auth-types"
import { getCvUser, isCvAdmin } from "@/lib/cv-auth"

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

function statusLabel(role: PublicAccount["role"]): string {
  if (role === "admin") return "Admin"
  if (role === "demo") return "Demo"
  return "Active"
}

function statusClass(role: PublicAccount["role"]): string {
  if (role === "admin") return "account-status admin"
  if (role === "demo") return "account-status demo"
  return "account-status active"
}

export function AdminPanel() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<PublicAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newFirst, setNewFirst] = useState("")
  const [newSurname, setNewSurname] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [showPreviewPassword, setShowPreviewPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadAccounts = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/accounts", { cache: "no-store" })
      if (res.status === 403) {
        router.replace("/login")
        return
      }
      if (!res.ok) {
        setError("Could not load accounts.")
        return
      }
      const data = (await res.json()) as { accounts: PublicAccount[] }
      setAccounts(data.accounts)
    } catch {
      setError("Could not load accounts.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const user = getCvUser()
    if (!user || !isCvAdmin()) {
      router.replace("/login")
      return
    }
    void loadAccounts()
  }, [loadAccounts, router])

  async function handleCreate() {
    if (!newFirst.trim() || !newSurname.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newFirst.trim(),
          password: newSurname.trim(),
          surname: newSurname.trim(),
          email: newEmail.trim() || undefined,
          role: "user",
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not create account.")
        return
      }
      setNewFirst("")
      setNewSurname("")
      setNewEmail("")
      setShowPreviewPassword(false)
      await loadAccounts()
    } catch {
      setError("Could not create account.")
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(username: string) {
    if (username.toLowerCase() === "jennifer") return
    if (!window.confirm(`Delete account for ${username}?`)) return
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/accounts?username=${encodeURIComponent(username)}`,
        { method: "DELETE" },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not delete account.")
        return
      }
      await loadAccounts()
    } catch {
      setError("Could not delete account.")
    }
  }

  async function handleResetPassword(account: PublicAccount) {
    if (account.username.toLowerCase() === "jennifer") return

    const confirmed = window.confirm(
      `Reset password for ${account.username} and send them an email?`,
    )
    if (!confirmed) return

    setError(null)
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account.username, action: "reset_password" }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not reset password.")
        return
      }
      await loadAccounts()

      if (account.email) {
        const subject = encodeURIComponent("Your cv-by-design password has been reset")
        const body = encodeURIComponent(
          `Hi ${account.username},\n\nYour cv-by-design password has been reset.\n\nPlease contact Jennifer directly to receive your new password.\n\nJennifer`,
        )
        window.location.href = `mailto:${account.email}?subject=${subject}&body=${body}`
      } else {
        window.alert(
          `Password for ${account.username} has been reset. Contact them directly to share their new password.`,
        )
      }
    } catch {
      setError("Could not reset password.")
    }
  }

  const previewPassword = newSurname.trim()
    ? showPreviewPassword
      ? newSurname
      : "••••••••"
    : "••••••••"

  return (
    <div className="admin-wrap">
      <header className="admin-topbar">
        <div className="admin-topbar-title">
          <Shield className="h-4 w-4" aria-hidden />
          Admin panel
        </div>
        <span className="admin-badge">Jennifer only</span>
      </header>

      <main className="admin-main">
        {error ? (
          <p className="admin-error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="admin-card" aria-labelledby="create-account-heading">
          <h2 id="create-account-heading" className="admin-card-title">
            Create account
          </h2>
          <p className="admin-card-sub">
            Username is the first name. Password is the surname (case-sensitive).
          </p>

          <div className="admin-form-grid">
            <div className="field">
              <label className="field-label" htmlFor="admin-first-name">
                First name
              </label>
              <input
                id="admin-first-name"
                className="field-input"
                type="text"
                value={newFirst}
                onChange={(e) => setNewFirst(e.target.value)}
                placeholder="First name"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="admin-surname">
                Surname (password)
              </label>
              <input
                id="admin-surname"
                className="field-input"
                type="password"
                value={newSurname}
                onChange={(e) => setNewSurname(e.target.value)}
                placeholder="Surname"
                autoComplete="new-password"
              />
            </div>
            <div className="field admin-form-full">
              <label className="field-label" htmlFor="admin-email">
                Email (optional)
              </label>
              <input
                id="admin-email"
                className="field-input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="admin-credentials-preview">
            <span>
              Username: <strong>{newFirst.trim() || "—"}</strong>
            </span>
            <span className="admin-credentials-sep">·</span>
            <span>
              Password: <strong>{previewPassword}</strong>
            </span>
            <button
              type="button"
              className="admin-eye-btn"
              onClick={() => setShowPreviewPassword((v) => !v)}
              aria-label={showPreviewPassword ? "Hide password preview" : "Show password preview"}
            >
              {showPreviewPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          <button
            type="button"
            className="admin-create-btn"
            onClick={() => void handleCreate()}
            disabled={creating || !newFirst.trim() || !newSurname.trim()}
          >
            {creating ? "Creating…" : "Create account"}
          </button>
        </section>

        <section className="admin-card" aria-labelledby="accounts-heading">
          <h2 id="accounts-heading" className="admin-card-title">
            Existing accounts
          </h2>
          {loading ? (
            <p className="admin-card-sub">Loading accounts…</p>
          ) : (
            <ul className="admin-account-list">
              {accounts.map((account) => (
                <li key={account.username} className="admin-account-row">
                  <div className="admin-account-avatar" aria-hidden>
                    {initials(account.username)}
                  </div>
                  <div className="admin-account-meta">
                    <div className="admin-account-name">{account.username}</div>
                    <div className="admin-account-date">
                      {account.created ? `Created ${account.created}` : "—"}
                      {account.email ? ` · ${account.email}` : ""}
                    </div>
                  </div>
                  <span className={statusClass(account.role)}>{statusLabel(account.role)}</span>
                  <div className="admin-account-actions">
                    {account.username.toLowerCase() !== "jennifer" ? (
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => void handleResetPassword(account)}
                        aria-label={`Reset password for ${account.username}`}
                        title={`Reset password for ${account.username}`}
                      >
                        <KeyRound className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    {account.username.toLowerCase() !== "jennifer" ? (
                      <button
                        type="button"
                        className="admin-icon-btn admin-icon-btn--danger"
                        onClick={() => void handleDelete(account.username)}
                        aria-label={`Delete ${account.username}`}
                        title="Delete account"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
