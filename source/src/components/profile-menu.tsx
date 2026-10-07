"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AiHowItWorksDialog } from "@/components/ai-how-it-works-dialog"
import { PrivacyCentreDialog } from "@/components/privacy-centre-dialog"
import {
  AboutCvToolDialog,
  HowToUseToolDialog,
} from "@/components/profile-menu-help-dialogs"
import {
  CircleHelp,
  Database,
  Info,
  Linkedin,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Bot,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { isJobAgentEnabledClient } from "@/lib/agents/feature-flag"
import { getCvUser } from "@/lib/cv-auth"
import { signOutFromApp } from "@/lib/sign-out"
import { clearAllCvLocalStorage } from "@/lib/storage"
import {
  isValidLinkedInProfileUrl,
  loadUserProfile,
  normalizeLinkedInProfileUrl,
  patchUserProfile,
} from "@/lib/user-profile"

interface ProfileMenuProps {
  userName?: string
  userEmail?: string
  profileImage?: string | null
  onSaveProfile?: (name: string, email: string, password: string) => void
}

export function ProfileMenu({ userName, userEmail, profileImage, onSaveProfile }: ProfileMenuProps) {
  const router = useRouter()
  const cvUser = getCvUser()
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [name, setName] = useState(userName || "")
  const [email, setEmail] = useState(userEmail || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [linkedInUrl, setLinkedInUrl] = useState("")
  const [showClearLocalDialog, setShowClearLocalDialog] = useState(false)
  const [showHowToDialog, setShowHowToDialog] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showAiHowDialog, setShowAiHowDialog] = useState(false)
  const [showPrivacyCentre, setShowPrivacyCentre] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadLinkedInFields = () => {
    const profile = loadUserProfile()
    setLinkedInUrl(profile?.linkedInProfileUrl ?? "")
  }

  useEffect(() => {
    setName(userName || "")
    setEmail(userEmail || "")
  }, [userName, userEmail])

  const refreshFromStoredProfile = () => {
    const stored = loadUserProfile()
    if (stored?.name?.trim()) setName(stored.name)
    else if (userName) setName(userName)
    if (stored?.email?.trim()) setEmail(stored.email)
    else if (userEmail) setEmail(userEmail)
  }

  useEffect(() => {
    if (menuOpen) refreshFromStoredProfile()
  }, [menuOpen, userName, userEmail])

  const storedProfile = menuOpen && typeof window !== "undefined" ? loadUserProfile() : null
  const displayName = (userName || storedProfile?.name || name)?.trim() || ""
  const displayEmail = (userEmail || storedProfile?.email || email)?.trim() || ""
  const menuTitle = displayName
    ? displayName
    : displayEmail
      ? displayEmail
      : "Profile not completed"
  const menuSubtitle = displayName
    ? displayEmail || null
    : displayEmail
      ? null
      : "Add your details in Profile Settings"

  useEffect(() => {
    if (showProfileDialog) loadLinkedInFields()
  }, [showProfileDialog])

  const handleClearLocalStorage = () => {
    const { removedKeys, hadResumeSnapshots, hadDraft } = clearAllCvLocalStorage()
    setShowClearLocalDialog(false)
    const cleared =
      removedKeys.length > 0 || hadResumeSnapshots || hadDraft
    toast({
      title: "Local storage cleared",
      description: cleared
        ? `Removed ${removedKeys.length} cached item${removedKeys.length === 1 ? "" : "s"} (resumes, folders, jobs). Cloud saves are unchanged.`
        : "No EquitAI offline cache was stored in this browser.",
    })
  }

  const persistLinkedInUrl = (raw: string): boolean => {
    const trimmed = raw.trim()
    if (!trimmed) {
      patchUserProfile({ linkedInProfileUrl: "" })
      return true
    }
    const canonical = normalizeLinkedInProfileUrl(trimmed)
    if (!canonical) {
      toast({
        title: "Invalid LinkedIn URL",
        description: "Use a profile link like https://www.linkedin.com/in/your-name",
        variant: "destructive",
      })
      return false
    }
    const existing = loadUserProfile()
    patchUserProfile({
      name: existing?.name ?? name,
      email: existing?.email ?? email,
      linkedInProfileUrl: canonical,
    })
    return true
  }

  const handleSave = () => {
    if (!onSaveProfile) return
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      })
      return
    }

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email",
        variant: "destructive",
      })
      return
    }

    if (password && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      })
      return
    }

    if (linkedInUrl.trim() && !isValidLinkedInProfileUrl(linkedInUrl)) {
      toast({
        title: "Invalid LinkedIn URL",
        description: "Use a profile link like https://www.linkedin.com/in/your-name",
        variant: "destructive",
      })
      return
    }

    if (linkedInUrl.trim()) {
      persistLinkedInUrl(linkedInUrl)
    } else {
      persistLinkedInUrl("")
    }

    onSaveProfile(name, email, password)
    setShowProfileDialog(false)
    setPassword("")
    setConfirmPassword("")

    toast({
      title: "Profile saved",
      description: "Your profile has been updated successfully",
    })
  }

  const getInitial = () => {
    const source = displayName || userName || cvUser?.username
    if (source?.trim()) {
      return source.trim().charAt(0).toUpperCase()
    }
    return "?"
  }

  async function handleSignOut() {
    await signOutFromApp()
    setMenuOpen(false)
    router.replace("/login")
  }

  if (!onSaveProfile && !cvUser?.username) return null

  const showAccountRole =
    cvUser?.username &&
    cvUser.username.trim().toLowerCase() !== displayName.trim().toLowerCase()

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 shrink-0 rounded-full p-0 overflow-hidden"
            aria-label="Open profile menu"
          >
            <Avatar className="h-10 w-10">
              {profileImage ? (
                <AvatarImage src={profileImage} alt="Profile" />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitial()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none truncate">{menuTitle}</p>
              {menuSubtitle && (
                <p className="text-xs leading-none text-muted-foreground truncate">{menuSubtitle}</p>
              )}
              {showAccountRole ? (
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {cvUser?.username}
                  {cvUser?.role ? ` · ${cvUser.role}` : ""}
                </p>
              ) : cvUser?.role ? (
                <p className="text-xs leading-none text-muted-foreground truncate">{cvUser.role}</p>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {onSaveProfile ? (
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false)
                setShowProfileDialog(true)
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
          ) : null}
          {onSaveProfile ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false)
              setShowHowToDialog(true)
            }}
          >
            <CircleHelp className="mr-2 h-4 w-4" />
            <span>How to use this tool</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false)
              setShowAboutDialog(true)
            }}
          >
            <Info className="mr-2 h-4 w-4" />
            <span>About EquitAI</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false)
              setShowAiHowDialog(true)
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>How AI is used</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false)
              setShowPrivacyCentre(true)
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>Privacy Centre</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/app/data-integrity" className="flex items-center" onClick={() => setMenuOpen(false)}>
              <Database className="mr-2 h-4 w-4" />
              <span>Data Integrity</span>
            </Link>
          </DropdownMenuItem>
          {isJobAgentEnabledClient() ? (
            <DropdownMenuItem asChild>
              <Link href="/app/agents" className="flex items-center" onClick={() => setMenuOpen(false)}>
                <Bot className="mr-2 h-4 w-4" />
                <span>Job agents</span>
              </Link>
            </DropdownMenuItem>
          ) : null}
          {cvUser?.role === "admin" ? (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center" onClick={() => setMenuOpen(false)}>
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin panel</span>
              </Link>
            </DropdownMenuItem>
          ) : null}
          {cvUser?.username ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => void handleSignOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {onSaveProfile ? (
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>
              Set your name and password. Optional links are stored for your reference only.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password {password ? "(Change)" : "(Set)"}</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {password && (
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                <p className="text-sm font-medium">LinkedIn profile URL (optional)</p>
              </div>
              <Input
                id="linkedin-profile-url"
                type="url"
                placeholder="https://www.linkedin.com/in/username"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Saved for your reference. LinkedIn profiles cannot be imported automatically — paste
                profile text or upload a CV when creating applications.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <p className="text-sm font-medium">Browser storage</p>
            <p className="text-xs text-muted-foreground">
              Clears offline drafts, resume snapshots, folder cache, and job data from this device. Cloud saves are not
              affected.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowClearLocalDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Saved Versions
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      <HowToUseToolDialog open={showHowToDialog} onOpenChange={setShowHowToDialog} />
      <AboutCvToolDialog open={showAboutDialog} onOpenChange={setShowAboutDialog} />
      <AiHowItWorksDialog open={showAiHowDialog} onOpenChange={setShowAiHowDialog} />
      <PrivacyCentreDialog
        open={showPrivacyCentre}
        onOpenChange={setShowPrivacyCentre}
        onOpenAiHowItWorks={() => {
          setShowPrivacyCentre(false)
          setShowAiHowDialog(true)
        }}
      />

      {onSaveProfile ? (
      <Dialog open={showClearLocalDialog} onOpenChange={setShowClearLocalDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Clear local storage?</DialogTitle>
            <DialogDescription>
              This removes all EquitAI offline data in your browser (drafts, snapshots, folder cache, jobs). Cloud
              saves are not deleted. You may lose unsaved local edits.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearLocalDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearLocalStorage}>
              Clear Saved Versions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </>
  )
}
