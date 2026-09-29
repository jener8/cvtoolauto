import {
  USER_SUPPORT_CONTACT_CATEGORY_LABELS,
  type UserSupportContact,
  type UserSupportContactCategory,
} from "@/lib/support-organizations/types"

const STORAGE_PREFIX = "support-user-contacts"

type UserSupportContactsState = {
  version: 2
  contacts: UserSupportContact[]
}

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

function legacyCategoryToType(category: unknown): string {
  if (typeof category !== "string" || !category.trim()) return ""
  const key = category as UserSupportContactCategory
  return USER_SUPPORT_CONTACT_CATEGORY_LABELS[key] ?? category.trim()
}

function normalizeUserSupportContact(value: unknown): UserSupportContact | null {
  if (typeof value !== "object" || value === null) return null
  const row = value as Partial<UserSupportContact> & { category?: string }

  const type =
    (typeof row.type === "string" && row.type.trim()) ||
    legacyCategoryToType(row.category) ||
    ""

  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    typeof row.contactInfo !== "string" ||
    typeof row.createdAt !== "number" ||
    typeof row.updatedAt !== "number"
  ) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    type,
    description: row.description,
    contactInfo: row.contactInfo,
    externalUrl: typeof row.externalUrl === "string" ? row.externalUrl : undefined,
    isUserAdded: row.isUserAdded ?? true,
    isUnverified: row.isUnverified ?? false,
    sourceWebResultId:
      typeof row.sourceWebResultId === "string" ? row.sourceWebResultId : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function loadUserSupportContacts(folderId: string): UserSupportContact[] {
  if (typeof window === "undefined" || !folderId) return []
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<UserSupportContactsState>
    if (!Array.isArray(parsed.contacts)) return []
    return parsed.contacts
      .map(normalizeUserSupportContact)
      .filter((contact): contact is UserSupportContact => contact !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function saveUserSupportContacts(folderId: string, contacts: UserSupportContact[]): void {
  if (typeof window === "undefined" || !folderId) return
  const state: UserSupportContactsState = { version: 2, contacts }
  localStorage.setItem(storageKey(folderId), JSON.stringify(state))
}

export function newUserSupportContactId(): string {
  return `user-contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
