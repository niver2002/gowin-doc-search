import type { DocItem } from "@/lib/docs"

const SIPEED_API = "https://api.dl.sipeed.com/fileList"
const SIPEED_DL = "https://dl.sipeed.com"
const SIPEED_SHARE = "https://dl.sipeed.com/shareURL"
const LARGE_FILE_THRESHOLD_MB = 10

type BoardInfo = { chip: string; product_line: string; series: string }

const GOWIN_BOARDS: Record<string, BoardInfo> = {
  Nano: { chip: "GW1N-1", product_line: "LittleBee", series: "Tang Nano" },
  "Nano 1K": { chip: "GW1NZ-1", product_line: "LittleBee", series: "Tang Nano" },
  "Nano 4K": { chip: "GW1NSR-4C", product_line: "LittleBee", series: "Tang Nano" },
  "Nano 9K": { chip: "GW1NR-9", product_line: "LittleBee", series: "Tang Nano" },
  Nano_20K: { chip: "GW2AR-18", product_line: "Arora", series: "Tang Nano" },
  Primer: { chip: "GW2A-18", product_line: "Arora", series: "Tang Primer" },
  Premier: { chip: "GW2A-18", product_line: "Arora", series: "Tang Primer" },
  Primer_20K: { chip: "GW2A-18", product_line: "Arora", series: "Tang Primer" },
  Primer_25K: { chip: "GW5A-25", product_line: "Arora V", series: "Tang Primer" },
  Console: { chip: "GW5A-138", product_line: "Arora V", series: "Tang Console" },
  Mega_138K_60K: { chip: "GW5A-138", product_line: "Arora V", series: "Tang Mega" },
  Mega_138K_Pro: { chip: "GW5A-138", product_line: "Arora V", series: "Tang Mega" },
}

const GOWIN_TOOL_DIRS = new Set(["gowin_ide", "programmer"])
const NON_GOWIN_DIRS = new Set(["Debugger", "PMOD", "reserve", "Hex"])

const CHIP_PATTERN = /\b(GW[125][A-Z0-9]{1,6}(?:-[A-Z0-9]+)?)\b/gi

const CHIP_TO_PRODUCT_LINE: Record<string, string> = {
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
  GW5A: "Arora V",
  GW5AR: "Arora V",
  GW5AS: "Arora V",
  GW5AT: "Arora V",
  GW5ART: "Arora V",
  GW5AST: "Arora V",
}

const CATEGORY_PATTERNS: [RegExp, string, string | null][] = [
  [/(?:^|\d+_?)Specification/i, "DataSheet", null],
  [/(?:^|\d+_?)Datasheet/i, "DataSheet", null],
  [/(?:^|\d+_?)Spec$/i, "DataSheet", null],
  [/(?:^|\d+_?)Schematic/i, "Schematic", null],
  [/(?:^|\d+_?)(?:Bit_number_map|Pinout|Pin_?map|Pin_?Length)/i, "PackagePinout", null],
  [/(?:^|\d+_?)(?:Dimensional|Mechanical|Drawing|Dimensions)/i, "Reference", "Mechanical"],
  [/(?:^|\d+_?)(?:3D_?file|3D_?model|STEP)/i, "Reference", "3DModel"],
  [/(?:^|\d+_?)(?:Chip_?Manual|Chip_?Doc|Gowin_?manual)/i, "DataSheet", "Chip"],
  [/(?:^|\d+_?)(?:toolchain|Tools?)/i, "Software", "Toolchain"],
  [/(?:^|\d+_?)(?:Firmware|MCU_?FW)/i, "Firmware", null],
  [/(?:^|\d+_?)Driver/i, "Software", "Driver"],
  [/(?:^|\d+_?)(?:Example|Demo|Design|Nestang)/i, "ReferenceDesign", null],
  [/(?:^|\d+_?)(?:Manual|Guide|User)/i, "UserGuide", null],
  [/(?:^|\d+_?)(?:SDK|Software)/i, "SDK", null],
  [/(?:^|\d+_?)(?:Release|Note)/i, "ReleaseNote", null],
  [/(?:^|\d+_?)(?:Image|Photo|Picture)/i, "Reference", "Image"],
  [/(?:^|\d+_?)(?:BOM|Assembly)/i, "Reference", "BOM"],
  [/(?:^|\d+_?)(?:PCB|Layout|Gerber|Net_?Length|Footprint)/i, "Reference", "PCB"],
  [/(?:^|\d+_?)(?:IDE|EDA|gowin_?ide)/i, "Software", "EDA"],
  [/(?:^|\d+_?)(?:HDK|Hardware)/i, "Reference", "HDK"],
  [/(?:^|\d+_?)(?:vmware|VM|virtual)/i, "Software", "VM"],
  [/(?:^|\d+_?)(?:Misc|misc)/i, "Other", "Misc"],
]

