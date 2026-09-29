"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
import { toast } from "@/components/ui/use-toast"
import {
  isValidLinkedInProfileUrl,
  loadUserProfile,
  normalizeLinkedInProfileUrl,
  patchUserProfile,
} from "@/lib/user-profile"
import { syncLinkedInProfile } from "@/lib/linkedin-profile"
import { Linkedin, Loader2 } from "lucide-react"

interface LinkedInProfileSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onContinueWithoutLinkedIn: () => void
}

export function LinkedInProfileSetupDialog({
  open,
  onOpenChange,
  onSaved,
  onContinueWithoutLinkedIn,
}: LinkedInProfileSetupDialogProps) {
  const [url, setUrl] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const profile = loadUserProfile()
    setUrl(profile?.linkedInProfileUrl ?? "")
  }, [open])

  const handleSave = async () => {
    const canonical = normalizeLinkedInProfileUrl(url)
    if (!canonical) {
      toast({
        title: "Check your LinkedIn URL",
        description:
          "Use a profile link like https://www.linkedin.com/in/your-name",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const existing = loadUserProfile()
      patchUserProfile({
        name: existing?.name ?? "",
        email: existing?.email ?? "",
        linkedInProfileUrl: canonical,
      })
      await syncLinkedInProfile({ force: true })
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            LinkedIn profile (optional)
          </DialogTitle>
          <DialogDescription>
            Optionally add your LinkedIn profile to automatically use your experience and education.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="linkedin-setup-url">LinkedIn profile URL</Label>
          <Input
            id="linkedin-setup-url"
            type="url"
            placeholder="https://www.linkedin.com/in/username"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="url"
          />
          {url.trim() && !isValidLinkedInProfileUrl(url) && (
            <p className="text-xs text-destructive">
              Enter a profile URL like https://www.linkedin.com/in/username
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button onClick={() => void handleSave()} disabled={saving || !url.trim()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save LinkedIn profile"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onContinueWithoutLinkedIn}
          >
            Continue without LinkedIn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
