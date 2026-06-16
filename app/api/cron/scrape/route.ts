import { NextResponse } from "next/server"
import { buildAndStoreIndex } from "@/lib/build-index"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily cron: re-scrape Gowin + Sipeed file lists and persist the merged
 * index to Vercel Blob. Scheduled via vercel.json (19:00 UTC = 03:00 Beijing).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. When CRON_SECRET
 * is set we require it; this also allows manual triggering with the same header.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const started = Date.now()
  try {
    const result = await buildAndStoreIndex()
    return NextResponse.json({ ...result, duration_ms: Date.now() - started }, { status: result.ok ? 200 : 500 })
  } catch (err) {
    console.error("[cron/scrape] failed:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
