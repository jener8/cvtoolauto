import { SignJWT, jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(process.env.PDF_TOKEN_SECRET || "your-secret-key-change-in-production")

export interface PdfTokenPayload {
  resumeId: string
  userId: string
  expiresAt: number
}

export async function generatePdfToken(resumeId: string, userId: string): Promise<string> {
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

  const token = await new SignJWT({
    resumeId,
    userId,
    expiresAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(JWT_SECRET)

  return token
}

export async function verifyPdfToken(token: string): Promise<PdfTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    if (!payload.resumeId || !payload.userId || !payload.expiresAt) {
      return null
    }

    if (Date.now() > (payload.expiresAt as number)) {
      return null
    }

    return {
      resumeId: payload.resumeId as string,
      userId: payload.userId as string,
      expiresAt: payload.expiresAt as number,
    }
  } catch (error) {
    console.error("[v0] Token verification failed:", error)
    return null
  }
}
