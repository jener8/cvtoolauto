import { ILLUSTRATION_SLOT_META } from "@/lib/illustration-slots"

/** Marketing imagery — all routes through the editorial illustration library. */
export const MARKETING_IMAGES = {
  heroPlatform: ILLUSTRATION_SLOT_META["marketing.heroPlatform"].src,
  heroPerson: ILLUSTRATION_SLOT_META["section.mentoringSupport"].src,
  equity: ILLUSTRATION_SLOT_META["marketing.equity"].src,
  cvTemplates: ILLUSTRATION_SLOT_META["marketing.cvTemplates"].src,
  trustShield: ILLUSTRATION_SLOT_META["marketing.trustShield"].src,
  bespokeLab: ILLUSTRATION_SLOT_META["marketing.bespokeLab"].src,
} as const

export const MARKETING_IMAGE_ALT = {
  heroPlatform: ILLUSTRATION_SLOT_META["marketing.heroPlatform"].alt,
  heroPerson: ILLUSTRATION_SLOT_META["section.mentoringSupport"].alt,
  equity: ILLUSTRATION_SLOT_META["marketing.equity"].alt,
  cvTemplates: ILLUSTRATION_SLOT_META["marketing.cvTemplates"].alt,
  trustShield: ILLUSTRATION_SLOT_META["marketing.trustShield"].alt,
  bespokeLab: ILLUSTRATION_SLOT_META["marketing.bespokeLab"].alt,
} as const
