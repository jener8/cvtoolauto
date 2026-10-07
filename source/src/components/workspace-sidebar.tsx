"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { SIDEBAR_BRAND, firstNameFromUserName } from "@/lib/workspace-shell-copy"
import type { CareerJourneyGuide } from "@/lib/career-journey-guide"
import type { WorkspaceJourneyProgress } from "@/lib/workspace-journey-progress"
import {
  WORKSPACE_NAV_GROUPS,
  getVisibleWorkspaceNavItems,
  type WorkspaceNavId,
  type WorkspaceNavItem,
} from "@/lib/workspace-navigation"
import { signOutFromApp } from "@/lib/sign-out"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconLogout } from "@tabler/icons-react"
import { PanelLeft, PanelRight, Plus } from "lucide-react"

export type { WorkspaceNavId }

type WorkspaceSidebarProps = {
  /** Current folder / workspace display name */
  workspaceName?: string
  userName?: string
  profileImage?: string | null
  activeNav: WorkspaceNavId
  onNavigate?: (id: WorkspaceNavId) => void
  footerVariant: "new-application" | "back-to-dashboard"
  onNewApplication?: () => void
  onBackToDashboard?: () => void
  onLayoutChange?: () => void
  journeyProgress?: WorkspaceJourneyProgress
  careerJourneyGuide?: CareerJourneyGuide
  /** @deprecated Use workspaceName */
  appName?: string
}

