import "server-only"
import { get } from "@vercel/blob"
import staticIndex from "@/data/index.json"
import type { IndexFile } from "@/lib/docs"

export const INDEX_BLOB_PATH = "index/docs-index.json"

const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = { data: IndexFile; at: number }
let cache: CacheEntry | null = null

const STATIC: IndexFile = staticIndex as unknown as IndexFile

/**
 * Load the document index. Prefers the latest snapshot written to Vercel Blob
 * by the cron scraper; falls back to the static index bundled at build time.
 * Results are cached in memory for a few minutes to avoid refetching per request.
 */
export async function loadIndex(): Promise<IndexFile> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const result = await get(INDEX_BLOB_PATH, { access: "private", useCache: false })
      if (result?.stream) {
        const text = await new Response(result.stream).text()
        const data = JSON.parse(text) as IndexFile
        if (data?.documents?.length) {
          cache = { data, at: Date.now() }
          return data
        }
      }
    } catch (err) {
      console.error("[index-store] Blob load failed, falling back to static:", err)
    }
  }

  cache = { data: STATIC, at: Date.now() }
  return STATIC
}

/** Invalidate the in-memory cache (called right after a fresh scrape writes new data). */
export function invalidateIndexCache() {
  cache = null
}
