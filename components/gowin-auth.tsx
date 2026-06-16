"use client"

import { createContext, use, useCallback, useEffect, useState } from "react"

type AuthState = {
  authed: boolean
  ready: boolean
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
  setAuthed: (v: boolean) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function GowinAuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/gowin/status", { cache: "no-store" })
      const json = await res.json()
      setAuthed(Boolean(json.authed))
    } catch {
      setAuthed(false)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch("/api/gowin/logout", { method: "POST" })
    setAuthed(false)
  }, [])

  return (
    <AuthContext
      value={{
        authed,
        ready,
        loginOpen,
        openLogin: () => setLoginOpen(true),
        closeLogin: () => setLoginOpen(false),
        setAuthed,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useGowinAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error("useGowinAuth must be used within GowinAuthProvider")
  return ctx
}
