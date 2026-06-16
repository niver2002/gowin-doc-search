import type { DocItem } from "@/lib/docs"
import { categoryClass, categoryLabel } from "@/lib/labels"

function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none ${className ?? ""}`}
    >
      {children}
    </span>
  )
}

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (words.length === 0) return text
  const regex = new RegExp(`(${words.join("|")})`, "gi")
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
  )
}

export function DocCard({ doc, index, query }: { doc: DocItem; index: number; query: string }) {
  const catCls = categoryClass(doc.category)
  const catLabel = categoryLabel(doc.subcategory ? `${doc.category}/${doc.subcategory}` : doc.category)
  const isLogin = doc.access === "login_required"
  const isNetdisk = doc.requires_netdisk === true

  return (
    <article className="rounded-[var(--radius)] border border-border bg-card p-4 transition hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className="w-8 flex-shrink-0 pt-0.5 text-right font-mono text-xs text-muted">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            {doc.source === "sipeed" ? (
              <Tag className="bg-orange-50 text-orange-700">Sipeed</Tag>
            ) : (
              <Tag className="bg-blue-50 text-blue-700">高云</Tag>
            )}
            <Tag className={catCls}>{catLabel}</Tag>
            {isLogin ? (
              <Tag className="bg-yellow-100 text-yellow-800">需登录</Tag>
            ) : (
              <Tag className="bg-green-50 text-green-700">公开</Tag>
            )}
            {isNetdisk && <Tag className="bg-purple-50 text-purple-700">网盘下载</Tag>}
            <Tag className="bg-slate-100 text-slate-500">{doc.file_format}</Tag>
            {doc.version && <Tag className="bg-slate-100 text-slate-500">v{doc.version}</Tag>}
            {(doc.chips ?? []).slice(0, 4).map((c) => (
              <Tag key={c} className="bg-slate-100 text-slate-600">
                {c}
              </Tag>
            ))}
            {(doc.platform ?? []).map((p) => (
              <Tag key={p} className="bg-cyan-50 text-cyan-700">
                {p}
              </Tag>
            ))}
            {doc.file_size && doc.file_size !== "-" && (
              <Tag className="bg-slate-100 text-slate-500">{doc.file_size}</Tag>
            )}
          </div>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-medium text-foreground transition hover:text-primary"
            title={doc.title}
          >
            {highlight(doc.title, query)}
          </a>
          {doc.doc_number && <span className="mt-0.5 block text-xs text-muted">{doc.doc_number}</span>}
        </div>
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 whitespace-nowrap rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          {isLogin ? "前往" : isNetdisk ? "网盘" : "下载"}
        </a>
      </div>
    </article>
  )
}
