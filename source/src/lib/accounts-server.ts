import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import path from "path"
import type { AccountRecord, StoredAccountRecord } from "@/lib/cv-auth-types"
import { hashPasswordSync } from "@/lib/password-hash"

const ACCOUNTS_DIR = path.join(process.cwd(), "src/config")
const ACCOUNTS_PATH = path.join(ACCOUNTS_DIR, "accounts.json")

function ensureAccountsFile(): void {
  if (!existsSync(ACCOUNTS_DIR)) {
    mkdirSync(ACCOUNTS_DIR, { recursive: true })
  }
  if (!existsSync(ACCOUNTS_PATH)) {
    const examplePath = path.join(ACCOUNTS_DIR, "accounts.example.json")
    if (existsSync(examplePath)) {
      writeFileSync(ACCOUNTS_PATH, readFileSync(examplePath, "utf8"), "utf8")
    } else {
      writeFileSync(ACCOUNTS_PATH, "[]\n", "utf8")
    }
  }
}

function stripLegacyPassword(account: StoredAccountRecord): AccountRecord {
  const { password: _password, ...rest } = account
  return rest as AccountRecord
}

function migrateAccountsIfNeeded(accounts: StoredAccountRecord[]): AccountRecord[] {
  const needsMigration = accounts.some((account) => account.password && !account.passwordHash)
  if (!needsMigration) {
    return accounts.map(stripLegacyPassword)
  }

  const migrated = accounts.map((account) => {
    if (account.password && !account.passwordHash) {
      const passwordHash = hashPasswordSync(account.password)
      const { password: _password, ...rest } = account
      return { ...rest, passwordHash } as AccountRecord
    }
    return stripLegacyPassword(account)
  })

  writeAccounts(migrated)
  return migrated
}

export function readAccounts(): AccountRecord[] {
  ensureAccountsFile()
  try {
    const raw = readFileSync(ACCOUNTS_PATH, "utf8")
    const parsed = JSON.parse(raw) as unknown
    const accounts = Array.isArray(parsed) ? (parsed as StoredAccountRecord[]) : []
    return migrateAccountsIfNeeded(accounts)
  } catch {
    return []
  }
}

export function writeAccounts(accounts: AccountRecord[]): void {
  ensureAccountsFile()
  writeFileSync(ACCOUNTS_PATH, `${JSON.stringify(accounts, null, 2)}\n`, "utf8")
}

export function findAccount(username: string, password: string): AccountRecord | null {
  const normalizedUsername = username.trim().toLowerCase()
  const hashedInput = hashPasswordSync(password)
  return (
    readAccounts().find(
      (account) =>
        account.username.trim().toLowerCase() === normalizedUsername &&
        account.passwordHash === hashedInput,
    ) ?? null
  )
}

export function findAccountByUsername(username: string): AccountRecord | null {
  const normalized = username.trim().toLowerCase()
  return (
    readAccounts().find(
      (account) => account.username.trim().toLowerCase() === normalized,
    ) ?? null
  )
}
