"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, LogOut, Shield } from "lucide-react"
import { clearCvUser, getCvUser } from "@/lib/cv-auth"
import { CV_WORKSPACE_SLUG_KEY } from "@/lib/cv-workspace-routing"

export function UserMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const user = getCvUser()
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "?"

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  async function handleSignOut() {
    clearCvUser()
    sessionStorage.removeItem(CV_WORKSPACE_SLUG_KEY)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* proceed to login */
    }
    setOpen(false)
    router.replace("/login")
  }

  if (!user?.username) return null

  return (
    <div className="user-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="avatar-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`User menu — ${user.username}`}
      >
        <span className="avatar-initials">{initials}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" aria-hidden />
      </button>

      {open ? (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-header">
            <div className="user-dropdown-name">{user.username}</div>
            <div className="user-dropdown-role">{user.role}</div>
          </div>

          {user.role === "admin" ? (
            <Link
              className="user-dropdown-item"
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Shield className="h-4 w-4 shrink-0" aria-hidden />
              Admin panel
            </Link>
          ) : null}

          <button
            type="button"
            className="user-dropdown-item signout"
            role="menuitem"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
