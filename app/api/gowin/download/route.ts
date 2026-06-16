import { COMMON_HEADERS, getStoredSession, GOWIN_BASE, isAllowedGowinUrl, isAuthed } from "@/lib/gowin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Proxy a login-protected Gowin document. Streams the file through using the
 * stored upstream PHPSESSID so the visitor downloads it without ever holding
 * Gowin credentials themselves.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const target = url.searchParams.get("url")
  const name = url.searchParams.get("name") || "document"

  if (!target || !isAllowedGowinUrl(target)) {
    return new Response("无效的下载链接", { status: 400 })
  }

  if (!(await isAuthed())) {
    return new Response("请先登录高云账号", { status: 401 })
  }

  const sessId = await getStoredSession()
  if (!sessId) {
    return new Response("会话已过期，请重新登录", { status: 401 })
  }

  const res = await fetch(target, {
    headers: {
      ...COMMON_HEADERS,
      Cookie: `PHPSESSID=${sessId}`,
      Referer: `${GOWIN_BASE}/document/`,
    },
    redirect: "follow",
    cache: "no-store",
  })

  const ct = res.headers.get("content-type") ?? ""

  // If the upstream bounced us to an HTML page, the session is no longer valid.
  if (!res.ok || ct.includes("text/html")) {
    return new Response("下载失败：登录态可能已失效，请重新登录后再试", { status: 401 })
  }

  const headers = new Headers()
  headers.set("Content-Type", ct || "application/octet-stream")
  const len = res.headers.get("content-length")
  if (len) headers.set("Content-Length", len)
  const safeName = name.replace(/[^\w.\-]+/g, "_")
  headers.set("Content-Disposition", `attachment; filename="${safeName}"`)
  headers.set("Cache-Control", "no-store")

  return new Response(res.body, { status: 200, headers })
}
