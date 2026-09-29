"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserSupportContact } from "@/lib/support-organizations/types"

export type UserSupportContactFormValues = {
  name: string
  type: string
  description: string
  contactInfo: string
  externalUrl: string
}

type UserSupportContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialContact?: UserSupportContact | null
  onSave: (values: UserSupportContactFormValues) => void
}

const EMPTY_FORM: UserSupportContactFormValues = {
  name: "",
  type: "",
  description: "",
  contactInfo: "",
  externalUrl: "",
}

export function UserSupportContactDialog({
  open,
  onOpenChange,
  initialContact,
  onSave,
}: UserSupportContactDialogProps) {
  const [form, setForm] = useState<UserSupportContactFormValues>(EMPTY_FORM)
  const isEditing = Boolean(initialContact)

  useEffect(() => {
    if (!open) return
    if (initialContact) {
      setForm({
        name: initialContact.name,
        type: initialContact.type,
        description: initialContact.description,
        contactInfo: initialContact.contactInfo,
        externalUrl: initialContact.externalUrl ?? "",
      })
      return
    }
    setForm(EMPTY_FORM)
  }, [open, initialContact])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.contactInfo.trim()) return
    onSave({
      ...form,
      name: form.name.trim(),
      type: form.type.trim(),
      description: form.description.trim(),
      contactInfo: form.contactInfo.trim(),
      externalUrl: form.externalUrl.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit your contact" : "Add your own contact"}</DialogTitle>
          <DialogDescription>
            Saved only on this device for your workspace — private to you.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="user-contact-name">Name</Label>
            <Input
              id="user-contact-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Organisation or person"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-contact-type">Type</Label>
            <Input
              id="user-contact-type"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              placeholder="e.g. Mentoring, Language exchange, Prayer group"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-contact-description">Description</Label>
            <textarea
              id="user-contact-description"
              className="border-input min-h-[4.5rem] w-full rounded-[var(--ds-radius-md)] border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-[var(--color-focus)] focus-visible:ring-[color-mix(in_srgb,var(--color-focus)_22%,transparent)] focus-visible:ring-[3px]"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What they do or how you know them"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-contact-info">Contact info</Label>
            <Input
              id="user-contact-info"
              value={form.contactInfo}
              onChange={(e) => setForm((prev) => ({ ...prev, contactInfo: e.target.value }))}
              placeholder="Email, phone, or a note like “ask for Maria”"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-contact-link">Link (optional)</Label>
            <Input
              id="user-contact-link"
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, externalUrl: e.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-full">
              {isEditing ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
