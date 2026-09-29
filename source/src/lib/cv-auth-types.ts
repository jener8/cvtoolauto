export type CvUserRole = "admin" | "demo" | "user"

export type CvUser = {
  username: string
  role: CvUserRole
}

export type AccountRecord = {
  username: string
  passwordHash: string
  role: CvUserRole
  email?: string
  surname?: string
  created?: string
}

/** Legacy plain-text field — migrated to passwordHash on read. */
export type StoredAccountRecord = AccountRecord & {
  password?: string
}

export const CV_USER_SESSION_KEY = "cv_user"

export type PublicAccount = Omit<AccountRecord, "passwordHash"> & {
  passwordHash?: never
  password?: never
}
