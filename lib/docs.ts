import indexData from "@/data/index.json"

export type DocItem = {
  title: string
  url: string
  doc_id: number | null
  category: string
  subcategory: string | null
  file_format: string
  access: "public" | "login_required" | "unknown"
  version: string | null
  doc_number: string | null
  chips: string[]
  product_line: string[]
  platform?: string[]
  year?: number
  source: "gowin" | "sipeed"
  is_gowin_platform?: boolean
  board?: string
  file_size?: string
  requires_netdisk?: boolean
}

type IndexFile = {
  updated_at: string
  total: number
  gowin_total: number
  sipeed_total: number
  documents: DocItem[]
}

const data = indexData as unknown as IndexFile

export const DOCS: DocItem[] = data.documents
export const META = {
  updatedAt: data.updated_at,
  total: data.total,
  gowinTotal: data.gowin_total,
  sipeedTotal: data.sipeed_total,
  publicTotal: DOCS.filter((d) => d.access === "public").length,
  loginTotal: DOCS.filter((d) => d.access === "login_required").length,
}

function countBy(getKeys: (d: DocItem) => string[]): [string, number][] {
  const map = new Map<string, number>()
  for (const d of DOCS) {
    for (const k of getKeys(d)) {
      if (!k) continue
      map.set(k, (map.get(k) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export const FACETS = {
  categories: countBy((d) => [d.subcategory ? `${d.category}/${d.subcategory}` : d.category]),
  chips: countBy((d) => d.chips ?? []),
  productLines: countBy((d) => d.product_line ?? []),
  formats: countBy((d) => [d.file_format]),
}

export type SearchParams = {
  q?: string
  category?: string
  chip?: string
  productLine?: string
  format?: string
  access?: string
  source?: string
  page?: number
  size?: number
}

export type SearchResult = {
  results: DocItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function searchDocs(p: SearchParams): SearchResult {
  let results = DOCS

  if (p.category) {
    const c = p.category.toLowerCase()
    results = results.filter((d) => {
      const full = (d.subcategory ? `${d.category}/${d.subcategory}` : d.category).toLowerCase()
      return d.category.toLowerCase() === c || (d.subcategory ?? "").toLowerCase() === c || full === c
    })
  }
  if (p.chip) {
    const c = p.chip.toUpperCase()
    results = results.filter((d) => (d.chips ?? []).some((x) => x.toUpperCase().includes(c)))
  }
  if (p.productLine) {
    const pl = p.productLine.toLowerCase()
    results = results.filter((d) => (d.product_line ?? []).some((x) => x.toLowerCase().includes(pl)))
  }
  if (p.format) {
    const f = p.format.toLowerCase()
    results = results.filter((d) => (d.file_format ?? "").toLowerCase() === f)
  }
  if (p.access) {
    results = results.filter((d) => d.access === p.access)
  }
  if (p.source) {
    results = results.filter((d) => d.source === p.source)
  }
  if (p.q) {
    const words = p.q.toLowerCase().split(/\s+/).filter(Boolean)
    results = results.filter((d) => {
      const hay = `${d.title} ${(d.chips ?? []).join(" ")} ${d.doc_number ?? ""}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }

  const total = results.length
  const pageSize = p.size ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, p.page ?? 1), totalPages)
  const start = (page - 1) * pageSize
  return {
    results: results.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  }
}
