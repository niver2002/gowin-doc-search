import * as cheerio from "cheerio"
import type { DocItem } from "@/lib/docs"

const BASE_URL = "https://www.gowinsemi.com/en"
const DOC_DB_URL = `${BASE_URL}/document/main/database`

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}

const FAMILY_MAP: Record<string, string> = {
  GW1N: "LittleBee",
  GW1NZ: "LittleBee",
  GW1NS: "LittleBee",
  GW1NSE: "LittleBee",
  GW1NR: "LittleBee",
  GW1NSER: "LittleBee",
  GW2A: "Arora",
  GW2AN: "Arora",
  GW2AR: "Arora",
  GW2ANR: "Arora",
  GW3A: "GW3A",
  GW5A: "Arora V",
  GW5AR: "Arora V",
  GW5AS: "Arora V",
  GW5AT: "Arora V",
  GW5ART: "Arora V",
  GW5AST: "Arora V",
  GWU2X: "GoBridge",
  GWU2U: "GoBridge",
}

function decode(url: string): string {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

function detectFileFormat(url: string): string {
  const u = decode(url).toLowerCase()
  const exts = ["pdf", "zip", "tar.gz", "gz", "bin", "docx", "doc", "dmg", "rar", "exe"]
  for (const ext of exts) {
    if (u.endsWith(`.${ext}`)) return ext === "gz" ? "tar.gz" : ext
  }
  const path = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  })()
  const m = path.match(/\.(\w+)$/)
  return m ? m[1].toLowerCase() : "unknown"
}

function detectAccessType(url: string): DocItem["access"] {
  if (url.includes("cdn.gowinsemi.com")) return "public"
  if (url.includes("chkLogin")) return "login_required"
  return "unknown"
}

function detectPlatform(title: string): string[] | undefined {
  const t = title.toLowerCase()
  const p: string[] = []
  if (t.includes("win") || t.includes("windows")) p.push("Windows")
  if (t.includes("linux")) p.push("Linux")
  if (t.includes("macos") || t.includes("mac os") || t.includes(".dmg")) p.push("macOS")
  return p.length ? p : undefined
}

function extractVersion(title: string): string | null {
  const v = title.match(/[Vv](\d+\.\d+(?:\.\d+)?(?:\.\d+)?(?:\s*Beta)?)/)
  if (v) return v[1].trim()
  const dv = title.match(/[A-Z]+\d+-(\d+\.\d+(?:\.\d+)?)/)
  if (dv) return dv[1]
  return null
}

function extractDocNumber(title: string): string | null {
  const m = title.toUpperCase().match(/\b(UG|DS|IPUG|SUG|TN|AN|WM)(\d+)E?\b/)
  if (m) return `${m[1]}${m[2]}`
  const g = title.match(/(GPCN-\d{4}-\w+)/)
  if (g) return g[1]
  return null
}

function extractYear(title: string): number | undefined {
  const y = title.match(/GPCN-(\d{4})/)
  if (y) return Number(y[1])
  const y2 = title.match(/\b(20\d{2})(?:0[4-9]|1[0-2]|0[1-3])\d{3}\b/)
  if (y2) return Number(y2[1])
  return undefined
}

function extractProductFamilies(title: string): { chips: string[]; product_line: string[] } {
  const families = new Set<string>()
  const chips = new Set<string>()
  const gw = title.match(/GW\d+[A-Z]*(?:[-]\w+)?/gi) ?? []
  for (const m of gw) {
    const base = m.toUpperCase().match(/(GW\d+[A-Z]*)/)
    if (base) {
      const chip = base[1]
      chips.add(chip)
      for (const prefix of Object.keys(FAMILY_MAP).sort((a, b) => b.length - a.length)) {
        if (chip.startsWith(prefix)) {
          families.add(FAMILY_MAP[prefix])
          break
        }
      }
    }
  }
  const t = title.toLowerCase()
  if (t.includes("littlebee")) families.add("LittleBee")
  if (t.includes("arora v") || t.includes("arora_v")) families.add("Arora V")
  else if (t.includes("arora")) families.add("Arora")
  return {
    chips: [...chips].sort(),
    product_line: [...families].sort(),
  }
}

