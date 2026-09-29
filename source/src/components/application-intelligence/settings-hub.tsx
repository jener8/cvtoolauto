"use client"

import { TrustComplianceSection, SettingsTrustCard } from "@/components/trust-compliance-section"
import { WorkspaceProfilePanel } from "@/components/workspace-profile-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PRODUCT_NAME } from "@/lib/brand"
import type { FolderContactInfo } from "@/lib/types"
import { Settings } from "lucide-react"

export type SettingsHubProps = {
  userName?: string
  userEmail?: string
  folderName?: string
  folderProfileImage?: string | null
  folderContactInfo?: Partial<FolderContactInfo>
  onUpdateFolder?: (updates: {
    name?: string
    profileImage?: string | null
    contactInfo?: Partial<FolderContactInfo>
  }) => void | Promise<void>
  onSaveProfile?: (name: string, email: string, password: string) => void
  onBackToFolders?: () => void
  onDataDeleted?: () => void
  onOpenProgramme?: () => void
  folderId?: string | null
}

export function SettingsHub({
  userName = "",
  userEmail = "",
  folderName,
  folderProfileImage = null,
  folderContactInfo,
  onUpdateFolder,
  onSaveProfile: _onSaveProfile,
  onBackToFolders,
  onDataDeleted,
  onOpenProgramme,
  folderId,
}: SettingsHubProps) {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="h-7 w-7" aria-hidden />
          My profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your photo, personal details, and contact information for {PRODUCT_NAME}.
          {(userName || userEmail) && (
            <>
              {" "}
              Signed in as {userName || userEmail}
              {userName && userEmail ? ` (${userEmail})` : ""}.
            </>
          )}
        </p>
      </header>

      <div className="space-y-6 p-6 lg:max-w-3xl lg:p-8">
        <SettingsTrustCard onDataDeleted={onDataDeleted} folderId={folderId} />

        <WorkspaceProfilePanel
          folderName={folderName}
          profileImage={folderProfileImage}
          contactInfo={folderContactInfo}
          onSave={onUpdateFolder}
        />

        {onOpenProgramme && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Programme &amp; partnerships</CardTitle>
              <CardDescription>For NGOs, foundations, and employment programmes</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={onOpenProgramme}>
                About the programme
              </Button>
            </CardContent>
          </Card>
        )}

        {onBackToFolders && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Workspaces</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={onBackToFolders}>
                Switch workspace / folder
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
