"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  analyzeCoverLetterLinks,
  applyCoverLetterLinks,
  type CoverLetterLinkProposal,
} from "@/lib/data-integrity/cover-letter-links"
import {
  buildIntegrityReport,
  type BrokenResumeLinkRow,
  type IntegritySummary,
} from "@/lib/data-integrity/report"
import {
  downloadRecoveryLog,
  restoreResumeVersionsFromLocalStorage,
  type ResumeRecoveryResult,
} from "@/lib/data-integrity/recovery"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { AlertTriangle, ArrowLeft, Database, Download, RefreshCw } from "lucide-react"

export function DataIntegrityPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<IntegritySummary | null>(null)
  const [coverAnalysis, setCoverAnalysis] = useState<
    Awaited<ReturnType<typeof analyzeCoverLetterLinks>> | null
  >(null)
  const [selectedResumeIds, setSelectedResumeIds] = useState<Set<string>>(new Set())
  const [selectedCoverProposals, setSelectedCoverProposals] = useState<Set<string>>(new Set())
  const [recovering, setRecovering] = useState(false)
  const [linking, setLinking] = useState(false)
  const [lastRecoveryLog, setLastRecoveryLog] = useState<ResumeRecoveryResult[]>([])
  const [confirmRecover, setConfirmRecover] = useState(false)
  const [confirmLink, setConfirmLink] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSummary, nextCover] = await Promise.all([
        buildIntegrityReport(),
        analyzeCoverLetterLinks(),
      ])
      setSummary(nextSummary)
      setCoverAnalysis(nextCover)
      const recoverable = new Set(
        [...nextSummary.orphanResumeLinks, ...nextSummary.emptyResumeTextLinks]
          .filter((row) => row.localSnapshotFound)
          .map((row) => row.missingResumeId),
      )
      setSelectedResumeIds(recoverable)
      setSelectedCoverProposals(
        new Set(
          nextCover.proposals
            .filter((p) => p.confidence === "high")
            .map((p) => `${p.applicationId}:${p.proposedCoverLetterId}`),
        ),
      )
    } catch (error) {
      toast({
        title: "Could not load integrity report",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const recoverableRows = useMemo(
    () =>
      [...(summary?.orphanResumeLinks ?? []), ...(summary?.emptyResumeTextLinks ?? [])].filter(
        (row) => row.localSnapshotFound,
      ),
    [summary],
  )

  const uniqueRecoverableIds = useMemo(
    () => [...new Set(recoverableRows.map((row) => row.missingResumeId))],
    [recoverableRows],
  )

  const selectedRecoverableIds = useMemo(
    () => uniqueRecoverableIds.filter((id) => selectedResumeIds.has(id)),
    [uniqueRecoverableIds, selectedResumeIds],
  )

  const selectedCoverItems = useMemo(() => {
    if (!coverAnalysis) return []
    return coverAnalysis.proposals.filter((p) =>
      selectedCoverProposals.has(`${p.applicationId}:${p.proposedCoverLetterId}`),
    )
  }, [coverAnalysis, selectedCoverProposals])

  const toggleResumeId = (id: string, checked: boolean) => {
    setSelectedResumeIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleCoverProposal = (proposal: CoverLetterLinkProposal, checked: boolean) => {
    const key = `${proposal.applicationId}:${proposal.proposedCoverLetterId}`
    setSelectedCoverProposals((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const runRecovery = async () => {
    setRecovering(true)
    try {
      const results = await restoreResumeVersionsFromLocalStorage(selectedRecoverableIds)
      setLastRecoveryLog(results)
      downloadRecoveryLog(results)
      const ok = results.filter((r) => r.success).length
      toast({
        title: "Resume recovery finished",
        description: `${ok} of ${results.length} resume(s) synced to Supabase. Recovery log downloaded.`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Recovery failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRecovering(false)
      setConfirmRecover(false)
    }
  }

  const runCoverLinkMigration = async () => {
    setLinking(true)
    try {
      const results = await applyCoverLetterLinks(selectedCoverItems)
      const ok = results.filter((r) => r.success).length
      toast({
        title: "Cover letter links applied",
        description: `${ok} of ${results.length} application(s) updated in Supabase.`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Link migration failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLinking(false)
      setConfirmLink(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/app" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to workspace
            </Link>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Database className="h-6 w-6 text-primary" aria-hidden />
            Data Integrity Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find broken document links, recover missing resumes from this browser&apos;s cache, and
            migrate cover letter foreign keys so Supabase becomes the source of truth.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh report
        </Button>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Applications</CardDescription>
              <CardTitle className="text-2xl">{summary.applicationCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resume versions (Supabase)</CardDescription>
              <CardTitle className="text-2xl">{summary.resumeVersionCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Empty CV text in Supabase</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {summary.emptyResumeTextLinks.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orphan resume links</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {summary.orphanResumeLinks.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Apps without cover_letter_id</CardDescription>
              <CardTitle className="text-2xl">
                {coverAnalysis?.applicationsWithoutLink ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="resumes">
        <TabsList>
          <TabsTrigger value="resumes">Missing resumes</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="cover-letters">Cover letter links</TabsTrigger>
        </TabsList>

        <TabsContent value="resumes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empty resume_text (linked row exists)</CardTitle>
              <CardDescription>
                Applications where <code>resume_version_id</code> points at a Supabase row, but{" "}
                <code>resume_text</code> is blank — the CV body was never uploaded or was wiped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !summary?.supabaseAvailable ? (
                <p className="text-sm text-destructive">Supabase is not available.</p>
              ) : summary.emptyResumeTextLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every linked resume row has CV text in Supabase.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Job title</TableHead>
                      <TableHead>Application ID</TableHead>
                      <TableHead>Resume ID</TableHead>
                      <TableHead>Local cache</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.emptyResumeTextLinks.map((row) => (
                      <BrokenResumeRow key={`${row.applicationId}:${row.missingResumeId}`} row={row} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orphan resume_version_id links</CardTitle>
              <CardDescription>
                Applications where <code>resume_version_id</code> is set but no matching row exists
                in <code>resume_versions</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !summary?.supabaseAvailable ? (
                <p className="text-sm text-destructive">Supabase is not available.</p>
              ) : summary.orphanResumeLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orphan resume links — every linked application has a Supabase resume row.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Job title</TableHead>
                      <TableHead>Application ID</TableHead>
                      <TableHead>Missing resume ID</TableHead>
                      <TableHead>Local cache</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.orphanResumeLinks.map((row) => (
                      <BrokenResumeRow key={`${row.applicationId}:${row.missingResumeId}`} row={row} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restore missing or empty resumes from localStorage</CardTitle>
              <CardDescription>
                Reads <code>cv_local_resume_versions</code> on this browser and upserts matching
                snapshots into Supabase — including rows that exist but have empty{" "}
                <code>resume_text</code>. Run on the device that still has working CV content
                (e.g. production).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uniqueRecoverableIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orphan resume IDs were found in this browser&apos;s localStorage. Open this page
                  on a browser that still has production cache, or import a localStorage backup
                  first.
                </p>
              ) : (
                <div className="space-y-2">
                  {uniqueRecoverableIds.map((id) => {
                    const row = recoverableRows.find((r) => r.missingResumeId === id)
                    return (
                      <label key={id} className="flex items-center gap-3 rounded-md border p-3">
                        <Checkbox
                          checked={selectedResumeIds.has(id)}
                          onCheckedChange={(checked) => toggleResumeId(id, checked === true)}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium block truncate">
                            {row?.localSnapshotName ?? "Resume snapshot"}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">{id}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={selectedRecoverableIds.length === 0 || recovering}
                  onClick={() => setConfirmRecover(true)}
                >
                  Restore {selectedRecoverableIds.length} resume(s) to Supabase
                </Button>
                {lastRecoveryLog.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => downloadRecoveryLog(lastRecoveryLog)}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download last recovery log
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover-letters" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Why cover_letter_id is null</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {(coverAnalysis?.investigationNotes ?? []).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposed cover_letter_id links</CardTitle>
              <CardDescription>
                Review matches before applying. High-confidence proposals are pre-selected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!coverAnalysis || coverAnalysis.proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No automatic cover letter matches found for unlinked applications.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead>Application</TableHead>
                      <TableHead>Cover letter</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverAnalysis.proposals.map((proposal) => {
                      const key = `${proposal.applicationId}:${proposal.proposedCoverLetterId}`
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCoverProposals.has(key)}
                              onCheckedChange={(checked) =>
                                toggleCoverProposal(proposal, checked === true)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{proposal.jobTitle}</div>
                            <div className="text-muted-foreground text-xs">{proposal.company}</div>
                          </TableCell>
                          <TableCell>
                            <div>{proposal.proposedCoverLetterName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {proposal.proposedCoverLetterId}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={proposal.confidence === "high" ? "default" : "secondary"}>
                              {proposal.matchReason}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}

              <Button
                type="button"
                disabled={selectedCoverItems.length === 0 || linking}
                onClick={() => setConfirmLink(true)}
              >
                Apply {selectedCoverItems.length} cover letter link(s)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmRecover} onOpenChange={setConfirmRecover}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore resumes to Supabase?</AlertDialogTitle>
            <AlertDialogDescription>
              This will upsert {selectedRecoverableIds.length} resume version(s) from this
              browser&apos;s localStorage into Supabase and download a recovery log. Review the
              selection before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recovering}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={recovering} onClick={() => void runRecovery()}>
              {recovering ? "Restoring…" : "Restore to Supabase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLink} onOpenChange={setConfirmLink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply cover letter links?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates <code>job_applications.cover_letter_id</code> in Supabase for{" "}
              {selectedCoverItems.length} selected application(s) and mirrors the link in local
              cache on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={linking}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={linking} onClick={() => void runCoverLinkMigration()}>
              {linking ? "Applying…" : "Apply links"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BrokenResumeRow({ row }: { row: BrokenResumeLinkRow }) {
  return (
    <TableRow>
      <TableCell>{row.company}</TableCell>
      <TableCell>{row.jobTitle}</TableCell>
      <TableCell className="font-mono text-xs">{row.applicationId}</TableCell>
      <TableCell className="font-mono text-xs">{row.missingResumeId}</TableCell>
      <TableCell>
        {row.localSnapshotFound ? (
          <Badge variant="outline" className="gap-1">
            Found: {row.localSnapshotName ?? "snapshot"}
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Not in this browser
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}
