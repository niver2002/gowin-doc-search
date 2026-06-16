"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DocItem } from "@/lib/docs"
import { categoryLabel } from "@/lib/labels"
import { DocCard } from "@/components/doc-card"

type Facets = {
  categories: [string, number][]
  chips: [string, number][]
  productLines: [string, number][]
  formats: [string, number][]
}

type Filters = {
  q: string
  category: string
  chip: string
  product_line: string
  format: string
  access: string
  source: string
}

const EMPTY: Filters = {
  q: "",
  category: "",
  chip: "",
  product_line: "",
  format: "",
  access: "",
  source: "",
}

const PAGE_SIZE = 20

function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {children}
    </select>
  )
}

export function SearchExplorer({ facets }: { facets: Facets }) {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{
    results: DocItem[]
    total: number
    totalPages: number
  }>({ results: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (f.q) params.set("q", f.q)
    if (f.category) params.set("category", f.category)
    if (f.chip) params.set("chip", f.chip)
    if (f.product_line) params.set("product_line", f.product_line)
    if (f.format) params.set("format", f.format)
    if (f.access) params.set("access", f.access)
    if (f.source) params.set("source", f.source)
    params.set("page", String(p))
    params.set("size", String(PAGE_SIZE))
    try {
      const resp = await fetch(`/api/search?${params.toString()}`)
      const json = await resp.json()
      setData({ results: json.results, total: json.total, totalPages: json.totalPages })
    } catch {
      setData({ results: [], total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced fetch whenever filters change (resets to page 1)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchResults(filters, 1)
    }, 220)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const goToPage = (p: number) => {
    setPage(p)
    fetchResults(filters, p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const update = (key: keyof Filters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }))
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <section className="mb-6 rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="搜索关键词：DDR3、GW5A、User Guide、EDA、MIPI…"
            aria-label="搜索关键词"
            autoFocus
            className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Select label="分类" value={filters.category} onChange={(v) => update("category", v)}>
            <option value="">所有分类</option>
            {facets.categories.map(([key, count]) => (
              <option key={key} value={key}>
                {categoryLabel(key)} ({count})
              </option>
            ))}
          </Select>
          <Select label="芯片" value={filters.chip} onChange={(v) => update("chip", v)}>
            <option value="">所有芯片</option>
            {facets.chips.map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </Select>
          <Select label="产品线" value={filters.product_line} onChange={(v) => update("product_line", v)}>
            <option value="">所有产品线</option>
            {facets.productLines.map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </Select>
          <Select label="格式" value={filters.format} onChange={(v) => update("format", v)}>
            <option value="">所有格式</option>
            {facets.formats.map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </Select>
          <Select label="访问类型" value={filters.access} onChange={(v) => update("access", v)}>
            <option value="">所有访问类型</option>
            <option value="public">公开</option>
            <option value="login_required">需登录</option>
          </Select>
          <Select label="来源" value={filters.source} onChange={(v) => update("source", v)}>
            <option value="">所有来源</option>
            <option value="gowin">高云官方</option>
            <option value="sipeed">Sipeed</option>
          </Select>
          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY)}
              className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-red-500"
            >
              清除筛选
            </button>
          )}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between px-1 text-sm text-muted">
        <span>
          {loading ? "搜索中…" : `找到 ${data.total} 条结果`}
          {filters.access === "login_required" && !loading && data.total > 0 && (
            <span className="ml-1 text-yellow-700">（需在高云官网登录后下载）</span>
          )}
        </span>
        {data.totalPages > 1 && (
          <span>
            第 {page}/{data.totalPages} 页
          </span>
        )}
      </div>

      <div className="space-y-2">
        {!loading && data.results.length === 0 ? (
          <div className="py-16 text-center text-muted">没有找到匹配的文档</div>
        ) : (
          data.results.map((doc, i) => (
            <DocCard
              key={`${doc.url}-${i}`}
              doc={doc}
              index={(page - 1) * PAGE_SIZE + i + 1}
              query={filters.q}
            />
          ))
        )}
      </div>

      {data.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-4" aria-label="分页">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition hover:bg-background disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-muted">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= data.totalPages}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition hover:bg-background disabled:opacity-40"
          >
            下一页
          </button>
        </nav>
      )}
    </>
  )
}
