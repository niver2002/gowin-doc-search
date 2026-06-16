import { cookies } from "next/headers"
import { AUTH_COOKIE, SESS_COOKIE } from "@/lib/gowin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const store = await cookies()
  store.delete(SESS_COOKIE)
  store.delete(AUTH_COOKIE)
  return Response.json({ ok: true })
}
