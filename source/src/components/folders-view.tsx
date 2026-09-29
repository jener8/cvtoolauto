"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Folder, Plus, Trash2, Edit2, Check, X, Upload, User, Lock, LockOpen } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  applyPortfolioSlotUpdate,
  MAX_PORTFOLIO_URLS,
  portfolioInputSlots,
} from "@/lib/contact-info"
import type { Folder as FolderType, FolderContactInfo } from "@/lib/types"

interface FoldersViewProps {
  folders: FolderType[]
  isLoading?: boolean
  loadError?: string | null
  onRetryLoad?: () => void
  onSelectFolder: (folderId: string) => void
  onCreateFolder: (name: string, profileImage: string | null, contactInfo: Partial<FolderContactInfo>) => void
  onDeleteFolder: (folderId: string) => void
  onRenameFolder: (folderId: string, newName: string) => void
  unlockedFolderIds: string[]
  onUnlockFolder: (folderId: string, password: string) => Promise<boolean>
  onLockFolder: (folderId: string) => void
}

const defaultContactInfo: FolderContactInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  linkedin: "",
  citizenship: "",
  portfolio: "",
  portfolios: [],
  professionalTitle: "",
  language: "en",
}

export function FoldersView({
  folders,
  isLoading = false,
  loadError = null,
  onRetryLoad,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  unlockedFolderIds,
  onUnlockFolder,
  onLockFolder,
}: FoldersViewProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newProfileImage, setNewProfileImage] = useState<string | null>(null)
  const [newContactInfo, setNewContactInfo] = useState<FolderContactInfo>(defaultContactInfo)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [passwordPromptFolder, setPasswordPromptFolder] = useState<FolderType | null>(null)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isCheckingPassword, setIsCheckingPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newProfileImage, newContactInfo)
      setNewFolderName("")
      setNewProfileImage(null)
      setNewContactInfo(defaultContactInfo)
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    setIsCreating(false)
    setNewFolderName("")
    setNewProfileImage(null)
    setNewContactInfo(defaultContactInfo)
  }

  const handleRename = (folderId: string) => {
    if (editingName.trim()) {
      onRenameFolder(folderId, editingName.trim())
      setEditingId(null)
      setEditingName("")
    }
  }

  const startEditing = (folder: FolderType) => {
    setEditingId(folder.id)
    setEditingName(folder.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleFolderOpen = (folder: FolderType) => {
    if (editingId === folder.id) return
    if (unlockedFolderIds.includes(folder.id)) {
      onSelectFolder(folder.id)
      return
    }
    setPasswordPromptFolder(folder)
    setPasswordInput("")
    setPasswordError("")
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordPromptFolder) return
    setIsCheckingPassword(true)
    setPasswordError("")
    try {
      const isValid = await onUnlockFolder(passwordPromptFolder.id, passwordInput)
      if (isValid) {
        onSelectFolder(passwordPromptFolder.id)
        setPasswordPromptFolder(null)
        setPasswordInput("")
      } else {
        setPasswordError("That does not match yet. Please try again.")
      }
    } finally {
      setIsCheckingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Workspaces</h1>
          <p className="text-muted-foreground">Organize your job applications and resumes into separate folders</p>
        </div>

        {loadError && folders.length === 0 && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-destructive">{loadError}</p>
            {onRetryLoad && (
              <Button type="button" variant="outline" size="sm" onClick={onRetryLoad} disabled={isLoading}>
                Try again
              </Button>
            )}
          </div>
        )}

        {loadError && folders.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">{loadError}</p>
            {onRetryLoad && (
              <Button type="button" variant="outline" size="sm" onClick={onRetryLoad} disabled={isLoading}>
                Retry refresh
              </Button>
            )}
          </div>
        )}

        {isLoading && folders.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">Loading workspaces…</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => {
            const isUnlocked = unlockedFolderIds.includes(folder.id)
            return (
              <Card
                key={folder.id}
                className={`hover:shadow-lg transition-shadow cursor-pointer group ${!isUnlocked ? "border-muted-foreground/30" : ""}`}
                onClick={() => handleFolderOpen(folder)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="relative">
                      <Folder className="h-12 w-12 text-primary mb-4" />
                      {!isUnlocked && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 border">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(folder)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete folder "${folder.name}"? All contents will be lost.`)) {
                            onDeleteFolder(folder.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {editingId === folder.id ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(folder.id)
                          if (e.key === "Escape") cancelEditing()
                        }}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={() => handleRename(folder.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <CardTitle>{folder.name}</CardTitle>
                  )}
                </CardHeader>
                <CardContent>
                  <CardDescription className="flex items-center justify-between">
                    <span>Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                    <button
                      type="button"
                      className={`text-xs inline-flex items-center gap-1 ${isUnlocked ? "text-emerald-600 hover:underline" : "text-muted-foreground cursor-default"}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isUnlocked) {
                          onLockFolder(folder.id)
                        }
                      }}
                      disabled={!isUnlocked}
                      title={isUnlocked ? "Click to lock again" : "This workspace is locked"}
                    >
                      {isUnlocked ? (
                        <>
                          <LockOpen className="h-3 w-3 text-emerald-600" />
                          <span>Unlocked</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          <span>Locked</span>
                        </>
                      )}
                    </button>
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}

          <Card
            className="border-dashed hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => setIsCreating(true)}
          >
            <CardHeader className="h-full flex items-center justify-center">
              <Plus className="h-12 w-12 text-muted-foreground mb-2" />
              <CardTitle className="text-muted-foreground">Create New Folder</CardTitle>
            </CardHeader>
          </Card>

          {/* Create Folder Dialog */}
          <Dialog open={isCreating} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Set up your workspace with default contact information and profile photo. These will be used as defaults for all resumes in this folder.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Folder Name */}
                <div className="space-y-2">
                  <Label htmlFor="folder-name" className="text-sm font-semibold">Workspace Name *</Label>
                  <Input
                    id="folder-name"
                    placeholder="e.g., Tech Jobs 2026"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Profile Photo */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Profile Photo (Optional)</Label>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed cursor-pointer hover:border-primary transition-colors overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {newProfileImage ? (
                        <img src={newProfileImage || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                      {newProfileImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewProfileImage(null)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Square image, 400x400px+ recommended</p>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Contact Information</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name" className="text-xs">Full Name</Label>
                      <Input
                        id="contact-name"
                        placeholder="Your full name"
                        value={newContactInfo.name}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-title" className="text-xs">Professional Title</Label>
                      <Input
                        id="contact-title"
                        placeholder="e.g., Software Engineer"
                        value={newContactInfo.professionalTitle}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, professionalTitle: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-xs">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="your@email.com"
                        value={newContactInfo.email}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone" className="text-xs">Phone</Label>
                      <Input
                        id="contact-phone"
                        placeholder="+1 234 567 890"
                        value={newContactInfo.phone}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-address" className="text-xs">Location</Label>
                      <Input
                        id="contact-address"
                        placeholder="City, Country"
                        value={newContactInfo.address}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-citizenship" className="text-xs">Citizenship</Label>
                      <Input
                        id="contact-citizenship"
                        placeholder="e.g., German"
                        value={newContactInfo.citizenship}
                        onChange={(e) => setNewContactInfo({ ...newContactInfo, citizenship: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-linkedin" className="text-xs">LinkedIn Profile</Label>
                    <Input
                      id="contact-linkedin"
                      placeholder="linkedin.com/in/yourprofile"
                      value={newContactInfo.linkedin}
                      onChange={(e) => setNewContactInfo({ ...newContactInfo, linkedin: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Portfolio / websites (up to {MAX_PORTFOLIO_URLS})
                    </Label>
                    {portfolioInputSlots(
                      newContactInfo.portfolios,
                      newContactInfo.portfolio,
                    ).map((url, index) => (
                      <Input
                        key={`new-portfolio-${index}`}
                        id={index === 0 ? "contact-portfolio" : `contact-portfolio-${index + 1}`}
                        placeholder={
                          index === 0 ? "yourportfolio.com" : `Website ${index + 1}`
                        }
                        value={url}
                        onChange={(e) =>
                          setNewContactInfo(
                            applyPortfolioSlotUpdate(
                              newContactInfo,
                              index,
                              e.target.value,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-language" className="text-xs">Default Language</Label>
                    <Select
                      value={newContactInfo.language}
                      onValueChange={(value: "en" | "de") => setNewContactInfo({ ...newContactInfo, language: value })}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Language for contact info labels on resumes</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!newFolderName.trim()}>
                    <Check className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Folder Password Dialog */}
          <Dialog
            open={!!passwordPromptFolder}
            onOpenChange={(open) => {
              if (!open) {
                setPasswordPromptFolder(null)
                setPasswordInput("")
                setPasswordError("")
              }
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Unlock Workspace</DialogTitle>
                <DialogDescription>
                  Enter the person's last name to open this workspace.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="workspace-password">Password</Label>
                  <PasswordInput
                    id="workspace-password"
                    placeholder="Enter last name"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value)
                      setPasswordError("")
                    }}
                    autoFocus
                  />
                  {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPasswordPromptFolder(null)
                      setPasswordInput("")
                      setPasswordError("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCheckingPassword || !passwordInput.trim()}>
                    {isCheckingPassword ? "Checking..." : "Unlock"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        )}

      </div>
    </div>
  )
}
