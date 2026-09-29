"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Trash2, ExternalLink } from "lucide-react"
import type { JobApplication } from "@/lib/types"

interface CompanyInfoProps {
  jobApplication: JobApplication
  onUpdate: (updates: Partial<JobApplication>) => void
  onClose: () => void
}

export function CompanyInfo({ jobApplication, onUpdate, onClose }: CompanyInfoProps) {
  const [companyInfo, setCompanyInfo] = useState(jobApplication.companyInfo)

  useEffect(() => {
    setCompanyInfo(jobApplication.companyInfo)
  }, [jobApplication])

  const handleSave = () => {
    onUpdate({
      companyInfo: {
        ...companyInfo,
        lastModified: Date.now(),
      },
    })
  }

  useEffect(() => {
    const timer = setTimeout(handleSave, 1000)
    return () => clearTimeout(timer)
  }, [companyInfo])

  const addContact = () => {
    setCompanyInfo({
      ...companyInfo,
      linkedInContacts: [
        ...companyInfo.linkedInContacts,
        {
          id: Date.now().toString(),
          name: "",
          role: "",
          linkedInUrl: "",
          outreachNotes: "",
          contactDate: null,
        },
      ],
    })
  }

  const updateContact = (id: string, updates: Partial<(typeof companyInfo.linkedInContacts)[0]>) => {
    setCompanyInfo({
      ...companyInfo,
      linkedInContacts: companyInfo.linkedInContacts.map((contact) =>
        contact.id === id ? { ...contact, ...updates } : contact,
      ),
    })
  }

  const deleteContact = (id: string) => {
    setCompanyInfo({
      ...companyInfo,
      linkedInContacts: companyInfo.linkedInContacts.filter((contact) => contact.id !== id),
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Company Information: {jobApplication.company}</DialogTitle>
          <DialogDescription>Research the company and track LinkedIn outreach</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Company Overview</TabsTrigger>
            <TabsTrigger value="contacts">LinkedIn Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="website">Company Website</Label>
                <div className="flex gap-2">
                  <Input
                    id="website"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                    placeholder="https://company.com"
                    type="url"
                  />
                  {companyInfo.website && (
                    <Button variant="outline" size="icon" onClick={() => window.open(companyInfo.website, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="researchNotes">Company Research & Notes</Label>
                <Textarea
                  id="researchNotes"
                  value={companyInfo.researchNotes}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, researchNotes: e.target.value })}
                  placeholder="Key information about the company:
- Company mission and values
- Recent news or achievements
- Company culture
- Products/services
- Market position
- Why you want to work here"
                  rows={15}
                  className="resize-y min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Ask ChatGPT "Research {jobApplication.company} and provide key insights about their mission,
                  products, culture, and recent news"
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">LinkedIn Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Track connections and outreach at {jobApplication.company}
                </p>
              </div>
              <Button onClick={addContact} size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>

            <div className="space-y-4">
              {companyInfo.linkedInContacts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4">No LinkedIn contacts tracked yet</p>
                    <Button onClick={addContact} variant="outline" size="sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Your First Contact
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                companyInfo.linkedInContacts.map((contact) => (
                  <Card key={contact.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{contact.name || "Unnamed Contact"}</CardTitle>
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
                    <CardContent className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`name-${contact.id}`}>Name</Label>
                          <Input
                            id={`name-${contact.id}`}
                            value={contact.name}
                            onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                            placeholder="e.g., John Smith"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`role-${contact.id}`}>Role/Title</Label>
                          <Input
                            id={`role-${contact.id}`}
                            value={contact.role}
                            onChange={(e) => updateContact(contact.id, { role: e.target.value })}
                            placeholder="e.g., Engineering Manager"
                          />
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <Label htmlFor={`linkedin-${contact.id}`}>LinkedIn URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`linkedin-${contact.id}`}
                            value={contact.linkedInUrl}
                            onChange={(e) => updateContact(contact.id, { linkedInUrl: e.target.value })}
                            placeholder="https://linkedin.com/in/..."
                            type="url"
                          />
                          {contact.linkedInUrl && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(contact.linkedInUrl, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <Label htmlFor={`contact-date-${contact.id}`}>Contact Date</Label>
                        <Input
                          id={`contact-date-${contact.id}`}
                          type="date"
                          value={contact.contactDate ? new Date(contact.contactDate).toISOString().split("T")[0] : ""}
                          onChange={(e) =>
                            updateContact(contact.id, {
                              contactDate: e.target.value ? new Date(e.target.value).getTime() : null,
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label htmlFor={`notes-${contact.id}`}>Outreach Notes</Label>
                        <Textarea
                          id={`notes-${contact.id}`}
                          value={contact.outreachNotes}
                          onChange={(e) => updateContact(contact.id, { outreachNotes: e.target.value })}
                          placeholder="What did you write to them? What was their response?"
                          rows={4}
                          className="resize-y"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
