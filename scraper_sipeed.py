"""
Sipeed 下载站文档抓取器 v2
- 递归遍历 https://dl.sipeed.com/ 的 TANG 目录
- 智能识别高云平台 vs 非高云平台
- 高云平台文档纳入统一分类体系（芯片/产品线与 Gowin 官方一致）
- 非高云平台 → 归入 "Other"
- 自适应新增文件：从文件名/路径自动提取芯片型号
"""

import json
import time
import re
import sys
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

SIPEED_API = "https://api.dl.sipeed.com/fileList"
SIPEED_DL = "https://dl.sipeed.com"
SIPEED_SHARE = "https://dl.sipeed.com/shareURL"
INDEX_FILE = Path(__file__).parent / "sipeed_index.json"
LARGE_FILE_THRESHOLD_MB = 10

# ============================================================
# 板卡 → 芯片 + 产品线 映射（已知高云平台板卡）
# ============================================================
GOWIN_BOARDS = {
    "Nano": {"chip": "GW1N-1", "product_line": "LittleBee", "series": "Tang Nano"},
    "Nano 1K": {"chip": "GW1NZ-1", "product_line": "LittleBee", "series": "Tang Nano"},
    "Nano 4K": {"chip": "GW1NSR-4C", "product_line": "LittleBee", "series": "Tang Nano"},
    "Nano 9K": {"chip": "GW1NR-9", "product_line": "LittleBee", "series": "Tang Nano"},
    "Nano_20K": {"chip": "GW2AR-18", "product_line": "Arora", "series": "Tang Nano"},
    "Primer": {"chip": "GW2A-18", "product_line": "Arora", "series": "Tang Primer"},
    "Premier": {"chip": "GW2A-18", "product_line": "Arora", "series": "Tang Primer"},
    "Primer_20K": {"chip": "GW2A-18", "product_line": "Arora", "series": "Tang Primer"},
    "Primer_25K": {"chip": "GW5A-25", "product_line": "Arora V", "series": "Tang Primer"},
    "Console": {"chip": "GW5A-138", "product_line": "Arora V", "series": "Tang Console"},
    "Mega_138K_60K": {"chip": "GW5A-138", "product_line": "Arora V", "series": "Tang Mega"},
    "Mega_138K_Pro": {"chip": "GW5A-138", "product_line": "Arora V", "series": "Tang Mega"},
}

# 已知高云平台工具目录
GOWIN_TOOL_DIRS = {"gowin_ide", "programmer"}

# 已知非高云平台目录（外设、调试器等）
NON_GOWIN_DIRS = {"Debugger", "PMOD", "reserve", "Hex"}

# ============================================================
# 芯片型号正则（从文件名自动识别）
# 只匹配英文数字组成的型号，避免拾取中文
# ============================================================
CHIP_PATTERN = re.compile(
    r"\b(GW[125][A-Z0-9]{1,6}(?:-[A-Z0-9]+)?)\b",
    re.IGNORECASE
)

# 产品线反查
CHIP_TO_PRODUCT_LINE = {
    "GW1N": "LittleBee",
    "GW1NZ": "LittleBee",
    "GW1NS": "LittleBee",
    "GW1NSE": "LittleBee",
    "GW1NR": "LittleBee",
    "GW1NSER": "LittleBee",
    "GW2A": "Arora",
    "GW2AN": "Arora",
    "GW2AR": "Arora",
    "GW2ANR": "Arora",
    "GW5A": "Arora V",
    "GW5AR": "Arora V",
    "GW5AS": "Arora V",
    "GW5AT": "Arora V",
    "GW5ART": "Arora V",
    "GW5AST": "Arora V",
}

