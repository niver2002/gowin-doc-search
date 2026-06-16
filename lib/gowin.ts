import { cookies } from "next/headers"

export const GOWIN_BASE = "https://www.gowinsemi.com/en"
export const SESS_COOKIE = "gw_sess"
export const AUTH_COOKIE = "gw_auth"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

export const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
}

/** Extract the PHPSESSID value from one or more Set-Cookie header strings. */
export function parsePhpSessId(setCookies: string[]): string | null {
  for (const sc of setCookies) {
    const m = sc.match(/PHPSESSID=([^;]+)/)
    if (m) return m[1]
  }
  return null
}

/**
 * Seed a Gowin session: hit the member page so the upstream allocates a
 * PHPSESSID, returning that id. Returns null if none was issued.
 */
export async function seedSession(): Promise<string | null> {
  const res = await fetch(`${GOWIN_BASE}/member/`, {
    headers: COMMON_HEADERS,
    redirect: "manual",
    cache: "no-store",
  })
  return parsePhpSessId(res.headers.getSetCookie())
}

/** Read the stored upstream PHPSESSID from our own httpOnly cookie. */
export async function getStoredSession(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESS_COOKIE)?.value ?? null
}

export async function isAuthed(): Promise<boolean> {
  const store = await cookies()
  return store.get(AUTH_COOKIE)?.value === "1"
}

/** Only allow proxying genuine Gowin document URLs. */
export function isAllowedGowinUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      (u.hostname === "www.gowinsemi.com" || u.hostname === "gowinsemi.com") &&
      (u.pathname.includes("/upload/") || u.pathname.includes("/document/"))
    )
  } catch {
    return false
  }
}
