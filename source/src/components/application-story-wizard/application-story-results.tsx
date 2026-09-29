"use client"

import { useMemo, useState } from "react"
import { ImageIcon, Loader2, Map, Sparkles, FileText } from "lucide-react"
import { AiWizardProgress } from "@/components/ai-wizard-progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EvidencePanel } from "@/components/application-story-wizard/evidence-panel"
import { IllustrationView } from "@/components/application-story-wizard/illustration-view"
import { StoryMapView } from "@/components/application-story-wizard/story-map-view"
import { generateStoryIllustration } from "@/app/actions/generate-story-illustration"
import type { JobApplication, YourStory } from "@/lib/types"
import type { IllustrationStyle } from "@/lib/application-story-wizard/types"
import { toast } from "@/hooks/use-toast"

type ApplicationStoryResultsProps = {
  job: JobApplication
  story: YourStory
  outputLanguage: "en" | "de"
  onUpdateStory: (story: YourStory) => void | Promise<void>
  onRegenerate?: () => void
}

const ILLUSTRATION_STYLES: { value: IllustrationStyle; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "executive", label: "Executive" },
  { value: "creative", label: "Creative" },
]

export function ApplicationStoryResults({
  job,
  story,
  outputLanguage,
  onUpdateStory,
  onRegenerate,
}: ApplicationStoryResultsProps) {
  const wizard = story.applicationStoryWizard
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const highlightedEvidenceIds = useMemo(() => {
    const ids = new Set<string>()
    if (selectedEvidenceId) ids.add(selectedEvidenceId)
    if (selectedNodeId && wizard?.storyMap) {
      const node = wizard.storyMap.nodes.find((n) => n.id === selectedNodeId)
      node?.evidenceIds.forEach((id) => ids.add(id))
    }
    if (selectedHotspotId && wizard?.illustration) {
      const hotspot = wizard.illustration.hotspots.find((h) => h.id === selectedHotspotId)
      hotspot?.evidenceIds.forEach((id) => ids.add(id))
    }
    return [...ids]
  }, [selectedEvidenceId, selectedNodeId, selectedHotspotId, wizard])

  const handleStoryChange = async (content: string) => {
    const next = { ...story, content, lastModified: Date.now() }
    await onUpdateStory(next)
  }

  const handleGenerateIllustration = async (style?: IllustrationStyle) => {
    if (!wizard?.illustration) return
    setBusy("illustration")
    try {
      const result = await generateStoryIllustration({
        illustrationPrompt: wizard.illustration.prompt,
        style: style ?? wizard.illustration.style,
        company: job.company,
        jobTitle: job.jobTitle,
        hotspots: wizard.illustration.hotspots,
      })
      if (!result.success || !result.illustration) {
        toast({ title: "Could not generate illustration", description: result.error, variant: "destructive" })
        return
      }
      const next: YourStory = {
        ...story,
        lastModified: Date.now(),
        applicationStoryWizard: {
          ...wizard,
          illustration: result.illustration,
        },
      }
      await onUpdateStory(next)
    } finally {
      setBusy(null)
    }
  }

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setSelectedHotspotId(null)
    const node = wizard?.storyMap?.nodes.find((n) => n.id === nodeId)
    if (node?.evidenceIds[0]) setSelectedEvidenceId(node.evidenceIds[0])
  }

  const handleSelectHotspot = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId)
    setSelectedNodeId(null)
    const hotspot = wizard?.illustration?.hotspots.find((h) => h.id === hotspotId)
    if (hotspot?.evidenceIds[0]) setSelectedEvidenceId(hotspot.evidenceIds[0])
  }

  if (!wizard?.wizardCompletedAt) return null

  return (
    <div className="application-story-results relative space-y-6">
      {busy === "illustration" ? (
        <AiWizardProgress
          variant="scoped-overlay"
          phases={[
            {
              title: "Composing the illustration brief",
              detail: "Turning your story evidence into a visual scene.",
            },
            {
              title: "Generating artwork",
              detail: "Creating a professional illustration for your application story.",
            },
          ]}
          headline="AI is creating your illustration…"
          footnote="Image generation can take up to a minute."
          phaseIntervalMs={4000}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Application Story Wizard</h2>
          <p className="text-sm text-muted-foreground">
            Four connected outputs from one analysis — story, map, illustration, and evidence.
          </p>
        </div>
        {onRegenerate ? (
          <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
            <Sparkles className="mr-2 h-4 w-4" />
            Re-run wizard
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="story" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="story" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Story
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5">
            <Map className="h-3.5 w-3.5" />
            Story Map
          </TabsTrigger>
          <TabsTrigger value="illustration" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            Illustration
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            Evidence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="story" className="mt-4 space-y-4">
          <Textarea
            value={story.content}
            onChange={(e) => void handleStoryChange(e.target.value)}
            rows={14}
            className="your-story-panel__textarea min-h-[280px] resize-y font-serif text-base leading-relaxed"
          />
        </TabsContent>

        <TabsContent value="map" className="mt-4 space-y-4">
          {wizard.storyMap ? (
            <StoryMapView
              storyMap={wizard.storyMap}
              selectedNodeId={selectedNodeId}
              highlightedEvidenceIds={highlightedEvidenceIds}
              onSelectNode={handleSelectNode}
            />
          ) : null}
          <EvidencePanel
            evidence={story.cvEvidence}
            highlightedIds={highlightedEvidenceIds}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={setSelectedEvidenceId}
            outputLanguage={outputLanguage}
          />
        </TabsContent>

        <TabsContent value="illustration" className="mt-4 space-y-4">
          {wizard.illustration ? (
            <>
              <div className="flex flex-wrap gap-2">
                {ILLUSTRATION_STYLES.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    size="sm"
                    variant={wizard.illustration?.style === s.value ? "default" : "outline"}
                    disabled={busy === "illustration"}
                    onClick={() => void handleGenerateIllustration(s.value)}
                  >
                    {busy === "illustration" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {s.label}
                  </Button>
                ))}
                {!wizard.illustration.imageDataUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === "illustration"}
                    onClick={() => void handleGenerateIllustration()}
                  >
                    {busy === "illustration" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate illustration
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === "illustration"}
                    onClick={() => void handleGenerateIllustration()}
                  >
                    Regenerate
                  </Button>
                )}
              </div>
              <IllustrationView
                illustration={wizard.illustration}
                selectedHotspotId={selectedHotspotId}
                highlightedEvidenceIds={highlightedEvidenceIds}
                onSelectHotspot={handleSelectHotspot}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <EvidencePanel
            evidence={story.cvEvidence}
            highlightedIds={highlightedEvidenceIds}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={setSelectedEvidenceId}
            outputLanguage={outputLanguage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