# ============================================================
# 目录名 → 分类映射（编号前缀自适应）
# ============================================================
CATEGORY_PATTERNS = [
    (re.compile(r"(?:^|\d+_?)Specification", re.I), "DataSheet", None),
    (re.compile(r"(?:^|\d+_?)Datasheet", re.I), "DataSheet", None),
    (re.compile(r"(?:^|\d+_?)Spec$", re.I), "DataSheet", None),
    (re.compile(r"(?:^|\d+_?)Schematic", re.I), "Schematic", None),
    (re.compile(r"(?:^|\d+_?)(?:Bit_number_map|Pinout|Pin_?map|Pin_?Length)", re.I), "PackagePinout", None),
    (re.compile(r"(?:^|\d+_?)(?:Dimensional|Mechanical|Drawing|Dimensions)", re.I), "Reference", "Mechanical"),
    (re.compile(r"(?:^|\d+_?)(?:3D_?file|3D_?model|STEP)", re.I), "Reference", "3DModel"),
    (re.compile(r"(?:^|\d+_?)(?:Chip_?Manual|Chip_?Doc|Gowin_?manual)", re.I), "DataSheet", "Chip"),
    (re.compile(r"(?:^|\d+_?)(?:toolchain|Tools?)", re.I), "Software", "Toolchain"),
    (re.compile(r"(?:^|\d+_?)(?:Firmware|MCU_?FW)", re.I), "Firmware", None),
    (re.compile(r"(?:^|\d+_?)Driver", re.I), "Software", "Driver"),
    (re.compile(r"(?:^|\d+_?)(?:Example|Demo|Design|Nestang)", re.I), "ReferenceDesign", None),
    (re.compile(r"(?:^|\d+_?)(?:Manual|Guide|User)", re.I), "UserGuide", None),
    (re.compile(r"(?:^|\d+_?)(?:SDK|Software)", re.I), "SDK", None),
    (re.compile(r"(?:^|\d+_?)(?:Release|Note)", re.I), "ReleaseNote", None),
    (re.compile(r"(?:^|\d+_?)(?:Image|Photo|Picture)", re.I), "Reference", "Image"),
    (re.compile(r"(?:^|\d+_?)(?:BOM|Assembly)", re.I), "Reference", "BOM"),
    (re.compile(r"(?:^|\d+_?)(?:PCB|Layout|Gerber|Net_?Length|Footprint)", re.I), "Reference", "PCB"),
    (re.compile(r"(?:^|\d+_?)(?:IDE|EDA|gowin_?ide)", re.I), "Software", "EDA"),
    (re.compile(r"(?:^|\d+_?)(?:HDK|Hardware)", re.I), "Reference", "HDK"),
    (re.compile(r"(?:^|\d+_?)(?:vmware|VM|virtual)", re.I), "Software", "VM"),
    (re.compile(r"(?:^|\d+_?)(?:Misc|misc)", re.I), "Other", "Misc"),
]

# 文件名 → 分类（兜底）
FILENAME_CATEGORY_PATTERNS = [
    (re.compile(r"schematic|\.sch\b", re.I), "Schematic", None),
    (re.compile(r"datasheet|specification", re.I), "DataSheet", None),
    (re.compile(r"user.?guide|manual", re.I), "UserGuide", None),
    (re.compile(r"pinout|pin.?map|pin.?mux", re.I), "PackagePinout", None),
    (re.compile(r"ibom|bom", re.I), "Reference", "BOM"),
    (re.compile(r"gerber", re.I), "Reference", "PCB"),
    (re.compile(r"\.step$|\.stp$|\.3ds$", re.I), "Reference", "3DModel"),
    (re.compile(r"\.dxf$|dimensional|drawing", re.I), "Reference", "Mechanical"),
    (re.compile(r"firmware|\.bin$|\.hex$", re.I), "Firmware", None),
    (re.compile(r"driver", re.I), "Software", "Driver"),
    (re.compile(r"release.?note", re.I), "ReleaseNote", None),
    (re.compile(r"example|demo|ref.?design", re.I), "ReferenceDesign", None),
]


def parse_file_size_mb(size_str):
    """解析文件大小字符串为 MB"""
    if not size_str or size_str == "-":
        return 0
    size_str = size_str.strip().upper()
    try:
        if "GB" in size_str:
            return float(size_str.replace("GB", "").strip()) * 1024
        elif "MB" in size_str:
            return float(size_str.replace("MB", "").strip())
        elif "KB" in size_str:
            return float(size_str.replace("KB", "").strip()) / 1024
        elif "B" in size_str:
            return float(size_str.replace("B", "").strip()) / (1024 * 1024)
    except ValueError:
        pass
    return 0


def make_download_url(file_url, file_size):
    """生成下载 URL：小文件直链，大文件链接到目录页"""
    size_mb = parse_file_size_mb(file_size)
    if size_mb >= LARGE_FILE_THRESHOLD_MB:
        # 大文件：链接到父目录的 shareURL 页面
        parent_dir = "/".join(file_url.split("/")[:-1])
        return f"{SIPEED_SHARE}/{quote(parent_dir, safe='/')}"
    else:
        # 小文件：直接下载
        return f"{SIPEED_DL}/{quote(file_url, safe='/')}"


