import { NextResponse } from "next/server"
import { searchDocs } from "@/lib/docs"
import { loadIndex } from "@/lib/index-store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const index = await loadIndex()
  const result = searchDocs(index.documents, {
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    chip: searchParams.get("chip") ?? undefined,
    productLine: searchParams.get("product_line") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    access: searchParams.get("access") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
    size: Number(searchParams.get("size") ?? "20"),
  })
  return NextResponse.json(result)
}
