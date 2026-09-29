"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"

interface PasswordGateProps {
  onAuthenticated: () => void
}

export function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === "CVResume") {
      // Store authentication in localStorage
      localStorage.setItem("cv_authenticated", "true")
      onAuthenticated()
    } else {
      setError("Incorrect password")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">CV & Resume Manager</h1>
          <p className="text-gray-600 text-center mb-8">Enter password to access</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                placeholder="Enter password"
                className="mt-1"
                autoFocus
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>

            <Button type="submit" className="w-full">
              Access Dashboard
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Contact and more information:{" "}
            <a href="/#contact" className="font-medium text-primary hover:underline">
              Contact EquitAI
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
