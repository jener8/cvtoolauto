import { toFolderContactInfo } from "./contact-info"
import type { Folder, FolderContactInfo } from "./types"

export function defaultFolderContactInfo(
  overrides?: Partial<FolderContactInfo>,
): FolderContactInfo {
  return {
    name: "",
    email: "",
    phone: "",
    address: "",
    linkedin: "",
    citizenship: "",
    portfolio: "",
    portfolios: [],
    professionalTitle: "",
    language: "en",
    ...overrides,
  }
}

export function mapFolderRow(
  row: Record<string, unknown>,
  includeProfileImage: boolean,
): Folder {
  const contactInfoRaw = row.contact_info as Partial<FolderContactInfo> | null | undefined

  return {
    id: row.id as string,
    name: row.name as string,
    profileImage: includeProfileImage
      ? ((row.profile_image as string | null) || null)
      : null,
    contactInfo: toFolderContactInfo(contactInfoRaw),
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  }
}
