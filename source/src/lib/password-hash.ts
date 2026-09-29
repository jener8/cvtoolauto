import { createHash } from "crypto"

export function hashPasswordSync(password: string): string {
  return createHash("sha256").update(password.toLowerCase().trim()).digest("hex")
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password.toLowerCase().trim())
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }
  return hashPasswordSync(password)
}