def detect_file_format(filename):
    """检测文件格式"""
    lower = filename.lower()
    for ext in [".tar.gz", ".pdf", ".zip", ".rar", ".bin", ".hex",
                ".doc", ".docx", ".html", ".step", ".stp", ".dxf",
                ".brd", ".png", ".jpg", ".jpeg", ".exe", ".dmg", ".txt"]:
        if lower.endswith(ext):
            return ext.lstrip(".")
    match = re.search(r"\.(\w+)$", lower)
    return match.group(1) if match else "unknown"


def extract_board_name(path):
    """从路径提取板卡名（第一级子目录）"""
    parts = path.replace("TANG/", "").split("/")
    return parts[0] if parts else "Unknown"


def is_gowin_platform(board_name, file_path, file_name):
    """判断是否为高云平台文件"""
    # 已知高云板卡
    if board_name in GOWIN_BOARDS:
        return True
    # 已知高云工具目录
    if board_name in GOWIN_TOOL_DIRS:
        return True
    # 已知非高云目录
    if board_name in NON_GOWIN_DIRS:
        return False
    # 从文件名/路径检测高云芯片型号
    if CHIP_PATTERN.search(file_name) or CHIP_PATTERN.search(file_path):
        return True
    # 路径包含 gowin 关键词
    if "gowin" in file_path.lower() or "gowin" in file_name.lower():
        return True
    # 未知 → 非高云
    return False


def extract_chips_from_text(text):
    """从文本中提取所有高云芯片型号"""
    chips = set()
    # 只在纯 ASCII 部分中搜索，避免中文干扰
    ascii_text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    matches = CHIP_PATTERN.findall(ascii_text)
    for m in matches:
        chip = m.upper().strip('-_')
        # 排除明显不是芯片型号的（太短、含文件后缀等）
        if len(chip) < 4:
            continue
        if re.search(r'(DATASHEET|SCH|BRD|TOP|BOT|PCB|3D|REFDSIGN|REF)', chip, re.I):
            continue
        # 去掉尾部的版本号等杂质
        chip = re.sub(r'[-_]V\d+.*$', '', chip)
        chips.add(chip)
    return list(chips)


def get_product_line_for_chip(chip):
    """根据芯片型号查找产品线"""
    chip_upper = chip.upper()
    # 从长到短匹配
    for prefix in sorted(CHIP_TO_PRODUCT_LINE.keys(), key=len, reverse=True):
        if chip_upper.startswith(prefix):
            return CHIP_TO_PRODUCT_LINE[prefix]
    return None


def classify_by_path(path):
    """从路径中各级目录名推断分类"""
    parts = path.split("/")
    for part in parts:
        for pattern, cat, sub in CATEGORY_PATTERNS:
            if pattern.search(part):
                return cat, sub
    return None, None


def classify_by_filename(filename):
    """从文件名推断分类"""
    for pattern, cat, sub in FILENAME_CATEGORY_PATTERNS:
        if pattern.search(filename):
            return cat, sub
    return None, None


def extract_version(filename):
    """提取版本号"""
    match = re.search(r"[Vv](\d+\.\d+(?:\.\d+)?(?:\.\d+)?)", filename)
    return match.group(1) if match else None


def detect_platform_os(filename):
    """检测操作系统平台"""
    platforms = []
    lower = filename.lower()
    if "win" in lower or "windows" in lower or lower.endswith(".exe"):
        platforms.append("Windows")
    if "linux" in lower or "ubuntu" in lower:
        platforms.append("Linux")
    if "mac" in lower or "darwin" in lower or lower.endswith(".dmg"):
        platforms.append("macOS")
    return platforms


def list_dir(path, retries=2):
    """调用 API 列出目录内容"""
    url = f"{SIPEED_API}/{quote(path, safe='/')}"
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == 0:
                    return data.get("data", [])
            return []
        except Exception as e:
            if attempt < retries:
                time.sleep(0.3)
            else:
                print(f"    [!] Request failed: {path} - {e}")
                return []