export function WorkspaceSidebar({
  workspaceName,
  appName,
  userName,
  profileImage,
  activeNav,
  onNavigate,
  footerVariant,
  onBackToDashboard,
  onLayoutChange,
  journeyProgress: _journeyProgress,
  careerJourneyGuide: _careerJourneyGuide,
}: WorkspaceSidebarProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open)
    onLayoutChange?.()
  }

  const folderLabel = workspaceName ?? appName
  const displayName = userName?.trim() || folderLabel || ""
  const firstName = firstNameFromUserName(userName)
  const avatarInitials = (firstName !== "there" ? firstName.charAt(0) : displayName.charAt(0) || "E").toUpperCase()
  const showWorkspaceLabel =
    Boolean(folderLabel?.trim()) &&
    folderLabel?.trim().toLowerCase() !== displayName.trim().toLowerCase()

  const sidebarName = firstName !== "there" ? firstName : displayName

  const openProfile = () => onNavigate?.("settings")

  const handleLogOut = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await signOutFromApp()
      router.replace("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  const renderUserAvatar = (collapsed = false) => (
    <Avatar
      className={cn(
        "app-sidebar__avatar",
        collapsed && "app-sidebar__avatar--collapsed",
      )}
    >
      {profileImage ? <AvatarImage src={profileImage} alt="" /> : null}
      <AvatarFallback className="app-sidebar__avatar-fallback">
        {avatarInitials}
      </AvatarFallback>
    </Avatar>
  )

  const navItems = getVisibleWorkspaceNavItems()

  const handleNavClick = (item: WorkspaceNavItem) => {
    // Agents lives on its own route, not an in-app section view.
    if (item.id === "agents") {
      router.push("/app/agents")
      return
    }
    onNavigate?.(item.id)
  }

  const renderNavItem = (item: WorkspaceNavItem) => {
    const Icon = item.icon
    const isActive = activeNav === item.id
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item)}
        title={!sidebarOpen ? item.label : undefined}
        className={cn(
          "app-sidebar__nav-item",
          sidebarOpen ? "app-sidebar__nav-item--open" : "app-sidebar__nav-item--collapsed",
          isActive && sidebarOpen && "app-sidebar__nav-item--active-open",
          isActive && !sidebarOpen && "app-sidebar__nav-item--active-collapsed",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon
          className={cn(
            "app-sidebar__nav-icon shrink-0",
            isActive && "app-sidebar__nav-icon--active",
          )}
          size={18}
          stroke={1.75}
          aria-hidden
        />
        {sidebarOpen ? (
          <span className="app-sidebar__nav-text min-w-0 flex-1">
            <span className="app-sidebar__nav-label block truncate">{item.label}</span>
            {item.subtext ? (
              <span className="app-sidebar__nav-subtext block truncate">{item.subtext}</span>
            ) : null}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <aside
      className={cn("app-sidebar", sidebarOpen && "open")}
      aria-label="Workspace navigation"
    >
      <div className={cn("app-sidebar__logo", !sidebarOpen && "app-sidebar__logo--collapsed")}>
        {sidebarOpen ? (
          <>
            <div className="app-sidebar__brand">
              <p className="app-sidebar__app-name">{SIDEBAR_BRAND.name}</p>
              <p className="app-sidebar__tagline">{SIDEBAR_BRAND.tagline}</p>
            </div>
            {sidebarName ? (
              <button
                type="button"
                className={cn(
                  "app-sidebar__user",
                  onNavigate && "app-sidebar__user--clickable",
                  activeNav === "settings" && "app-sidebar__user--active",
                )}
                onClick={openProfile}
                title="Edit profile and contacts"
                aria-label="Open profile settings"
                aria-current={activeNav === "settings" ? "page" : undefined}
              >
                <div className="app-sidebar__user-row">
                  {renderUserAvatar()}
                  <div className="app-sidebar__user-text">
                    <span className="app-sidebar__user-name">{sidebarName}</span>
                    {showWorkspaceLabel ? (
                      <span className="app-sidebar__workspace-name">{folderLabel}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ) : null}
          </>
        ) : sidebarName ? (
          <button
            type="button"
            className={cn(
              "app-sidebar__avatar-button",
              onNavigate && "app-sidebar__user--clickable",
              activeNav === "settings" && "app-sidebar__user--active",
            )}
            onClick={openProfile}
            title="Edit profile and contacts"
            aria-label="Open profile settings"
          >
            {renderUserAvatar(true)}
          </button>
        ) : profileImage ? (
          <button
            type="button"
            className="app-sidebar__avatar-button app-sidebar__user--clickable"
            onClick={openProfile}
            title="Edit profile and contacts"
            aria-label="Open profile settings"
          >
            {renderUserAvatar(true)}
          </button>
        ) : (
          <span className="app-sidebar__monogram" aria-hidden>
            {avatarInitials}
          </span>
        )}
      </div>

      <nav className="app-sidebar__nav">
        {WORKSPACE_NAV_GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id} className="app-sidebar__nav-group">
              {items.map(renderNavItem)}
            </div>
          )
        })}
        <div className="app-sidebar__nav-group app-sidebar__nav-group--logout">
          <button
            type="button"
            onClick={handleLogOut}
            disabled={loggingOut}
            title={!sidebarOpen ? "Log out" : undefined}
            className={cn(
              "app-sidebar__nav-item app-sidebar__nav-item--logout",
              sidebarOpen ? "app-sidebar__nav-item--open" : "app-sidebar__nav-item--collapsed",
            )}
          >
            <IconLogout
              className="app-sidebar__nav-icon shrink-0"
              size={18}
              stroke={1.75}
              aria-hidden
            />
            {sidebarOpen ? (
              <span className="app-sidebar__nav-text min-w-0 flex-1">
                <span className="app-sidebar__nav-label block truncate">
                  {loggingOut ? "Logging out…" : "Log out"}
                </span>
              </span>
            ) : null}
          </button>
        </div>
      </nav>

      <div className="app-sidebar__footer">
        {footerVariant === "back-to-dashboard" && sidebarOpen ? (
          <button type="button" className="app-sidebar__back-link" onClick={onBackToDashboard}>
            Back to dashboard
          </button>
        ) : null}
        <button
          type="button"
          className="app-sidebar__toggle"
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={sidebarOpen}
          onClick={toggleSidebar}
        >
          {sidebarOpen ? (
            <PanelLeft className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <PanelRight className="h-[18px] w-[18px]" aria-hidden />
          )}
        </button>
      </div>
    </aside>
  )
}

export function WorkspaceShell({
  children,
  onLayoutChange,
  showNewApplicationFab = false,
  ...sidebarProps
}: WorkspaceSidebarProps & { children: ReactNode; showNewApplicationFab?: boolean }) {
  return (
    <div className="ui-workspace-shell app h-full min-h-0 w-full">
      <WorkspaceSidebar {...sidebarProps} onLayoutChange={onLayoutChange} />
      <div className="ui-workspace-main main">
        <div className="main-content">{children}</div>
        {showNewApplicationFab && sidebarProps.onNewApplication ? (
          <button
            type="button"
            className="fab-new-application"
            onClick={sidebarProps.onNewApplication}
            aria-label="Create new application"
          >
            <Plus className="fab-new-application__icon" aria-hidden="true" />
            <span>New application</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
