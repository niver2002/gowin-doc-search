"use client"

import { useGowinAuth } from "@/components/gowin-auth"

export function AuthButton() {
  const { authed, ready, openLogin, logout } = useGowinAuth()

  if (!ready) {
    return <span className="text-xs text-muted">…</span>
  }

  if (authed) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          高云已登录
        </span>
        <button
          onClick={logout}
          className="rounded-lg px-2.5 py-1 text-xs text-muted transition hover:text-red-500"
        >
          退出
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={openLogin}
      className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
    >
      登录高云账号
    </button>
  )
}
