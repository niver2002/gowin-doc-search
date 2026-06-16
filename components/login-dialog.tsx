"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useGowinAuth } from "@/components/gowin-auth"

const DEFAULT_EMAIL = "contact@streamly.cn"
const DEFAULT_PASSWORD = "streamly.cn"

export function LoginDialog() {
  const { loginOpen, closeLogin, setAuthed } = useGowinAuth()
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [captcha, setCaptcha] = useState("")
  const [captchaSrc, setCaptchaSrc] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const captchaInputRef = useRef<HTMLInputElement>(null)

  const reloadCaptcha = useCallback(() => {
    setCaptcha("")
    setError("")
    // Cache-bust so each request seeds a fresh upstream session + image.
    setCaptchaSrc(`/api/gowin/captcha?t=${Date.now()}`)
  }, [])

  useEffect(() => {
    if (loginOpen) {
      reloadCaptcha()
      setTimeout(() => captchaInputRef.current?.focus(), 150)
    }
  }, [loginOpen, reloadCaptcha])

  // Close on Escape
  useEffect(() => {
    if (!loginOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogin()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [loginOpen, closeLogin])

  if (!loginOpen) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captcha.trim()) {
      setError("请输入验证码")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/gowin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captcha }),
      })
      const json = await res.json()
      if (json.ok) {
        setAuthed(true)
        closeLogin()
      } else {
        setError(json.error || "登录失败，请重试")
        reloadCaptcha()
      }
    } catch {
      setError("网络错误，请重试")
      reloadCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={closeLogin}
      role="dialog"
      aria-modal="true"
      aria-label="登录高云账号"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">登录高云账号</h2>
          <button
            onClick={closeLogin}
            aria-label="关闭"
            className="rounded p-1 text-muted transition hover:bg-background hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          已为你预填公共账号，输入下方验证码即可登录。登录后即可直接下载「需登录」文档。
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="gw-email" className="mb-1 block text-xs font-medium text-muted">
              邮箱
            </label>
            <input
              id="gw-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="gw-pass" className="mb-1 block text-xs font-medium text-muted">
              密码
            </label>
            <input
              id="gw-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="gw-captcha" className="mb-1 block text-xs font-medium text-muted">
              验证码 <span className="text-red-500">（区分大小写）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="gw-captcha"
                ref={captchaInputRef}
                type="text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                autoComplete="off"
                placeholder="请输入图中字符"
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm tracking-wider text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={reloadCaptcha}
                title="点击刷新验证码"
                className="flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white"
              >
                {captchaSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={captchaSrc || "/placeholder.svg"} alt="验证码" className="h-10 w-[120px] object-contain" />
                ) : (
                  <span className="flex h-10 w-[120px] items-center justify-center text-xs text-muted">加载中…</span>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={reloadCaptcha}
              className="mt-1 text-xs text-primary transition hover:underline"
            >
              看不清？点击刷新
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  )
}