const FILENAME_CATEGORY_PATTERNS: [RegExp, string, string | null][] = [
  [/schematic|\.sch\b/i, "Schematic", null],
  [/datasheet|specification/i, "DataSheet", null],
  [/user.?guide|manual/i, "UserGuide", null],
  [/pinout|pin.?map|pin.?mux/i, "PackagePinout", null],
  [/ibom|bom/i, "Reference", "BOM"],
  [/gerber/i, "Reference", "PCB"],
  [/\.step$|\.stp$|\.3ds$/i, "Reference", "3DModel"],
  [/\.dxf$|dimensional|drawing/i, "Reference", "Mechanical"],
  [/firmware|\.bin$|\.hex$/i, "Firmware", null],
  [/driver/i, "Software", "Driver"],
  [/release.?note/i, "ReleaseNote", null],
  [/example|demo|ref.?design/i, "ReferenceDesign", null],
]

function parseFileSizeMb(size: string): number {
  if (!size || size === "-") return 0
  const s = size.trim().toUpperCase()
  try {
    if (s.includes("GB")) return Number.parseFloat(s.replace("GB", "").trim()) * 1024
    if (s.includes("MB")) return Number.parseFloat(s.replace("MB", "").trim())
    if (s.includes("KB")) return Number.parseFloat(s.replace("KB", "").trim()) / 1024
    if (s.includes("B")) return Number.parseFloat(s.replace("B", "").trim()) / (1024 * 1024)
  } catch {
    // ignore
  }
  return 0
}

function quotePath(p: string): string {
  return p
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")
}

function makeDownloadUrl(fileUrl: string, fileSize: string): [string, boolean] {
  const sizeMb = parseFileSizeMb(fileSize)
  if (sizeMb >= LARGE_FILE_THRESHOLD_MB) {
    return [`${SIPEED_SHARE}/${quotePath(fileUrl)}`, true]
  }
  return [`${SIPEED_DL}/${quotePath(fileUrl)}`, false]
}

function detectFileFormat(filename: string): string {
  const lower = filename.toLowerCase()
  const exts = [
    ".tar.gz", ".pdf", ".zip", ".rar", ".bin", ".hex", ".doc", ".docx", ".html",
    ".step", ".stp", ".dxf", ".brd", ".png", ".jpg", ".jpeg", ".exe", ".dmg", ".txt",
  ]
  for (const ext of exts) {
    if (lower.endsWith(ext)) return ext.replace(/^\./, "")
  }
  const m = lower.match(/\.(\w+)$/)
  return m ? m[1] : "unknown"
}

function extractBoardName(path: string): string {
  const parts = path.replace("TANG/", "").split("/")
  return parts[0] ?? "Unknown"
}

function isGowinPlatform(board: string, filePath: string, fileName: string): boolean {
  if (board in GOWIN_BOARDS) return true
  if (GOWIN_TOOL_DIRS.has(board)) return true
  if (NON_GOWIN_DIRS.has(board)) return false
  CHIP_PATTERN.lastIndex = 0
  if (CHIP_PATTERN.test(fileName) || (CHIP_PATTERN.lastIndex = 0, CHIP_PATTERN.test(filePath))) return true
  if (filePath.toLowerCase().includes("gowin") || fileName.toLowerCase().includes("gowin")) return true
  return false
}

function extractChipsFromText(text: string): string[] {
  const chips = new Set<string>()
  const ascii = text.replace(/[^\x00-\x7F]+/g, " ")
  const matches = ascii.match(CHIP_PATTERN) ?? []
  for (const raw of matches) {
    let chip = raw.toUpperCase().replace(/^[-_]+|[-_]+$/g, "")
    if (chip.length < 4) continue
    if (/(DATASHEET|SCH|BRD|TOP|BOT|PCB|3D|REFDSIGN|REF)/i.test(chip)) continue
    chip = chip.replace(/[-_]V\d+.*$/, "")
    chips.add(chip)
  }
  return [...chips]
}

