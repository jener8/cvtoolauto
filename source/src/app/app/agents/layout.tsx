import type { ReactNode } from "react"

/**
 * AppShell locks the viewport (h-dvh + overflow-hidden) so the workspace can
 * scroll inside `.main-content`. Agents routes are outside that shell, so they
 * need their own scroll container here.
 */
export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      {children}
    </div>
  )
}
