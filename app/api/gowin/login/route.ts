import { cookies } from "next/headers"
import { AUTH_COOKIE, COMMON_HEADERS, GOWIN_BASE, getStoredSession, parsePhpSessId, SESS_COOKIE } from "@/lib/gowin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DEFAULT_EMAIL = "contact@streamly.cn"
const DEFAULT_PASSWORD = "streamly.cn"

export async function POST(req: Request) {
  let body: { email?: string; password?: string; captcha?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "请求格式错误" }, { status: 400 })
  }

  const email = (body.email || DEFAULT_EMAIL).trim()
  const password = body.password || DEFAULT_PASSWORD
  const captcha = (body.captcha || "").trim()

  if (!captcha) {
    return Response.json({ ok: false, error: "请输入验证码" }, { status: 400 })
  }

  const sessId = await getStoredSession()
  if (!sessId) {
    return Response.json({ ok: false, error: "会话已过期，请刷新验证码后重试" }, { status: 400 })
  }

  const form = new URLSearchParams({ email, password, captcha2: captcha })

  const res = await fetch(`${GOWIN_BASE}/member/login/`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `PHPSESSID=${sessId}`,
      Referer: `${GOWIN_BASE}/member/`,
    },
    body: form.toString(),
    redirect: "manual",
    cache: "no-store",
  })

  const text = await res.text()

  // Upstream may rotate the session id on successful auth — keep the newest.
  const rotated = parsePhpSessId(res.headers.getSetCookie())
  const activeSess = rotated ?? sessId

  // Success signal: Gowin returns a JS redirect to the member profile page.
  const success = /member\/profile/i.test(text) || /location\.href/i.test(text)

  const store = await cookies()

  if (success) {
    store.set(SESS_COOKIE, activeSess, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    })
    store.set(AUTH_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    })
    return Response.json({ ok: true })
  }

  // Failed: most commonly a wrong/expired captcha. Clear stale session so the
  // client is forced to grab a fresh captcha.
  store.delete(SESS_COOKIE)
  return Response.json(
    { ok: false, error: "登录失败：验证码或账号密码有误，请重新获取验证码后再试（验证码区分大小写）" },
    { status: 401 },
  )
}