def crawl_recursive(path, docs, depth=0, max_depth=6):
    """递归遍历目录树（并发版）"""
    if depth > max_depth:
        return

    items = list_dir(path)

    # 分离文件和目录
    subdirs = []
    for item in items:
        name = item["file_name"]
        file_url = item["file_url"]
        file_type = item["file_type"]
        file_size = item.get("file_size", "-")
        last_update = item.get("last_update", "")

        if file_type == 0:
            subdirs.append(file_url)
        elif file_type == 1:
            board_name = extract_board_name(file_url)
            gowin = is_gowin_platform(board_name, file_url, name)

            category, subcategory = classify_by_path(file_url)
            if not category:
                category, subcategory = classify_by_filename(name)
            if not category:
                category = "Other"
                subcategory = None

            chips = []
            product_lines = []

            if gowin:
                board_info = GOWIN_BOARDS.get(board_name)
                if board_info:
                    chips = [board_info["chip"]]
                    product_lines = [board_info["product_line"]]

                extra_chips = extract_chips_from_text(f"{name} {file_url}")
                for c in extra_chips:
                    if c not in chips:
                        chips.append(c)
                        pl = get_product_line_for_chip(c)
                        if pl and pl not in product_lines:
                            product_lines.append(pl)

                if board_name in GOWIN_TOOL_DIRS:
                    if category == "Other":
                        category = "Software"
                        subcategory = "EDA" if "ide" in board_name.lower() else None
            else:
                category = "Other"
                subcategory = board_name

            file_format = detect_file_format(name)
            version = extract_version(name)
            platforms = detect_platform_os(name)
            download_url = make_download_url(file_url, file_size)

            doc_entry = {
                "title": name,
                "url": download_url,
                "doc_id": None,
                "category": category,
                "subcategory": subcategory,
                "file_format": file_format,
                "access": "public",
                "version": version,
                "doc_number": None,
                "chips": chips,
                "product_line": product_lines if product_lines else ["Sipeed"],
                "platform": platforms,
                "source": "sipeed",
                "is_gowin_platform": gowin,
                "board": board_name,
                "path": file_url,
                "file_size": file_size,
                "last_update": last_update,
            }
            docs.append(doc_entry)

            if len(docs) % 100 == 0:
                print(f"    Collected {len(docs)} files...")

    # 并发访问子目录
    if subdirs:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {}
            for sd in subdirs:
                sub_docs = []
                fut = executor.submit(crawl_recursive, sd, sub_docs, depth + 1, max_depth)
                futures[fut] = sub_docs
            for fut in as_completed(futures):
                fut.result()  # 触发异常
                docs.extend(futures[fut])


def scrape_sipeed():
    """抓取 Sipeed TANG 目录下所有文件"""
    print("[*] Scraping Sipeed download site (dl.sipeed.com)...")
    docs = []
    crawl_recursive("TANG", docs)
    print(f"[OK] Sipeed scrape done: {len(docs)} files")
    return docs


def save_sipeed_index(docs):
    """保存 Sipeed 索引"""
    gowin_count = sum(1 for d in docs if d.get("is_gowin_platform"))
    other_count = len(docs) - gowin_count

    index_data = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total": len(docs),
        "gowin_platform_count": gowin_count,
        "other_platform_count": other_count,
        "source": "sipeed",
        "schema_version": 2,
        "documents": docs,
    }
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Sipeed index saved: {INDEX_FILE}")
    print(f"     Gowin platform: {gowin_count} | Other: {other_count}")


def main():
    print("=" * 50)
    print("  Sipeed Download Site Indexer v2")
    print("=" * 50)

    docs = scrape_sipeed()
    save_sipeed_index(docs)

    # 统计
    gowin_docs = [d for d in docs if d.get("is_gowin_platform")]
    other_docs = [d for d in docs if not d.get("is_gowin_platform")]

    print(f"\n[Stats] Gowin Platform ({len(gowin_docs)} files):")
    cats = {}
    for doc in gowin_docs:
        cat = doc["category"]
        sub = doc.get("subcategory")
        key = f"{cat}/{sub}" if sub else cat
        cats[key] = cats.get(key, 0) + 1
    for k, v in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {k:<25} {v}")

    chips = {}
    for doc in gowin_docs:
        for c in doc.get("chips", []):
            chips[c] = chips.get(c, 0) + 1
    print(f"\n[Stats] Chips detected:")
    for k, v in sorted(chips.items(), key=lambda x: -x[1]):
        print(f"    {k:<16} {v}")

    pls = {}
    for doc in gowin_docs:
        for p in doc.get("product_line", []):
            if p != "Sipeed":
                pls[p] = pls.get(p, 0) + 1
    print(f"\n[Stats] Product Lines:")
    for k, v in sorted(pls.items(), key=lambda x: -x[1]):
        print(f"    {k:<16} {v}")

    print(f"\n[Stats] Non-Gowin ({len(other_docs)} files):")
    boards = {}
    for doc in other_docs:
        b = doc["board"]
        boards[b] = boards.get(b, 0) + 1
    for k, v in sorted(boards.items(), key=lambda x: -x[1]):
        print(f"    {k:<16} {v}")


if __name__ == "__main__":
    main()
