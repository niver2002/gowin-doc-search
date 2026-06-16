import { cookies } from "next/headers"
import { COMMON_HEADERS, GOWIN_BASE, parsePhpSessId, SESS_COOKIE } from "@/lib/gowin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Fetch a fresh captcha from Gowin. This also (re)allocates the upstream
 * PHPSESSID that the captcha answer is bound to, so we persist that id into
 * our own httpOnly cookie and must reuse it on the subsequent login POST.
 */
export async function GET() {
  // Seed a session against the member page first (mirrors a real browser).
  const seed = await fetch(`${GOWIN_BASE}/member/`, {
    headers: COMMON_HEADERS,
    redirect: "manual",
    cache: "no-store",
  })
  let sessId = parsePhpSessId(seed.headers.getSetCookie())

  const captchaHeaders: Record<string, string> = { ...COMMON_HEADERS }
  if (sessId) captchaHeaders["Cookie"] = `PHPSESSID=${sessId}`

  const res = await fetch(`${GOWIN_BASE}/form/captcha/2/`, {
    headers: captchaHeaders,
    redirect: "manual",
    cache: "no-store",
  })

  // The captcha request may issue its own session; prefer that one.
  const captchaSess = parsePhpSessId(res.headers.getSetCookie())
  if (captchaSess) sessId = captchaSess

  const buf = Buffer.from(await res.arrayBuffer())

  if (sessId) {
    const store = await cookies()
    store.set(SESS_COOKIE, sessId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    })
  }

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