function classifyDocument(title: string, fmt: string): [string, string | null] {
  const t = title.toLowerCase()
  if (
    t.includes("gowin") &&
    (t.includes("eda") || t.includes("v1.9") || t.includes("v1.8") || t.includes("v2.")) &&
    ["zip", "tar.gz", "dmg", "rar", "exe"].includes(fmt)
  )
    return ["Software", "EDA"]
  if (t.includes("programmer") && fmt === "bin") return ["Firmware", "Programmer"]
  if (t.includes("license server") || t.includes("license_server")) return ["Software", "License"]
  if (t.includes("securefpga") && fmt === "zip") return ["Software", "SecureFPGA"]
  if (t.includes("sdk") && (t.includes("release note") || t.includes("releasenote"))) return ["ReleaseNote", "SDK"]
  if (t.includes("sdk")) return ["SDK", null]
  if (t.includes("gpcn") || t.includes("product change") || t.includes("design advisory")) return ["Advisory", "PCN"]
  if (t.includes("discontinu")) return ["Advisory", "EOL"]
  if (t.includes("voltage range change") || t.includes("upgraded") || t.includes("version upgraded"))
    return ["Advisory", "Upgrade"]
  if (t.includes("refdesign") || t.includes("ref_design") || t.includes("reference design")) return ["ReferenceDesign", null]
  if (t.includes("ref design")) return ["ReferenceDesign", null]
  if (/\bsch\b/.test(t) || t.includes("schematic")) return ["Schematic", null]
  if (t.includes("development board")) return ["DevBoard", "UserGuide"]
  if (/^dk[-_]/.test(t)) {
    if (t.includes("sch")) return ["Schematic", null]
    return ["DevBoard", null]
  }
  if (t.includes("certificate") || t.includes("iso26262") || t.includes("iec61508")) {
    if (fmt === "pdf") return ["Certificate", null]
  }
  if (t.includes("data sheet") || t.includes("datasheet")) return ["DataSheet", null]
  if (t.includes("errata")) return ["Errata", null]
  if (t.includes("package") && t.includes("pinout")) return ["PackagePinout", null]
  if (t.includes("user guide") || t.includes("user's guide")) {
    if (t.includes("ip ") || t.startsWith("gowin ")) return ["UserGuide", "IP"]
    return ["UserGuide", null]
  }
  if (t.includes("ip user guide") || t.includes("ip core")) return ["UserGuide", "IP"]
  if (t.includes("application note")) return ["AppNote", null]
  if (t.includes("quick start")) return ["QuickStart", null]
  if (t.includes("reference manual") || t.includes("hardware design")) return ["Reference", null]
  if (t.includes("release note")) return ["ReleaseNote", null]
  if (t.includes("introduction")) return ["Introduction", null]
  if (t.includes("compatibility") || t.includes("comparison")) return ["Reference", "Compatibility"]
  if (["zip", "tar.gz", "dmg"].includes(fmt) && t.includes("gowin")) return ["Software", null]
  if (fmt === "pdf") return ["Document", null]
  if (["zip", "tar.gz"].includes(fmt)) return ["Package", null]
  if (fmt === "bin") return ["Firmware", null]
  return ["Other", null]
}

async function fetchPage(url: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
      if (resp.ok) return await resp.text()
    } catch {
      // retry
    }
    if (i < retries) await new Promise((r) => setTimeout(r, (i + 1) * 1000))
  }
  throw new Error(`fetch failed: ${url}`)
}

function getTotalPages(html: string): number {
  const $ = cheerio.load(html)
  let max = 1
  $("a[href*='page=']").each((_, el) => {
    const m = ($(el).attr("href") ?? "").match(/page=(\d+)/)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return max
}

function parsePage(html: string): DocItem[] {
  const $ = cheerio.load(html)
  const docs: DocItem[] = []
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const title = $(el).text().trim()
    if (!href || !title) return
    if (!/chkLogin|cdn\.gowinsemi|database_doc/.test(href)) return
    if (/^\d+$/.test(title) || ["Select All", "Deselect All", "..."].includes(title)) return
    if (/^[\d.]+$/.test(title)) return

    let fullUrl: string
    if (href.startsWith("/")) fullUrl = `https://www.gowinsemi.com${href}`
    else if (!href.startsWith("http")) fullUrl = new URL(href, BASE_URL).href
    else fullUrl = href

    const docIdMatch = href.match(/database_doc[/%]2[fF](\d+)/)
    const docId = docIdMatch ? Number(docIdMatch[1]) : null

    const fileFormat = detectFileFormat(fullUrl)
    const access = detectAccessType(fullUrl)
    const platform = detectPlatform(title)
    const version = extractVersion(title)
    const docNumber = extractDocNumber(title)
    const year = extractYear(title)
    const families = extractProductFamilies(title)
    const [category, subcategory] = classifyDocument(title, fileFormat)

    const entry: DocItem = {
      title,
      url: fullUrl,
      doc_id: docId,
      category,
      subcategory,
      file_format: fileFormat,
      access,
      version,
      doc_number: docNumber,
      chips: families.chips,
      product_line: families.product_line,
      source: "gowin",
    }
    if (platform) entry.platform = platform
    if (year) entry.year = year
    docs.push(entry)
  })
  return docs
}

export async function scrapeGowin(): Promise<DocItem[]> {
  const firstHtml = await fetchPage(DOC_DB_URL)
  const totalPages = getTotalPages(firstHtml)
  const all: DocItem[] = parsePage(firstHtml)

  for (let page = 2; page <= totalPages; page++) {
    try {
      const html = await fetchPage(`${DOC_DB_URL}?page=${page}`)
      all.push(...parsePage(html))
    } catch {
      // skip failed page
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  // de-dup by url
  const seen = new Set<string>()
  return all.filter((d) => {
    if (seen.has(d.url)) return false
    seen.add(d.url)
    return true
  })
}
