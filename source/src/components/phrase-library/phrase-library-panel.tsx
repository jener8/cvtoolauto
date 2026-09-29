"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/use-toast"
import { usePhraseLibrary } from "@/components/phrase-library/phrase-library-context"
import {
  CAREER_PHRASES,
  PHRASE_CATEGORIES,
  relatedPhrases,
} from "@/lib/phrase-library/phrases"
import { loadPhraseFavourites, togglePhraseFavourite } from "@/lib/phrase-library/storage"
import type { CareerPhrase, PhraseCategoryId } from "@/lib/phrase-library/types"
import { cn } from "@/lib/utils"
import "./phrase-library.css"

type PhraseLibraryVariant = "embedded" | "overlay"

function PhrasePreview({
  phrase,
  favourites,
  onFavourite,
  onUse,
  onEdit,
  onSelectRelated,
}: {
  phrase: CareerPhrase
  favourites: string[]
  onFavourite: (id: string) => void
  onUse: (phrase: CareerPhrase) => void
  onEdit: (phrase: CareerPhrase) => void
  onSelectRelated: (phrase: CareerPhrase) => void
}) {
  const related = relatedPhrases(phrase)
  const isFav = favourites.includes(phrase.id)

  return (
    <div>
      <h3 className="phrase-library__preview-title">
        <Star className="mr-1 inline h-4 w-4 text-amber-500" aria-hidden />
        {phrase.title}
      </h3>
      <div className="phrase-library__preview-section">
        <p className="phrase-library__preview-label">Example</p>
        <p className="phrase-library__preview-text">{phrase.example}</p>
      </div>
      <div className="phrase-library__preview-section">
        <p className="phrase-library__preview-label">Good for</p>
        <div className="phrase-library__card-tags">
          {phrase.goodFor.map((tag) => (
            <span key={tag} className="phrase-library__tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
      {related.length > 0 ? (
        <div className="phrase-library__preview-section">
          <p className="phrase-library__preview-label">Related</p>
          <div className="phrase-library__related">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                className="phrase-library__related-btn"
                onClick={() => onSelectRelated(item)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="phrase-library__actions">
        <Button type="button" className="w-full" onClick={() => onUse(phrase)}>
          Use phrase
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => onEdit(phrase)}>
          Edit before inserting
        </Button>
        <div className="phrase-library__fav-row">
          <span className="text-xs text-muted-foreground">Personalise every phrase — never copy blindly.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onFavourite(phrase.id)}
            aria-pressed={isFav}
            aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
          >
            <Star className={cn("h-4 w-4", isFav && "fill-amber-400 text-amber-500")} />
            {isFav ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PhraseLibraryContent({
  variant,
  active,
  initialCategoryId,
  activeField,
  onClose,
  insertPhrase,
  openPhraseEditor,
}: {
  variant: PhraseLibraryVariant
  active: boolean
  initialCategoryId: PhraseCategoryId | null
  activeField: ReturnType<typeof usePhraseLibrary>["activeField"]
  onClose?: () => void
  insertPhrase: (phrase: CareerPhrase) => boolean
  openPhraseEditor: (phrase: CareerPhrase) => void
}) {
  const [categoryId, setCategoryId] = useState<PhraseCategoryId | "favourites">("career-direction")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favourites, setFavourites] = useState<string[]>([])

  const isEmbedded = variant === "embedded"

  useEffect(() => {
    if (!active && !isEmbedded) return
    setFavourites(loadPhraseFavourites())
    setCategoryId(initialCategoryId ?? "career-direction")
    if (!isEmbedded) {
      setSearch("")
      setSelectedId(null)
    }
  }, [active, initialCategoryId, isEmbedded])

  useEffect(() => {
    if (isEmbedded) {
      setFavourites(loadPhraseFavourites())
    }
  }, [isEmbedded])

  const filteredPhrases = useMemo(() => {
    const query = search.trim().toLowerCase()
    let list =
      categoryId === "favourites"
        ? CAREER_PHRASES.filter((p) => favourites.includes(p.id))
        : CAREER_PHRASES.filter((p) => p.categoryId === categoryId)

    if (query) {
      list = CAREER_PHRASES.filter((p) => {
        const haystack = `${p.title} ${p.example} ${p.tags.join(" ")} ${p.goodFor.join(" ")}`.toLowerCase()
        return haystack.includes(query)
      })
    }

    return list
  }, [categoryId, favourites, search])

  useEffect(() => {
    if (filteredPhrases.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredPhrases.some((p) => p.id === selectedId)) {
      setSelectedId(filteredPhrases[0]!.id)
    }
  }, [filteredPhrases, selectedId])

  const selectedPhrase = selectedId ? filteredPhrases.find((p) => p.id === selectedId) ?? null : null

  const handleFavourite = useCallback((id: string) => {
    setFavourites(togglePhraseFavourite(id))
  }, [])

  const handleUse = useCallback(
    async (phrase: CareerPhrase) => {
      const ok = insertPhrase(phrase)
      if (ok) {
        if (variant === "overlay") onClose?.()
        return
      }

      try {
        await navigator.clipboard.writeText(phrase.example)
        toast({
          title: "Phrase copied",
          description: "Paste it into your CV, cover letter, or story — then personalise it.",
        })
      } catch {
        toast({
          title: "Focus a text field first",
          description: "Click into a field on My story or another page, then choose Use phrase again.",
          variant: "destructive",
        })
      }
    },
    [insertPhrase, onClose, variant],
  )

  return (
    <div className={cn("phrase-library", isEmbedded && "phrase-library--embedded")}>
      <header className="phrase-library__header">
        {!isEmbedded ? (
          <SheetTitle className="phrase-library__title">Phrase library</SheetTitle>
        ) : null}
        {isEmbedded ? (
          <p className="phrase-library__subtitle phrase-library__subtitle--embedded">
            Starting points to describe your experience — always personalise before you use them.
            {activeField ? (
              <span className="mt-1 block text-[var(--color-primary-light)]">
                Inserting into: {activeField.label}
              </span>
            ) : (
              <span className="mt-1 block">
                Choose a phrase, then copy or insert into a text field elsewhere in the app.
              </span>
            )}
          </p>
        ) : (
          <SheetDescription className="phrase-library__subtitle">
            Starting points to describe your experience — always personalise before you use them.
            {activeField ? (
              <span className="mt-1 block text-[var(--color-primary-light)]">
                Inserting into: {activeField.label}
              </span>
            ) : (
              <span className="mt-1 block">
                Focus a text field first, or open this from My story to insert directly.
              </span>
            )}
          </SheetDescription>
        )}
      </header>

      <div className="phrase-library__category-mobile">
        <label className="sr-only" htmlFor="phrase-category-mobile">
          Category
        </label>
        <Select
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as PhraseCategoryId | "favourites")}
        >
          <SelectTrigger id="phrase-category-mobile" className="w-full">
            <SelectValue placeholder="Choose category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="favourites">Favourites</SelectItem>
            {PHRASE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="phrase-library__body">
        <nav className="phrase-library__categories" aria-label="Phrase categories">
          <button
            type="button"
            className={cn(
              "phrase-library__category-btn",
              categoryId === "favourites" && "phrase-library__category-btn--active",
            )}
            onClick={() => setCategoryId("favourites")}
          >
            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Favourites
          </button>
          {PHRASE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                "phrase-library__category-btn",
                categoryId === cat.id && "phrase-library__category-btn--active",
              )}
              onClick={() => setCategoryId(cat.id)}
            >
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              <span>
                {cat.label}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {cat.description}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <div className="phrase-library__main">
          <div className="phrase-library__toolbar">
            <label className="sr-only" htmlFor="phrase-search">
              Search phrases
            </label>
            <div className="phrase-library__search phrase-library__search--compact">
              <Search className="phrase-library__search-icon" aria-hidden />
              <Input
                id="phrase-search"
                className="phrase-library__search-input"
                placeholder="Filter phrases…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="phrase-library__cards" role="list">
            {filteredPhrases.length === 0 ? (
              <p className="phrase-library__empty col-span-full">
                No phrases found. Try another category or search term.
              </p>
            ) : (
              filteredPhrases.map((phrase) => (
                <button
                  key={phrase.id}
                  type="button"
                  role="listitem"
                  className={cn(
                    "phrase-library__card",
                    selectedId === phrase.id && "phrase-library__card--selected",
                  )}
                  onClick={() => setSelectedId(phrase.id)}
                  aria-pressed={selectedId === phrase.id}
                >
                  <span className="phrase-library__card-title">
                    {favourites.includes(phrase.id) ? (
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
                    ) : null}
                    {phrase.title}
                  </span>
                  <span className="phrase-library__card-example">{phrase.example}</span>
                  <span className="phrase-library__card-tags">
                    {phrase.goodFor.slice(0, 3).map((tag) => (
                      <span key={tag} className="phrase-library__tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedPhrase ? (
            <div className="phrase-library__preview-mobile">
              <PhrasePreview
                phrase={selectedPhrase}
                favourites={favourites}
                onFavourite={handleFavourite}
                onUse={handleUse}
                onEdit={openPhraseEditor}
                onSelectRelated={(p) => setSelectedId(p.id)}
              />
            </div>
          ) : null}
        </div>

        {selectedPhrase ? (
          <aside className="phrase-library__preview" aria-label="Phrase preview">
            <div className="phrase-library__preview-inner">
              <PhrasePreview
                phrase={selectedPhrase}
                favourites={favourites}
                onFavourite={handleFavourite}
                onUse={handleUse}
                onEdit={openPhraseEditor}
                onSelectRelated={(p) => setSelectedId(p.id)}
              />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/** Full-width phrase browser on the Phrase library nav page. */
export function PhraseLibraryEmbedded({ className }: { className?: string }) {
  const { initialCategoryId, activeField, insertPhrase, openPhraseEditor } = usePhraseLibrary()

  return (
    <div className={cn("phrase-library-embedded-wrap", className)}>
      <PhraseLibraryContent
        variant="embedded"
        active
        initialCategoryId={initialCategoryId}
        activeField={activeField}
        insertPhrase={insertPhrase}
        openPhraseEditor={openPhraseEditor}
      />
    </div>
  )
}

/** Slide-over panel when opened from a text field elsewhere in the app. */
export function PhraseLibraryPanel() {
  const {
    open,
    closePhraseLibrary,
    initialCategoryId,
    activeField,
    insertPhrase,
    openPhraseEditor,
  } = usePhraseLibrary()

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closePhraseLibrary()}>
      <SheetContent side="right" className="phrase-library-sheet p-0">
        <PhraseLibraryContent
          variant="overlay"
          active={open}
          initialCategoryId={initialCategoryId}
          activeField={activeField}
          onClose={closePhraseLibrary}
          insertPhrase={insertPhrase}
          openPhraseEditor={openPhraseEditor}
        />
      </SheetContent>
    </Sheet>
  )
}
