"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Sparkles, Mail, Lock, ArrowRight, RefreshCw } from "lucide-react"
import { auth } from "@/lib/auth"

interface LoginProps {
  onLogin: () => void
}

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "setup" | "forgot" | "reset">(auth.hasUser() ? "login" : "setup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (mode === "setup") {
      // Setup new user
      if (password.length < 6) {
        setError("Password must be at least 6 characters")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }
      if (!email.includes("@")) {
        setError("Please enter a valid email")
        return
      }

      const success = auth.setupUser(email, password)
      if (success) {
        setSuccess("Account created! Please log in.")
        setMode("login")
        setPassword("")
        setConfirmPassword("")
      } else {
        setError("Failed to create account")
      }
    } else if (mode === "login") {
      // Login
      const success = auth.login(email, password)
      if (success) {
        onLogin()
      } else {
        setError("Invalid email or password")
      }
    } else if (mode === "forgot") {
      // Request password reset
      if (!email.includes("@")) {
        setError("Please enter your email")
        return
      }

      const success = auth.generateResetToken(email)
      if (success) {
        setSuccess("Reset token generated! Check the console and enter it below.")
        setMode("reset")
      } else {
        setError("Email not found")
      }
    } else if (mode === "reset") {
      // Reset password
      if (password.length < 6) {
        setError("Password must be at least 6 characters")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }
      if (!resetToken) {
        setError("Please enter the reset token")
        return
      }

      const success = auth.resetPassword(email, resetToken, password)
      if (success) {
        setSuccess("Password reset successful! Please log in.")
        setMode("login")
        setPassword("")
        setConfirmPassword("")
        setResetToken("")
      } else {
        setError("Invalid or expired reset token")
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Jennifer Simonds</CardTitle>
          <CardDescription className="text-lg">Personal AI Suite</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "setup" && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                Welcome! Set up your email and password to secure your workspace.
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{success}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {mode === "setup" || mode === "reset" ? "Password" : "Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {(mode === "setup" || mode === "reset") && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {mode === "reset" && (
              <div className="space-y-2">
                <Label htmlFor="resetToken" className="text-sm font-medium">
                  Reset Token
                </Label>
                <div className="relative">
                  <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="resetToken"
                    type="text"
                    placeholder="Enter reset token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg">
              {mode === "setup" && "Create Account"}
              {mode === "login" && (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
              {mode === "forgot" && "Send Reset Token"}
              {mode === "reset" && "Reset Password"}
            </Button>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
            )}

            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={() => {
                  setMode("login")
                  setError("")
                  setSuccess("")
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
