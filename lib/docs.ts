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

export type IndexFile = {
  updated_at: string
  total: number
  gowin_total: number
  sipeed_total: number
  documents: DocItem[]
}

export type Meta = {
  updatedAt: string
  total: number
  gowinTotal: number
  sipeedTotal: number
  publicTotal: number
  loginTotal: number
}

export type Facets = {
  categories: [string, number][]
  chips: [string, number][]
  productLines: [string, number][]
  formats: [string, number][]
}

export function buildMeta(data: IndexFile): Meta {
  const docs = data.documents
  return {
    updatedAt: data.updated_at,
    total: data.total ?? docs.length,
    gowinTotal: data.gowin_total ?? docs.filter((d) => d.source === "gowin").length,
    sipeedTotal: data.sipeed_total ?? docs.filter((d) => d.source === "sipeed").length,
    publicTotal: docs.filter((d) => d.access === "public").length,
    loginTotal: docs.filter((d) => d.access === "login_required").length,
  }
}

function countBy(docs: DocItem[], getKeys: (d: DocItem) => string[]): [string, number][] {
  const map = new Map<string, number>()
  for (const d of docs) {
    for (const k of getKeys(d)) {
      if (!k) continue
      map.set(k, (map.get(k) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export function buildFacets(docs: DocItem[]): Facets {
  return {
    categories: countBy(docs, (d) => [d.subcategory ? `${d.category}/${d.subcategory}` : d.category]),
    chips: countBy(docs, (d) => d.chips ?? []),
    productLines: countBy(docs, (d) => d.product_line ?? []),
    formats: countBy(docs, (d) => [d.file_format]),
  }
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

export function searchDocs(docs: DocItem[], p: SearchParams): SearchResult {
  let results = docs

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
