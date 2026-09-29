"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquarePlus,
  ThumbsUp,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"
import { SUPABASE_REQUEST_TIMEOUT_MS } from "@/lib/supabase/config"

const CATEGORIES = [
  "General",
  "Behavioral",
  "Technical",
  "Leadership",
  "Problem Solving",
  "Culture Fit",
  "Salary & Benefits",
  "Career Goals",
  "Strengths & Weaknesses",
  "Situational",
]

const CATEGORY_COLORS: Record<string, string> = {
  "General": "bg-muted text-muted-foreground",
  "Behavioral": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Technical": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Leadership": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Problem Solving": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Culture Fit": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Salary & Benefits": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Career Goals": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Strengths & Weaknesses": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Situational": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
}

interface InterviewQuestion {
  id: string
  question: string
  category: string
  author_name: string
  user_id: string | null
  upvotes: number
  created_at: string
}

interface InterviewQuestionsProps {
  userId?: string
}

export function InterviewQuestions({ userId }: InterviewQuestionsProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState("")
  const [newCategory, setNewCategory] = useState("General")
  const [authorName, setAuthorName] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set())

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true)
    if (shouldUseLocalFallback()) {
      setIsLoading(false)
      return
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setIsLoading(false)
        return
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

      const { data, error } = await supabase
        .from("interview_questions")
        .select("*")
        .order("upvotes", { ascending: false })
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (!error && data) {
        setQuestions(data)
        if (data.length > 0) {
          setIsExpanded(true)
        }
      }
    } catch (e) {
      console.log("[v0] fetchQuestions exception:", e)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // Load upvoted IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("interview_upvoted_ids")
      if (stored) {
        setUpvotedIds(new Set(JSON.parse(stored)))
      }
    } catch {
      // ignore
    }
  }, [])

  const handleSubmit = async () => {
    if (!newQuestion.trim() || isSubmitting) return
    if (shouldUseLocalFallback()) {
      console.log("[v0] Interview questions disabled while offline")
      return
    }
    setIsSubmitting(true)

    try {
      const supabase = getSupabaseClient()
      if (!supabase) return

      const { data, error } = await supabase.from("interview_questions").insert({
        question: newQuestion.trim(),
        category: newCategory,
        author_name: authorName.trim() || "Anonymous",
        user_id: userId || null,
      }).select()

      if (error) {
        console.log("[v0] Insert error:", error.message)
      } else {
        // Optimistically add the new question to state immediately
        if (data && data.length > 0) {
          setQuestions((prev) => [data[0], ...prev])
        }
        setNewQuestion("")
        setAuthorName("")
        setNewCategory("General")
        setShowAddForm(false)
      }
    } catch (e) {
      console.log("[v0] Submit exception:", e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpvote = async (id: string) => {
    if (upvotedIds.has(id) || shouldUseLocalFallback()) return

    const question = questions.find((q) => q.id === id)
    if (!question) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    const { error } = await supabase
      .from("interview_questions")
      .update({ upvotes: question.upvotes + 1 })
      .eq("id", id)

    if (!error) {
      const newUpvotedIds = new Set(upvotedIds)
      newUpvotedIds.add(id)
      setUpvotedIds(newUpvotedIds)
      localStorage.setItem("interview_upvoted_ids", JSON.stringify([...newUpvotedIds]))
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q))
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return
    if (shouldUseLocalFallback()) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    const { error } = await supabase.from("interview_questions").delete().eq("id", id)

    if (!error) {
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    }
  }

  const filteredQuestions = questions.filter((q) => {
  return filterCategory === "all" || q.category === filterCategory
  })

  return (
    <Card className="border border-border/50">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Community Interview Questions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {questions.length} question{questions.length !== 1 ? "s" : ""} shared by the community
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9"
              onClick={(e) => {
                e.stopPropagation()
                setShowAddForm(!showAddForm)
              }}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              Add Question
            </Button>
          </div>

          {/* Add Question Form */}
          {showAddForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Interview Question</Label>
                <Textarea
                  placeholder='e.g., "Tell me about a time you had to deal with a difficult team member..."'
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-medium">Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-medium">Your Name (optional)</Label>
                  <Input
                    placeholder="Anonymous"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSubmit()
                  }}
                  disabled={!newQuestion.trim() || isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Question"}
                </Button>
              </div>
            </div>
          )}

          {/* Questions List */}
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Loading questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
  {questions.length === 0
  ? "No questions yet. Be the first to share one!"
  : "No questions in this category."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                >
                  {/* Upvote */}
                  <button
                    type="button"
                    onClick={() => handleUpvote(q.id)}
                    disabled={upvotedIds.has(q.id)}
                    className={`flex flex-col items-center gap-0.5 pt-0.5 min-w-[36px] ${
                      upvotedIds.has(q.id)
                        ? "text-primary cursor-default"
                        : "text-muted-foreground hover:text-primary cursor-pointer"
                    } transition-colors`}
                  >
                    <ThumbsUp className={`h-4 w-4 ${upvotedIds.has(q.id) ? "fill-primary" : ""}`} />
                    <span className="text-xs font-medium">{q.upvotes}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm leading-relaxed">{q.question}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 font-medium ${CATEGORY_COLORS[q.category] || CATEGORY_COLORS["General"]}`}
                      >
                        {q.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        by {q.author_name}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(q.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
