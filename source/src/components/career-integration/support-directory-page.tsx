"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { searchSupportOrganizationsWeb } from "@/app/actions/search-support-organizations-web"
import { Button } from "@/components/ui/button"
import { usePageTitle } from "@/hooks/use-page-title"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import {
  inferUserCity,
  QUICK_FILTER_CATEGORIES,
  type SupportDirectoryFilters,
} from "@/lib/support-organizations/filter"
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support-organizations/types"
import {
  loadUserSupportContacts,
  newUserSupportContactId,
  saveUserSupportContacts,
} from "@/lib/support-organizations/user-contacts-storage"
import type { UnverifiedSupportResult, UserSupportContact } from "@/lib/support-organizations/types"
import {
  buildWebSearchCacheKey,
  readWebSearchSessionCache,
  writeWebSearchSessionCache,
} from "@/lib/support-organizations/web-search-session-cache"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import {
  ArrowLeft,
  HeartHandshake,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import {
  UserSupportContactDialog,
  type UserSupportContactFormValues,
} from "@/components/career-integration/user-support-contact-dialog"
import "./support-directory.css"

type SupportDirectoryPageProps = {
  folderId: string
  onBack: () => void
  strategicProfile?: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
}

function emptyFilters(): SupportDirectoryFilters {
  return { categories: [], location: null, costFreeOnly: false }
}

const WEB_SEARCH_COOLDOWN_MS = 4_000

function buildWebSearchQuery(
  searchQuery: string,
  filters: SupportDirectoryFilters,
): string {
  const trimmed = searchQuery.trim()
  if (trimmed) return trimmed

  const parts = [
    ...filters.categories.map((category) => SUPPORT_CATEGORY_LABELS[category]),
    filters.location?.trim(),
    filters.costFreeOnly ? "free" : "",
  ].filter((part): part is string => Boolean(part))

  return parts.join(" ").trim()
}

function openExternalUrl(url: string): void {
  if (typeof window === "undefined" || !url.startsWith("http")) return
  window.open(url, "_blank", "noopener,noreferrer")
}

export function SupportDirectoryPage({
  folderId,
  onBack,
  strategicProfile,
  qualificationProfile,
}: SupportDirectoryPageProps) {
  usePageTitle(pageTitleForSection("mentoringSupport"))

  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<SupportDirectoryFilters>(() => emptyFilters())

  const [webResults, setWebResults] = useState<UnverifiedSupportResult[]>([])
  const [isWebSearching, setIsWebSearching] = useState(false)
  const [webError, setWebError] = useState<string | null>(null)
  const [webSearched, setWebSearched] = useState(false)
  const [webSearchCooldownActive, setWebSearchCooldownActive] = useState(false)
  const [webResultsFromCache, setWebResultsFromCache] = useState(false)

  const [userContacts, setUserContacts] = useState<UserSupportContact[]>([])
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<UserSupportContact | null>(null)

  useEffect(() => {
    setUserContacts(loadUserSupportContacts(folderId))
  }, [folderId])

  useEffect(() => {
    setWebResults([])
    setWebSearched(false)
    setWebError(null)
    setWebResultsFromCache(false)
  }, [searchQuery, activeFilters])

  const userCity = useMemo(
    () =>
      inferUserCity([
        strategicProfile?.careerDirection,
        strategicProfile?.longTermGoal,
        qualificationProfile?.workExperience,
        qualificationProfile?.institution,
      ]),
    [strategicProfile, qualificationProfile],
  )

  const savedWebResultIds = useMemo(
    () =>
      new Set(
        userContacts
          .map((contact) => contact.sourceWebResultId)
          .filter((id): id is string => Boolean(id)),
      ),
    [userContacts],
  )

  const persistUserContacts = useCallback(
    (contacts: UserSupportContact[]) => {
      setUserContacts(contacts)
      saveUserSupportContacts(folderId, contacts)
    },
    [folderId],
  )

  const handleSaveContact = useCallback(
    (values: UserSupportContactFormValues) => {
      const now = Date.now()
      if (editingContact) {
        persistUserContacts(
          userContacts.map((contact) =>
            contact.id === editingContact.id
              ? {
                  ...contact,
                  name: values.name,
                  type: values.type,
                  description: values.description,
                  contactInfo: values.contactInfo,
                  externalUrl: values.externalUrl || undefined,
                  updatedAt: now,
                }
              : contact,
          ),
        )
        setEditingContact(null)
        return
      }

      const next: UserSupportContact = {
        id: newUserSupportContactId(),
        name: values.name,
        type: values.type,
        description: values.description,
        contactInfo: values.contactInfo,
        externalUrl: values.externalUrl || undefined,
        isUserAdded: true,
        isUnverified: false,
        createdAt: now,
        updatedAt: now,
      }
      persistUserContacts([next, ...userContacts])
    },
    [editingContact, persistUserContacts, userContacts],
  )

  const handleSaveWebResult = useCallback(
    (result: UnverifiedSupportResult) => {
      if (savedWebResultIds.has(result.id)) return
      const now = Date.now()
      const next: UserSupportContact = {
        id: newUserSupportContactId(),
        name: result.name,
        type: result.type,
        description: result.description,
        contactInfo: result.location,
        externalUrl: result.externalUrl,
        isUserAdded: true,
        isUnverified: true,
        sourceWebResultId: result.id,
        createdAt: now,
        updatedAt: now,
      }
      persistUserContacts([next, ...userContacts])
    },
    [persistUserContacts, savedWebResultIds, userContacts],
  )

  const handleDeleteContact = useCallback(
    (contactId: string) => {
      persistUserContacts(userContacts.filter((contact) => contact.id !== contactId))
    },
    [persistUserContacts, userContacts],
  )

  const openAddContact = useCallback(() => {
    setEditingContact(null)
    setContactDialogOpen(true)
  }, [])

  const openEditContact = useCallback((contact: UserSupportContact) => {
    setEditingContact(contact)
    setContactDialogOpen(true)
  }, [])

  const toggleCategory = useCallback((category: (typeof QUICK_FILTER_CATEGORIES)[number]) => {
    setActiveFilters((prev) => {
      const has = prev.categories.includes(category)
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => c !== category)
          : [...prev.categories, category],
      }
    })
  }, [])

  const toggleCity = useCallback(() => {
    if (!userCity) return
    setActiveFilters((prev) => ({
      ...prev,
      location: prev.location === userCity ? null : userCity,
    }))
  }, [userCity])

  const toggleFree = useCallback(() => {
    setActiveFilters((prev) => ({ ...prev, costFreeOnly: !prev.costFreeOnly }))
  }, [])

  /** Only fires on explicit "Find matches" click — never on load, filter, or typing. */
  const handleFindMatches = useCallback(async () => {
    const query = buildWebSearchQuery(searchQuery, activeFilters)
    if (!query) {
      setWebError("Enter a search term or choose a filter before searching.")
      return
    }

    const cacheKey = buildWebSearchCacheKey({
      query,
      userCity,
      filters: activeFilters,
    })

    setWebError(null)
    setWebSearched(true)
    setWebResultsFromCache(false)
    setWebSearchCooldownActive(true)
    window.setTimeout(() => setWebSearchCooldownActive(false), WEB_SEARCH_COOLDOWN_MS)

    const cached = readWebSearchSessionCache(cacheKey)
    if (cached !== null) {
      setWebResults(cached)
      setWebResultsFromCache(true)
      return
    }

    setIsWebSearching(true)
    setWebResults([])
    try {
      const result = await searchSupportOrganizationsWeb({
        query,
        userCity,
        filters: activeFilters,
      })
      if (!result.success) {
        setWebResults([])
        setWebError(result.error ?? "Web search failed.")
        return
      }
      const results = result.results ?? []
      setWebResults(results)
      if (results.length > 0) {
        writeWebSearchSessionCache(cacheKey, results)
      }
    } finally {
      setIsWebSearching(false)
    }
  }, [searchQuery, activeFilters, userCity])

  const findMatchesDisabled = isWebSearching || webSearchCooldownActive

  return (
    <div className="support-directory">
      <header className="support-directory__header">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)]/10 text-[var(--color-primary-light)]">
            <HeartHandshake className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              You don&apos;t have to figure this out alone
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Search for mentors, career groups, and support services near you — or add contacts
              you already know. Saved contacts stay private on this device.
            </p>
          </div>
        </div>
      </header>

      <div className="support-directory__body">
        <div className="support-directory__search-row">
          <div className="support-directory__search" role="search">
            <Sparkles className="support-directory__search-icon" aria-hidden />
            <label className="sr-only" htmlFor="support-directory-search">
              Search support organisations
            </label>
            <input
              id="support-directory-search"
              className="support-directory__search-input"
              placeholder="e.g. mentoring for migrant women in Berlin"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleFindMatches()
              }}
            />
            <button
              type="button"
              className="support-directory__search-btn"
              onClick={() => void handleFindMatches()}
              disabled={findMatchesDisabled}
            >
              {isWebSearching ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
                  Finding…
                </>
              ) : (
                "Find matches"
              )}
            </button>
          </div>
          <div className="support-directory__toolbar">
            <button type="button" className="support-directory__add-btn" onClick={openAddContact}>
              <Plus className="h-4 w-4" aria-hidden />
              Add your own
            </button>
          </div>
        </div>

        <div className="support-directory__chips" aria-label="Quick filters">
          {userCity ? (
            <button
              type="button"
              className={`support-directory__chip${activeFilters.location === userCity ? " support-directory__chip--active" : ""}`}
              onClick={toggleCity}
            >
              {userCity}
            </button>
          ) : null}
          {QUICK_FILTER_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`support-directory__chip${activeFilters.categories.includes(category) ? " support-directory__chip--active" : ""}`}
              onClick={() => toggleCategory(category)}
            >
              {SUPPORT_CATEGORY_LABELS[category]}
            </button>
          ))}
          <button
            type="button"
            className={`support-directory__chip${activeFilters.costFreeOnly ? " support-directory__chip--active" : ""}`}
            onClick={toggleFree}
          >
            Free
          </button>
        </div>

        {isWebSearching ? (
          <div className="support-directory__web-loading" role="status" aria-live="polite">
            <Loader2 className="support-directory__web-loading-icon animate-spin" aria-hidden />
            Looking for organizations near you…
          </div>
        ) : null}

        {webError ? <p className="support-directory__error">{webError}</p> : null}

        {webSearched && !isWebSearching && webResults.length === 0 && !webError ? (
          <p className="support-directory__empty-state-text support-directory__no-web-results" role="status">
            We couldn&apos;t find strong matches for that search. Try different words, or add a
            contact you already know using &ldquo;Add your own&rdquo;.
          </p>
        ) : null}

        {webResults.length > 0 ? (
          <section className="support-directory__web-section" aria-label="Search results">
            <div className="support-directory__web-disclaimer" role="note">
              These results come from a live web search. We haven&apos;t reviewed them — please
              verify details before reaching out.
              {webResultsFromCache ? (
                <span className="support-directory__web-disclaimer-cache">
                  {" "}
                  (Showing results from this session — no new search was run.)
                </span>
              ) : null}
            </div>
            <div className="support-directory__grid" role="list">
              {webResults.map((result) => {
                const isSaved = savedWebResultIds.has(result.id)
                const hasUrl = Boolean(result.externalUrl?.startsWith("http"))
                return (
                  <article
                    key={result.id}
                    className="support-directory__card support-directory__card--unverified"
                    role="listitem"
                  >
                    <div className="support-directory__card-head support-directory__card-head--plain">
                      <div className="min-w-0 flex-1">
                        <p className="support-directory__card-title">{result.name}</p>
                        <p className="support-directory__card-meta">
                          {result.type}
                          {result.location ? ` · ${result.location}` : ""}
                        </p>
                        <span
                          className="support-directory__badge support-directory__badge--unverified"
                          aria-label="Unverified: not reviewed by our team"
                        >
                          Unverified — please check before reaching out
                        </span>
                      </div>
                    </div>
                    <p className="support-directory__card-desc">{result.description}</p>
                    <div className="support-directory__card-actions">
                      <button
                        type="button"
                        className={`support-directory__btn${isSaved ? " support-directory__btn--saved" : ""}`}
                        onClick={() => handleSaveWebResult(result)}
                        disabled={isSaved}
                        aria-pressed={isSaved}
                      >
                        {isSaved ? "Saved ✓" : "Save to my contacts"}
                      </button>
                      {hasUrl ? (
                        <button
                          type="button"
                          className="support-directory__btn support-directory__btn--primary"
                          onClick={() => openExternalUrl(result.externalUrl!)}
                        >
                          Visit site
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="support-directory__section" aria-labelledby="your-contacts-heading">
          <div>
            <h2 id="your-contacts-heading" className="support-directory__section-heading">
              Your saved contacts
            </h2>
            <p className="support-directory__section-subtext">
              Private to you on this device — not reviewed by our team.
            </p>
          </div>
          {userContacts.length === 0 ? (
            <div className="support-directory__empty">
              Add mentors, advisors, or organisations you already know — only you will see them
              here.
            </div>
          ) : (
            <div className="support-directory__grid" role="list">
              {userContacts.map((contact) => (
                <article
                  key={contact.id}
                  className="support-directory__card support-directory__card--personal"
                  role="listitem"
                >
                  <div className="support-directory__card-head">
                    <div className="min-w-0 flex-1">
                      <div className="support-directory__card-title-row">
                        <p className="support-directory__card-title">{contact.name}</p>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="support-directory__icon-btn"
                            onClick={() => openEditContact(contact)}
                            aria-label={`Edit ${contact.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="support-directory__icon-btn support-directory__icon-btn--danger"
                            onClick={() => handleDeleteContact(contact.id)}
                            aria-label={`Delete ${contact.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                      {contact.type ? (
                        <p className="support-directory__card-meta">{contact.type}</p>
                      ) : null}
                      <span className="support-directory__personal-badge">
                        {contact.isUnverified ? "Your contact · Unverified" : "Your contact"}
                      </span>
                    </div>
                  </div>
                  {contact.description ? (
                    <p className="support-directory__card-desc">{contact.description}</p>
                  ) : null}
                  <p className="support-directory__card-contact">{contact.contactInfo}</p>
                  <div className="support-directory__card-actions support-directory__card-actions--personal">
                    {contact.externalUrl?.startsWith("http") ? (
                      <button
                        type="button"
                        className="support-directory__btn support-directory__btn--primary"
                        onClick={() => openExternalUrl(contact.externalUrl!)}
                      >
                        Visit site
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <UserSupportContactDialog
        open={contactDialogOpen}
        onOpenChange={(open) => {
          setContactDialogOpen(open)
          if (!open) setEditingContact(null)
        }}
        initialContact={editingContact}
        onSave={handleSaveContact}
      />
    </div>
  )
}