function getProductLineForChip(chip: string): string | null {
  const up = chip.toUpperCase()
  for (const prefix of Object.keys(CHIP_TO_PRODUCT_LINE).sort((a, b) => b.length - a.length)) {
    if (up.startsWith(prefix)) return CHIP_TO_PRODUCT_LINE[prefix]
  }
  return null
}

function classifyByPath(path: string): [string | null, string | null] {
  for (const part of path.split("/")) {
    for (const [pat, cat, sub] of CATEGORY_PATTERNS) {
      if (pat.test(part)) return [cat, sub]
    }
  }
  return [null, null]
}

function classifyByFilename(filename: string): [string | null, string | null] {
  for (const [pat, cat, sub] of FILENAME_CATEGORY_PATTERNS) {
    if (pat.test(filename)) return [cat, sub]
  }
  return [null, null]
}

function extractVersion(filename: string): string | null {
  const m = filename.match(/[Vv](\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/)
  return m ? m[1] : null
}

function detectPlatformOs(filename: string): string[] {
  const p: string[] = []
  const lower = filename.toLowerCase()
  if (lower.includes("win") || lower.includes("windows") || lower.endsWith(".exe")) p.push("Windows")
  if (lower.includes("linux") || lower.includes("ubuntu")) p.push("Linux")
  if (lower.includes("mac") || lower.includes("darwin") || lower.endsWith(".dmg")) p.push("macOS")
  return p
}

type ApiItem = {
  file_name: string
  file_url: string
  file_type: number
  file_size?: string
  last_update?: string
}

async function listDir(path: string, retries = 2): Promise<ApiItem[]> {
  const url = `${SIPEED_API}/${quotePath(path)}`
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (resp.ok) {
        const data = await resp.json()
        if (data.code === 0) return data.data ?? []
      }
      return []
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 300))
    }
  }
  return []
}

function buildEntry(item: ApiItem): DocItem {
  const name = item.file_name
  const fileUrl = item.file_url
  const fileSize = item.file_size ?? "-"
  const board = extractBoardName(fileUrl)
  const gowin = isGowinPlatform(board, fileUrl, name)

  let [category, subcategory] = classifyByPath(fileUrl)
  if (!category) [category, subcategory] = classifyByFilename(name)
  if (!category) {
    category = "Other"
    subcategory = null
  }

  let chips: string[] = []
  let productLines: string[] = []

  if (gowin) {
    const info = GOWIN_BOARDS[board]
    if (info) {
      chips = [info.chip]
      productLines = [info.product_line]
    }
    for (const c of extractChipsFromText(`${name} ${fileUrl}`)) {
      if (!chips.includes(c)) {
        chips.push(c)
        const pl = getProductLineForChip(c)
        if (pl && !productLines.includes(pl)) productLines.push(pl)
      }
    }
    if (GOWIN_TOOL_DIRS.has(board) && category === "Other") {
      category = "Software"
      subcategory = board.toLowerCase().includes("ide") ? "EDA" : null
    }
  } else {
    category = "Other"
    subcategory = board
  }

  const fileFormat = detectFileFormat(name)
  const version = extractVersion(name)
  const platforms = detectPlatformOs(name)
  const [downloadUrl, requiresNetdisk] = makeDownloadUrl(fileUrl, fileSize)

  return {
    title: name,
    url: downloadUrl,
    doc_id: null,
    category,
    subcategory,
    file_format: fileFormat,
    access: "public",
    version,
    doc_number: null,
    chips,
    product_line: productLines.length ? productLines : ["Sipeed"],
    platform: platforms,
    source: "sipeed",
    is_gowin_platform: gowin,
    board,
    file_size: fileSize,
    requires_netdisk: requiresNetdisk,
  }
}

async function crawl(path: string, docs: DocItem[], depth = 0, maxDepth = 6): Promise<void> {
  if (depth > maxDepth) return
  const items = await listDir(path)
  const subdirs: string[] = []
  for (const item of items) {
    if (item.file_type === 0) subdirs.push(item.file_url)
    else if (item.file_type === 1) docs.push(buildEntry(item))
  }
  // limited concurrency over subdirs
  const CONCURRENCY = 8
  for (let i = 0; i < subdirs.length; i += CONCURRENCY) {
    const batch = subdirs.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((sd) => crawl(sd, docs, depth + 1, maxDepth)))
  }
}

export async function scrapeSipeed(): Promise<DocItem[]> {
  const docs: DocItem[] = []
  await crawl("TANG", docs)
  return docs
}
