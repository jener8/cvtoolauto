"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Trash2, Mail, Phone, Linkedin } from "lucide-react"
import type { JobApplication } from "@/lib/types"

interface ContactsProps {
  job: JobApplication
  onUpdate: (updates: Partial<JobApplication>) => void
  onBack: () => void
}

export function Contacts({ job, onUpdate, onBack }: ContactsProps) {
  const [contacts, setContacts] = useState(() => {
    if (Array.isArray(job.contacts)) {
      return job.contacts
    }
    return []
  })
  const [editedContacts, setEditedContacts] = useState<Set<string>>(new Set())

  const handleSave = () => {
    onUpdate({
      contacts,
    })
    setEditedContacts(new Set()) // Clear all edited flags after save
  }

  const handleSaveContact = (id: string) => {
    onUpdate({
      contacts,
    })
    setEditedContacts((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const addContact = () => {
    const newId = Date.now().toString()
    setContacts([
      ...contacts,
      {
        id: newId,
        name: "",
        role: "",
        email: "",
        phone: "",
        linkedIn: "",
        location: "",
        language: "",
        notes: "",
      },
    ])
    setEditedContacts((prev) => new Set(prev).add(newId))
  }

  const updateContact = (id: string, updates: Partial<(typeof contacts)[0]>) => {
    setContacts(contacts.map((contact) => (contact.id === id ? { ...contact, ...updates } : contact)))
    setEditedContacts((prev) => new Set(prev).add(id))
  }

  const deleteContact = (id: string) => {
    setContacts(contacts.filter((contact) => contact.id !== id))
    setEditedContacts((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
    onUpdate({
      contacts: contacts.filter((contact) => contact.id !== id),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={onBack} variant="ghost" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to Dashboard
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Contacts</h1>
              {contacts.length > 0 && (
                <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-semibold rounded-full bg-primary/10 text-primary">
                  {contacts.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-2">
              {job.company} - {job.jobTitle}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Contact List</h2>
              <p className="text-sm text-muted-foreground">
                Track names, roles, and contact information for people at {job.company}
              </p>
            </div>
            <Button onClick={addContact}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {contacts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground mb-4">No contacts added yet</p>
                <Button onClick={addContact} variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Your First Contact
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => {
                const isEdited = editedContacts.has(contact.id)
                const isNewContact = !contact.name && !contact.role && !contact.email

                return (
                  <Card key={contact.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{contact.name || "Unnamed Contact"}</CardTitle>
                          <CardDescription>{contact.role}</CardDescription>
                        </div>
                        <Button
                          onClick={() => deleteContact(contact.id)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`name-${contact.id}`}>Name</Label>
                          <Input
                            id={`name-${contact.id}`}
                            value={contact.name}
                            onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                            placeholder="e.g., Sarah Johnson"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`role-${contact.id}`}>Role/Title</Label>
                          <Input
                            id={`role-${contact.id}`}
                            value={contact.role}
                            onChange={(e) => updateContact(contact.id, { role: e.target.value })}
                            placeholder="e.g., Hiring Manager"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`email-${contact.id}`}>
                            <Mail className="h-4 w-4 inline mr-1" />
                            Email
                          </Label>
                          <Input
                            id={`email-${contact.id}`}
                            type="email"
                            value={contact.email}
                            onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                            placeholder="sarah.johnson@company.com"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`phone-${contact.id}`}>
                            <Phone className="h-4 w-4 inline mr-1" />
                            Phone
                          </Label>
                          <Input
                            id={`phone-${contact.id}`}
                            type="tel"
                            value={contact.phone}
                            onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                            placeholder="+49 123 456 7890"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`linkedin-${contact.id}`}>
                          <Linkedin className="h-4 w-4 inline mr-1" />
                          LinkedIn Profile
                        </Label>
                        <Input
                          id={`linkedin-${contact.id}`}
                          type="url"
                          value={contact.linkedIn}
                          onChange={(e) => updateContact(contact.id, { linkedIn: e.target.value })}
                          placeholder="https://www.linkedin.com/in/..."
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`location-${contact.id}`}>Location (optional)</Label>
                          <Input
                            id={`location-${contact.id}`}
                            value={contact.location || ""}
                            onChange={(e) => updateContact(contact.id, { location: e.target.value })}
                            placeholder="e.g., Berlin, Germany"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`language-${contact.id}`}>Language (optional)</Label>
                          <Input
                            id={`language-${contact.id}`}
                            value={contact.language || ""}
                            onChange={(e) => updateContact(contact.id, { language: e.target.value })}
                            placeholder="e.g., English, German"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`notes-${contact.id}`}>Notes</Label>
                        <Textarea
                          id={`notes-${contact.id}`}
                          value={contact.notes}
                          onChange={(e) => updateContact(contact.id, { notes: e.target.value })}
                          placeholder="Any additional information about this contact..."
                          rows={4}
                          className="resize-y"
                        />
                      </div>

                      {isEdited && (
                        <div className="flex justify-end pt-2">
                          <Button onClick={() => handleSaveContact(contact.id)} size="sm">
                            {isNewContact ? "Save Contact" : "Update Contact"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
