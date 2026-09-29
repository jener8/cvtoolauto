interface AuthUser {
  email: string
  passwordHash: string
  resetToken?: string
  resetTokenExpiry?: number
}

const AUTH_STORAGE_KEY = "auth_user"
const SESSION_KEY = "auth_session"

// Simple hash function for demonstration (in production, use proper hashing)
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export const auth = {
  // Setup initial user (only if no user exists)
  setupUser(email: string, password: string): boolean {
    if (typeof window === "undefined") return false

    const existing = localStorage.getItem(AUTH_STORAGE_KEY)
    if (existing) {
      console.log("[v0] User already exists")
      return false
    }

    const user: AuthUser = {
      email,
      passwordHash: simpleHash(password),
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    console.log("[v0] User created successfully")
    return true
  },

  // Login
  login(email: string, password: string): boolean {
    if (typeof window === "undefined") return false

    const userStr = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!userStr) {
      console.log("[v0] No user found")
      return false
    }

    const user: AuthUser = JSON.parse(userStr)
    const passwordHash = simpleHash(password)

    if (user.email === email && user.passwordHash === passwordHash) {
      // Create session
      const session = {
        email,
        timestamp: Date.now(),
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      console.log("[v0] Login successful")
      return true
    }

    console.log("[v0] Invalid credentials")
    return false
  },

  // Logout
  logout(): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(SESSION_KEY)
    console.log("[v0] Logged out")
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false

    const sessionStr = localStorage.getItem(SESSION_KEY)
    if (!sessionStr) return false

    const session = JSON.parse(sessionStr)
    // Session valid for 7 days
    const isValid = Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000

    if (!isValid) {
      localStorage.removeItem(SESSION_KEY)
    }

    return isValid
  },

  // Check if user exists
  hasUser(): boolean {
    if (typeof window === "undefined") return false
    return !!localStorage.getItem(AUTH_STORAGE_KEY)
  },

  // Get user email
  getUserEmail(): string | null {
    if (typeof window === "undefined") return null

    const sessionStr = localStorage.getItem(SESSION_KEY)
    if (!sessionStr) return null

    const session = JSON.parse(sessionStr)
    return session.email
  },

  // Generate reset token
  generateResetToken(email: string): boolean {
    if (typeof window === "undefined") return false

    const userStr = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!userStr) return false

    const user: AuthUser = JSON.parse(userStr)
    if (user.email !== email) return false

    // Generate a simple token (in production, send this via email)
    const token = Math.random().toString(36).substring(2, 15)
    user.resetToken = token
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000 // 1 hour

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))

    // For demo purposes, show the token in console
    console.log("[v0] Password reset token:", token)
    alert(`Password reset token (check console): ${token}`)

    return true
  },

  // Reset password with token
  resetPassword(email: string, token: string, newPassword: string): boolean {
    if (typeof window === "undefined") return false

    const userStr = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!userStr) return false

    const user: AuthUser = JSON.parse(userStr)

    if (
      user.email !== email ||
      user.resetToken !== token ||
      !user.resetTokenExpiry ||
      Date.now() > user.resetTokenExpiry
    ) {
      console.log("[v0] Invalid or expired reset token")
      return false
    }

    // Update password
    user.passwordHash = simpleHash(newPassword)
    delete user.resetToken
    delete user.resetTokenExpiry

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    console.log("[v0] Password reset successful")
    return true
  },

  // Change password (when logged in)
  changePassword(currentPassword: string, newPassword: string): boolean {
    if (typeof window === "undefined") return false

    const userStr = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!userStr) return false

    const user: AuthUser = JSON.parse(userStr)
    const currentHash = simpleHash(currentPassword)

    if (user.passwordHash !== currentHash) {
      console.log("[v0] Current password incorrect")
      return false
    }

    user.passwordHash = simpleHash(newPassword)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    console.log("[v0] Password changed successfully")
    return true
  },
}
