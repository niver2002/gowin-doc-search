import "server-only"
import { put } from "@vercel/blob"
import type { DocItem, IndexFile } from "@/lib/docs"
import { scrapeGowin } from "@/lib/scrapers/gowin"
import { scrapeSipeed } from "@/lib/scrapers/sipeed"
import { INDEX_BLOB_PATH, invalidateIndexCache } from "@/lib/index-store"

function nowBeijing(): string {
  // Format current time in Asia/Shanghai (UTC+8)
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export type BuildResult = {
  ok: boolean
  total: number
  gowin_total: number
  sipeed_total: number
  updated_at: string
  blob_url?: string
  errors: string[]
}

/**
 * Run both scrapers, merge into a single index, and persist to Vercel Blob.
 * Each scraper is isolated so a failure in one does not wipe the other's data.
 */
export async function buildAndStoreIndex(): Promise<BuildResult> {
  const errors: string[] = []

  const [gowinRes, sipeedRes] = await Promise.allSettled([scrapeGowin(), scrapeSipeed()])

  let gowinDocs: DocItem[] = []
  let sipeedDocs: DocItem[] = []

  if (gowinRes.status === "fulfilled") gowinDocs = gowinRes.value
  else errors.push(`gowin: ${String(gowinRes.reason)}`)

  if (sipeedRes.status === "fulfilled") sipeedDocs = sipeedRes.value
  else errors.push(`sipeed: ${String(sipeedRes.reason)}`)

  // If both scrapers failed, do not overwrite the existing snapshot.
  if (gowinDocs.length === 0 && sipeedDocs.length === 0) {
    return {
      ok: false,
      total: 0,
      gowin_total: 0,
      sipeed_total: 0,
      updated_at: nowBeijing(),
      errors: errors.length ? errors : ["both scrapers returned 0 documents"],
    }
  }

  const documents = [...gowinDocs, ...sipeedDocs]
  const index: IndexFile = {
    updated_at: nowBeijing(),
    total: documents.length,
    gowin_total: gowinDocs.length,
    sipeed_total: sipeedDocs.length,
    documents,
  }

  const blob = await put(INDEX_BLOB_PATH, JSON.stringify(index), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })

  invalidateIndexCache()

  return {
    ok: true,
    total: index.total,
    gowin_total: index.gowin_total,
    sipeed_total: index.sipeed_total,
    updated_at: index.updated_at,
    blob_url: blob.url,
    errors,
  }
}
