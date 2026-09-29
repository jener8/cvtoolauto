"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import {
  applyPortfolioSlotUpdate,
  MAX_PORTFOLIO_URLS,
  portfolioInputSlots,
  toFolderContactInfo,
} from "@/lib/contact-info"
import { loadStrategicProfile, patchStrategicProfile } from "@/lib/strategic-profile"
import type { FolderContactInfo } from "@/lib/types"
import { Trash2, Upload, User as UserIcon } from "lucide-react"

export type WorkspaceProfilePanelProps = {
  folderName?: string
  profileImage?: string | null
  contactInfo?: Partial<FolderContactInfo>
  onSave?: (updates: {
    name?: string
    profileImage?: string | null
    contactInfo?: Partial<FolderContactInfo>
  }) => void | Promise<void>
}

export function WorkspaceProfilePanel({
  folderName = "",
  profileImage = null,
  contactInfo,
  onSave,
}: WorkspaceProfilePanelProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [workspaceName, setWorkspaceName] = useState(folderName)
  const [avatar, setAvatar] = useState<string | null>(profileImage)
  const [contacts, setContacts] = useState<FolderContactInfo>(() =>
    toFolderContactInfo(contactInfo),
  )
  const [noticePeriod, setNoticePeriod] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWorkspaceName(folderName)
    setAvatar(profileImage ?? null)
    setContacts(toFolderContactInfo(contactInfo))
    setNoticePeriod(loadStrategicProfile().noticePeriod ?? "")
  }, [folderName, profileImage, contactInfo])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatar(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      patchStrategicProfile({ noticePeriod: noticePeriod.trim() || undefined })
      await onSave({
        name: workspaceName.trim() || undefined,
        profileImage: avatar,
        contactInfo: contacts,
      })
      toast({
        title: "Profile saved",
        description: "Your photo and contact details are updated for this workspace.",
      })
    } catch {
      toast({
        title: "Could not save profile",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Profile photo</CardTitle>
          <CardDescription>
            Shown in the sidebar and used as the default photo on new CVs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-[var(--brand-teal)]"
              onClick={() => imageInputRef.current?.click()}
              aria-label="Upload profile photo"
            >
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-9 w-9 text-muted-foreground" aria-hidden />
              )}
            </button>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" aria-hidden />
                Upload photo
              </Button>
              {avatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setAvatar(null)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Remove photo
                </Button>
              ) : null}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
          <CardDescription>Defaults for CV headers and application forms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              placeholder="e.g. Tech jobs 2026"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-full-name">Full name</Label>
              <Input
                id="profile-full-name"
                placeholder="Your full name"
                value={contacts.name}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-title">Professional title</Label>
              <Input
                id="profile-title"
                placeholder="e.g. Product Designer"
                value={contacts.professionalTitle}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, professionalTitle: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="profile-language">Default language</Label>
            <Select
              value={contacts.language}
              onValueChange={(value: "en" | "de") =>
                setContacts((prev) => ({ ...prev, language: value }))
              }
            >
              <SelectTrigger id="profile-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-notice-period">Notice period</Label>
            <Input
              id="profile-notice-period"
              placeholder="e.g. 3 months, available from 1 September 2026"
              value={noticePeriod}
              onChange={(event) => setNoticePeriod(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used when drafting availability answers in Upload Details.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
          <CardDescription>Pre-filled on resumes and cover letters you create.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                placeholder="your@email.com"
                value={contacts.email}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                placeholder="+49 123 456 789"
                value={contacts.phone}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-location">Location</Label>
              <Input
                id="profile-location"
                placeholder="City, Country"
                value={contacts.address}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, address: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-citizenship">Citizenship</Label>
              <Input
                id="profile-citizenship"
                placeholder="e.g. German"
                value={contacts.citizenship}
                onChange={(event) =>
                  setContacts((prev) => ({ ...prev, citizenship: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-linkedin">LinkedIn</Label>
            <Input
              id="profile-linkedin"
              placeholder="linkedin.com/in/yourprofile"
              value={contacts.linkedin}
              onChange={(event) =>
                setContacts((prev) => ({ ...prev, linkedin: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Portfolio / websites (up to {MAX_PORTFOLIO_URLS})</Label>
            {portfolioInputSlots(contacts.portfolios, contacts.portfolio).map((url, index) => (
              <Input
                key={`profile-portfolio-${index}`}
                id={index === 0 ? "profile-portfolio" : `profile-portfolio-${index + 1}`}
                placeholder={index === 0 ? "yourportfolio.com" : `Website ${index + 1}`}
                value={url}
                onChange={(event) =>
                  setContacts((prev) =>
                    applyPortfolioSlotUpdate(prev, index, event.target.value),
                  )
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {onSave ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
