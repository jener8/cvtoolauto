"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Trash2, Save, FileText, AlertTriangle, Globe, CheckCircle2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { JobApplication } from "@/lib/types"
import { type Language, getTranslation } from "@/lib/translations"
import { translateTextWithRateLimit, isTranslationRateLimited, clearTranslationRateLimit } from "@/lib/utils"

interface InterviewPrepProps {
  job: JobApplication
  onUpdate: (updates: Partial<JobApplication>) => void
  onBack: () => void
}

export function InterviewPrep({ job, onUpdate, onBack }: InterviewPrepProps) {
  const [interviewData, setInterviewData] = useState(job.interviewPrep)
  const [redFlags, setRedFlags] = useState(job.redFlags || [])
  const [projectStories, setProjectStories] = useState(job.interviewPrep.projectStories || [])
  const [isSaving, setIsSaving] = useState(false)
  const [language, setLanguage] = useState<Language>("en")
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedContent, setTranslatedContent] = useState<Record<string, { en: string; de: string }>>({})
  const [isRateLimited, setIsRateLimited] = useState(false)
  
  // Clear any stale rate limit on mount and check status periodically
  useEffect(() => {
    // Clear stale rate limit from previous sessions
    clearTranslationRateLimit()
    setIsRateLimited(false)
    
    const checkRateLimit = () => setIsRateLimited(isTranslationRateLimited())
    const interval = setInterval(checkRateLimit, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const t = (key: keyof typeof import("@/lib/translations").translations.en) => getTranslation(language, key)

  // Function to translate text using shared utility
  const translateText = async (text: string, targetLanguage: Language): Promise<string> => {
    const result = await translateTextWithRateLimit(text, targetLanguage)
    if (result.rateLimited) {
      setIsRateLimited(true)
    }
    return result.translatedText
  }

  // Get translated content - returns translated version for current language
  const getTranslatedText = (key: string, originalContent: string): string => {
    const cached = translatedContent[key]
    if (cached && cached[language]) {
      return cached[language]
    }
    // Fallback to original if no translation available
    return originalContent
  }

  // Handle language change with bidirectional translation
  // Translates FROM current language TO new language
  const handleLanguageChange = async (newLanguage: Language) => {
    if (newLanguage === language) return
    setIsTranslating(true)
    
    const newTranslations: Record<string, { en: string; de: string }> = { ...translatedContent }
    const currentLang = language // The language we're translating FROM
    
    // Helper function to ensure translation exists in both directions
    const ensureTranslation = async (key: string, originalEnglishContent: string) => {
      if (!originalEnglishContent || originalEnglishContent.trim().length < 3) return
      
      // Initialize if needed - always store the original English content
      if (!newTranslations[key]) {
        newTranslations[key] = { en: originalEnglishContent, de: "" }
      } else if (!newTranslations[key].en) {
        newTranslations[key].en = originalEnglishContent
      }
      
      // If switching to German and we don't have German translation, translate from English
      if (newLanguage === "de" && !newTranslations[key].de) {
        newTranslations[key].de = await translateText(originalEnglishContent, "de")
      }
      // Note: When switching back to English, we already have the English stored
    }
    
    // Translate personal description
    if (interviewData.personalDescription) {
      await ensureTranslation("personalDescription", interviewData.personalDescription)
    }

    // Translate general notes
    if (interviewData.generalNotes) {
      await ensureTranslation("generalNotes", interviewData.generalNotes)
    }

    // Translate questions
    for (const q of interviewData.questions) {
      for (const field of ["question", "answer"] as const) {
        const content = q[field]
        if (content) {
          await ensureTranslation(`question-${q.id}-${field}`, content)
        }
      }
    }

    // Translate possible answers
    for (const a of (interviewData.possibleAnswers || [])) {
      for (const field of ["question", "answer"] as const) {
        const content = a[field]
        if (content) {
          await ensureTranslation(`answer-${a.id}-${field}`, content)
        }
      }
    }

    // Translate interviewer notes
    for (const i of interviewData.interviewers) {
      if (i.notes) {
        await ensureTranslation(`interviewer-${i.id}-notes`, i.notes)
      }
    }

    // Translate red flags (use local redFlags state, not job.redFlags)
    for (const flag of redFlags) {
      for (const field of ["question", "answer"] as const) {
        const content = flag[field]
        if (content) {
          await ensureTranslation(`redflag-${flag.id}-${field}`, content)
        }
      }
    }

    setTranslatedContent(newTranslations)
    setLanguage(newLanguage)
    setIsTranslating(false)
  }

  const handleSave = () => {
    setIsSaving(true)
    onUpdate({
      interviewPrep: {
        ...interviewData,
        projectStories: projectStories,
        lastModified: Date.now(),
      },
      redFlags: redFlags,
    })
    setTimeout(() => setIsSaving(false), 500)
  }

  // Red flag management functions
  const addRedFlag = () => {
    setRedFlags([
      ...redFlags,
      {
        id: Date.now().toString(),
        question: "",
        answer: "",
      },
    ])
  }

  const updateRedFlag = (id: string, field: "question" | "answer", value: string) => {
    setRedFlags(redFlags.map((rf) => (rf.id === id ? { ...rf, [field]: value } : rf)))
  }

  const deleteRedFlag = (id: string) => {
    setRedFlags(redFlags.filter((rf) => rf.id !== id))
  }

  // Project stories management functions
  const addProjectStory = () => {
    setProjectStories([
      ...projectStories,
      {
        id: Date.now().toString(),
        projectName: "",
        role: "",
        challenge: "",
        action: "",
        result: "",
        technologies: "",
      },
    ])
  }

  const updateProjectStory = (id: string, field: string, value: string) => {
    setProjectStories(projectStories.map((ps) => (ps.id === id ? { ...ps, [field]: value } : ps)))
  }

  const deleteProjectStory = (id: string) => {
    setProjectStories(projectStories.filter((ps) => ps.id !== id))
  }

  const addQuestion = () => {
    setInterviewData({
      ...interviewData,
      questions: [
        ...interviewData.questions,
        {
          id: Date.now().toString(),
          question: "",
          framework: "",
          answer: "",
        },
      ],
    })
  }

  const updateQuestion = (id: string, field: string, value: string | boolean) => {
    setInterviewData({
      ...interviewData,
      questions: interviewData.questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    })
  }

  const deleteQuestion = (id: string) => {
    setInterviewData({
      ...interviewData,
      questions: interviewData.questions.filter((q) => q.id !== id),
    })
  }

  const addInterviewer = () => {
    setInterviewData({
      ...interviewData,
      interviewers: [
        ...interviewData.interviewers,
        {
          id: Date.now().toString(),
          name: "",
          role: "",
          notes: "",
        },
      ],
    })
  }

  const updateInterviewer = (id: string, field: string, value: string) => {
    setInterviewData({
      ...interviewData,
      interviewers: interviewData.interviewers.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    })
  }

  const deleteInterviewer = (id: string) => {
    setInterviewData({
      ...interviewData,
      interviewers: interviewData.interviewers.filter((i) => i.id !== id),
    })
  }

  const addPossibleAnswer = () => {
    setInterviewData({
      ...interviewData,
      possibleAnswers: [
        ...(interviewData.possibleAnswers || []),
        {
          id: Date.now().toString(),
          question: "",
          answer: "",
        },
      ],
    })
  }

  const updatePossibleAnswer = (id: string, field: string, value: string) => {
    setInterviewData({
      ...interviewData,
      possibleAnswers: (interviewData.possibleAnswers || []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    })
  }

  const deletePossibleAnswer = (id: string) => {
    setInterviewData({
      ...interviewData,
      possibleAnswers: (interviewData.possibleAnswers || []).filter((a) => a.id !== id),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
        <div className="mb-8">
          <Button onClick={onBack} variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Interview Preparation</h1>
            <p className="text-muted-foreground text-lg">
              {job.jobTitle} at {job.company}
            </p>
          </div>
        </div>

        <div className="mb-6 flex justify-end items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={(val) => handleLanguageChange(val as Language)} disabled={isTranslating}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("english")}</SelectItem>
                <SelectItem value="de">{t("german")}</SelectItem>
              </SelectContent>
            </Select>
            {isTranslating && (
              <span className="text-xs text-muted-foreground animate-pulse">{t("translating")}</span>
            )}
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : t("save")}
          </Button>
        </div>

        <Tabs defaultValue="description" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="description">About Me</TabsTrigger>
            <TabsTrigger value="projects">Project Stories</TabsTrigger>
            <TabsTrigger value="questions">Questions & Frameworks</TabsTrigger>
            <TabsTrigger value="answers">Possible Answers</TabsTrigger>
            <TabsTrigger value="interviewers">Interviewers</TabsTrigger>
            <TabsTrigger value="notes">General Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Description</CardTitle>
                <CardDescription>
                  A compelling description of who you are that fits this specific role. Use this during the interview to
                  introduce yourself effectively.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!job.jobStrategy?.intent && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ No Job Strategy defined yet. Create one in the Job Strategy section first to ensure your
                      interview preparation aligns with your strategic approach.
                    </p>
                  </div>
                )}
                {language === "en" ? (
                  <Textarea
                    value={interviewData.personalDescription}
                    onChange={(e) => setInterviewData({ ...interviewData, personalDescription: e.target.value })}
                    placeholder="Write a concise and compelling introduction that highlights your relevant experience and why you're a great fit for this role..."
                    rows={12}
                    className="text-base leading-relaxed"
                  />
                ) : (
                  <div className="min-h-[300px] p-4 border rounded-md bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 italic">{t("german")} {t("version")}:</p>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {getTranslatedText("personalDescription", interviewData.personalDescription) || <span className="text-muted-foreground italic">No content to translate</span>}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 bg-transparent"
                  onClick={() => {
                    const prompt = `Create a compelling 2-3 minute introduction for me to use when interviewing for ${job.jobTitle} at ${job.company}. The job description is: ${job.jobDescription || "[paste job description]"}. Focus on my relevant experience, skills, and why I'm passionate about this opportunity. Make it conversational and memorable.${
                      job.jobStrategy?.intent
                        ? `

IMPORTANT - Align with this job strategy:
Intent: ${job.jobStrategy.intent}
Positioning: ${job.jobStrategy.positioning}
Success Criteria: ${job.jobStrategy.successCriteria}`
                        : ""
                    }`
                    navigator.clipboard.writeText(prompt)
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Copy ChatGPT Prompt
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Stories Tab */}
          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Project Stories</CardTitle>
                    <CardDescription>
                      Prepare stories about your projects using the STAR method (Situation, Task, Action, Result) to showcase your experience effectively.
                    </CardDescription>
                  </div>
                  <Button onClick={addProjectStory} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {projectStories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No project stories added yet</p>
                    <Button onClick={addProjectStory} variant="ghost" size="sm" className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Project Story
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {projectStories.map((story, index) => (
                      <div key={story.id} className="p-4 border rounded-lg bg-muted/20">
                        <div className="flex items-start justify-between mb-4">
                          <Label className="text-lg font-semibold">Project {index + 1}</Label>
                          <Button
                            onClick={() => deleteProjectStory(story.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`project-name-${story.id}`}>Project Name</Label>
                              <Input
                                id={`project-name-${story.id}`}
                                value={story.projectName}
                                onChange={(e) => updateProjectStory(story.id, "projectName", e.target.value)}
                                placeholder="e.g., E-commerce Platform Redesign"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`project-role-${story.id}`}>Your Role</Label>
                              <Input
                                id={`project-role-${story.id}`}
                                value={story.role}
                                onChange={(e) => updateProjectStory(story.id, "role", e.target.value)}
                                placeholder="e.g., Lead Developer, Project Manager"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`project-challenge-${story.id}`}>Challenge / Situation</Label>
                            <Textarea
                              id={`project-challenge-${story.id}`}
                              value={story.challenge}
                              onChange={(e) => updateProjectStory(story.id, "challenge", e.target.value)}
                              placeholder="What was the problem or challenge you faced?"
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`project-action-${story.id}`}>Action / Your Approach</Label>
                            <Textarea
                              id={`project-action-${story.id}`}
                              value={story.action}
                              onChange={(e) => updateProjectStory(story.id, "action", e.target.value)}
                              placeholder="What actions did you take to address the challenge?"
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`project-result-${story.id}`}>Result / Impact</Label>
                            <Textarea
                              id={`project-result-${story.id}`}
                              value={story.result}
                              onChange={(e) => updateProjectStory(story.id, "result", e.target.value)}
                              placeholder="What was the outcome? Include metrics if possible (e.g., 30% performance improvement)"
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`project-tech-${story.id}`}>Technologies / Skills Used</Label>
                            <Input
                              id={`project-tech-${story.id}`}
                              value={story.technologies}
                              onChange={(e) => updateProjectStory(story.id, "technologies", e.target.value)}
                              placeholder="e.g., React, Node.js, AWS, Agile methodology"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            {/* Red Flags Section */}
            <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <CardTitle className="text-red-700 dark:text-red-400">Red Flag Questions to Address</CardTitle>
                  </div>
                  <Button onClick={addRedFlag} variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 bg-transparent">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Red Flag
                  </Button>
                </div>
                <CardDescription className="text-red-600/80 dark:text-red-400/80">
                  These are concerns about this job. Prepare to ask about or address these during the interview.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {redFlags.length === 0 ? (
                  <div className="text-center py-6 text-red-600/60 dark:text-red-400/60">
                    <p>No red flags added yet</p>
                    <Button onClick={addRedFlag} variant="ghost" size="sm" className="mt-2 text-red-600 hover:text-red-700 dark:text-red-400">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Red Flag
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {redFlags.map((flag, index) => (
                      <div key={flag.id} className="p-4 bg-white dark:bg-background rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-start justify-between mb-3">
                          <Label className="text-red-700 dark:text-red-400 font-medium">Red Flag {index + 1}</Label>
                          <Button
                            onClick={() => deleteRedFlag(flag.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor={`redflag-q-${flag.id}`} className="text-sm text-red-600/80 dark:text-red-400/80">
                              Concern / Question
                            </Label>
                            <Textarea
                              id={`redflag-q-${flag.id}`}
                              value={getTranslatedText(`redflag-${flag.id}-question`, flag.question)}
                              onChange={(e) => updateRedFlag(flag.id, "question", e.target.value)}
                              placeholder="What concern do you have about this job?"
                              className="mt-1 border-red-200 dark:border-red-800 focus:border-red-400"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`redflag-a-${flag.id}`} className="text-sm text-red-600/80 dark:text-red-400/80">
                              Notes / How to Address
                            </Label>
                            <Textarea
                              id={`redflag-a-${flag.id}`}
                              value={getTranslatedText(`redflag-${flag.id}-answer`, flag.answer)}
                              onChange={(e) => updateRedFlag(flag.id, "answer", e.target.value)}
                              placeholder="How will you address this concern in the interview?"
                              className="mt-1 border-red-200 dark:border-red-800 focus:border-red-400"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interview Questions Section */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Interview Questions</h2>
                <p className="text-muted-foreground">
                  Prepare answers using frameworks like STAR (Situation, Task, Action, Result)
                </p>
              </div>
              <Button onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>

            {interviewData.questions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">No questions added yet</p>
                  <Button onClick={addQuestion} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Question
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {interviewData.questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">Question {index + 1}</CardTitle>
                        <Button
                          onClick={() => deleteQuestion(question.id)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {language === "en" ? (
                        <>
                          <div className="space-y-2">
                            <Label>Question</Label>
                            <Input
                              value={question.question}
                              onChange={(e) => updateQuestion(question.id, "question", e.target.value)}
                              placeholder="e.g., Tell me about a time you led a difficult project..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Framework / Approach</Label>
                            <Input
                              value={question.framework}
                              onChange={(e) => updateQuestion(question.id, "framework", e.target.value)}
                              placeholder="e.g., STAR method, specific metrics to mention..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Your Answer</Label>
                            <Textarea
                              value={question.answer}
                              onChange={(e) => updateQuestion(question.id, "answer", e.target.value)}
                              placeholder="Write your prepared answer here. Keep it concise and focused on key points you want to remember..."
                              rows={6}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Question</Label>
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="whitespace-pre-wrap">{getTranslatedText(`question-${question.id}-question`, question.question) || <span className="text-muted-foreground italic">No content</span>}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Framework / Approach</Label>
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="whitespace-pre-wrap">{question.framework || <span className="text-muted-foreground italic">No framework</span>}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Your Answer</Label>
                            <div className="p-3 border rounded-md bg-muted/30 min-h-[100px]">
                              <p className="whitespace-pre-wrap">{getTranslatedText(`question-${question.id}-answer`, question.answer) || <span className="text-muted-foreground italic">No answer</span>}</p>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Post-Interview Reflection Section */}
                      <div className="mt-6 pt-4 border-t border-dashed">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Post-Interview Reflection</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`was-asked-${question.id}`}
                              checked={question.wasAsked || false}
                              onCheckedChange={(checked) => updateQuestion(question.id, "wasAsked", checked as boolean)}
                            />
                            <Label 
                              htmlFor={`was-asked-${question.id}`}
                              className={`text-sm cursor-pointer ${question.wasAsked ? "text-green-600 dark:text-green-400 font-medium" : ""}`}
                            >
                              {question.wasAsked ? "This question was asked!" : "Mark if this question was asked"}
                            </Label>
                          </div>
                          {question.wasAsked && (
                            <div className="space-y-2 pl-6">
                              <Label htmlFor={`my-answer-${question.id}`} className="text-sm">
                                How did you actually answer? (Notes for improvement)
                              </Label>
                              <Textarea
                                id={`my-answer-${question.id}`}
                                value={question.myAnswerNotes || ""}
                                onChange={(e) => updateQuestion(question.id, "myAnswerNotes", e.target.value)}
                                placeholder="What did you say? What went well? What could you improve next time?"
                                rows={3}
                                className="text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="answers" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Answers to Possible Questions</h2>
                <p className="text-muted-foreground">
                  Prepare answers to questions they might ask you during the interview
                </p>
              </div>
              <Button onClick={addPossibleAnswer}>
                <Plus className="h-4 w-4 mr-2" />
                Add Answer
              </Button>
            </div>

            {(!interviewData.possibleAnswers || interviewData.possibleAnswers.length === 0) ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">No prepared answers yet</p>
                  <Button onClick={addPossibleAnswer} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Answer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {interviewData.possibleAnswers.map((item, index) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">Possible Question {index + 1}</CardTitle>
                        <Button
                          onClick={() => deletePossibleAnswer(item.id)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {language === "en" ? (
                        <>
                          <div className="space-y-2">
                            <Label>Question they might ask</Label>
                            <Input
                              value={item.question}
                              onChange={(e) => updatePossibleAnswer(item.id, "question", e.target.value)}
                              placeholder="e.g., Why do you want to work here?"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Your prepared answer</Label>
                            <Textarea
                              value={item.answer}
                              onChange={(e) => updatePossibleAnswer(item.id, "answer", e.target.value)}
                              placeholder="Write your prepared answer here..."
                              rows={6}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Question they might ask</Label>
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="whitespace-pre-wrap">{getTranslatedText(`answer-${item.id}-question`, item.question) || <span className="text-muted-foreground italic">No question</span>}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Your prepared answer</Label>
                            <div className="p-3 border rounded-md bg-muted/30 min-h-[100px]">
                              <p className="whitespace-pre-wrap">{getTranslatedText(`answer-${item.id}-answer`, item.answer) || <span className="text-muted-foreground italic">No answer</span>}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="interviewers" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Interview Panel</h2>
                <p className="text-muted-foreground">
                  Keep track of who you'll be meeting with and key information about them
                </p>
              </div>
              <Button onClick={addInterviewer}>
                <Plus className="h-4 w-4 mr-2" />
                Add Interviewer
              </Button>
            </div>

            {interviewData.interviewers.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">No interviewers added yet</p>
                  <Button onClick={addInterviewer} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Interviewer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {interviewData.interviewers.map((interviewer) => (
                  <Card key={interviewer.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">Interviewer Details</CardTitle>
                        <Button
                          onClick={() => deleteInterviewer(interviewer.id)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {language === "en" ? (
                        <>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={interviewer.name}
                              onChange={(e) => updateInterviewer(interviewer.id, "name", e.target.value)}
                              placeholder="e.g., Sarah Johnson"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Role / Title</Label>
                            <Input
                              value={interviewer.role}
                              onChange={(e) => updateInterviewer(interviewer.id, "role", e.target.value)}
                              placeholder="e.g., Engineering Manager"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              value={interviewer.notes}
                              onChange={(e) => updateInterviewer(interviewer.id, "notes", e.target.value)}
                              placeholder="LinkedIn background, shared connections, areas of expertise, things to ask them about..."
                              rows={4}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="whitespace-pre-wrap">{interviewer.name || <span className="text-muted-foreground italic">No name</span>}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Role / Title</Label>
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="whitespace-pre-wrap">{interviewer.role || <span className="text-muted-foreground italic">No role</span>}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <div className="p-3 border rounded-md bg-muted/30 min-h-[80px]">
                              <p className="whitespace-pre-wrap">{getTranslatedText(`interviewer-${interviewer.id}-notes`, interviewer.notes) || <span className="text-muted-foreground italic">No notes</span>}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Interview Notes</CardTitle>
                <CardDescription>
                  Additional preparation notes, company research, questions to ask, or anything else you want to
                  remember
                </CardDescription>
              </CardHeader>
              <CardContent>
                {language === "en" ? (
                  <Textarea
                    value={interviewData.generalNotes}
                    onChange={(e) => setInterviewData({ ...interviewData, generalNotes: e.target.value })}
                    placeholder="Add any additional notes here:
• Company culture insights
• Recent company news or achievements
• Questions you want to ask
• Logistics (dress code, interview format, etc.)
• Follow-up tasks"
                    rows={16}
                    className="font-mono text-sm"
                  />
                ) : (
                  <div className="min-h-[300px] p-4 border rounded-md bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 italic">{t("german")} {t("version")}:</p>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {getTranslatedText("generalNotes", interviewData.generalNotes) || <span className="text-muted-foreground italic">No content to translate</span>}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
