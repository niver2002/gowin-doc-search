import { buildFacets, buildMeta } from "@/lib/docs"
import { loadIndex } from "@/lib/index-store"
import { SearchExplorer } from "@/components/search-explorer"
import { GowinAuthProvider } from "@/components/gowin-auth"
import { LoginDialog } from "@/components/login-dialog"
import { AuthButton } from "@/components/auth-button"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const index = await loadIndex()
  const META = buildMeta(index)
  const FACETS = buildFacets(index.documents)

  return (
    <GowinAuthProvider>
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-4 flex justify-end">
          <AuthButton />
        </div>
        <header className="mb-8 text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            高云半导体文档检索
          </h1>
          <p className="mt-2 text-pretty text-muted">
            统一检索 Gowin 官方与 Sipeed TANG 的数据手册、软件、开发板与参考资料
          </p>
          <p className="mt-1 text-sm text-muted">
            共 {META.total} 篇（高云 {META.gowinTotal} / Sipeed {META.sipeedTotal} · 公开 {META.publicTotal} / 需登录{" "}
            {META.loginTotal}） · 索引更新 {META.updatedAt}
          </p>
        </header>

      <details className="mb-6 rounded-[var(--radius)] border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        <summary className="cursor-pointer font-medium">
          关于「需登录」文档与「网盘下载」大文件的说明
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            <strong>需登录文档：</strong>高云官网（gowinsemi.com）下载需带图形验证码登录。点击右上角「登录高云账号」，已为你预填公共账号，只需<strong>输入验证码（区分大小写）</strong>即可登录。登录后「需登录」文档会变为可直接下载（经本站代理拉取，无需再跳官网）。公开（CDN）文档与 Sipeed 资料始终可直接下载。
          </p>
          <p>
            <strong>网盘下载：</strong>Sipeed 对超过 10MB 的大文件（如 Gowin IDE 安装包）不提供 HTTP 直链，需通过其分享页跳转到百度网盘 / Mega 下载。标有「网盘下载」的条目点击后会打开 Sipeed 官方分享页，内含网盘链接（百度网盘提取码通常随页面给出）。
          </p>
        </div>
      </details>

      <SearchExplorer facets={FACETS} />

        <footer className="mt-12 text-center text-xs text-muted">
          数据来源：gowinsemi.com 与 dl.sipeed.com · 本站仅做检索聚合，版权归原厂所有
        </footer>
      </main>
      <LoginDialog />
    </GowinAuthProvider>
  )
}
