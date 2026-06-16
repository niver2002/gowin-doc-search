"""
高云半导体文档抓取器 v2
- 自动登录 gowinsemi.com
- 分页抓取文档列表
- 深度解析：分类/版本/平台/格式/访问类型/产品系列
- 构建本地 JSON 索引
"""

import json
import time
import re
import sys
import os
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

CONFIG_FILE = Path(__file__).parent / "config.json"
INDEX_FILE = Path(__file__).parent / "docs_index.json"

# 内置公开账号（无需配置即可使用）
DEFAULT_CREDENTIALS = {
    "email": "contact@streamly.cn",
    "password": "streamly.cn",
}

BASE_URL = "https://www.gowinsemi.com/en"
LOGIN_URL = f"{BASE_URL}/login/user/login"
DOC_DB_URL = f"{BASE_URL}/document/main/database"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}

# ============================================================
# 产品系列映射
# ============================================================
FAMILY_MAP = {
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
    "GW3A": "GW3A",
    "GW5A": "Arora V",
    "GW5AR": "Arora V",
    "GW5AS": "Arora V",
    "GW5AT": "Arora V",
    "GW5ART": "Arora V",
    "GW5AST": "Arora V",
    "GWU2X": "GoBridge",
    "GWU2U": "GoBridge",
}

# ============================================================
# 配置与登录
# ============================================================

def load_config():
    """加载配置：优先使用 config.json，否则使用内置公开账号"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
        if config.get("email") and config.get("password"):
            return config
    return DEFAULT_CREDENTIALS.copy()


def create_session(config, max_retries=3):
    """登录并返回已认证的 session（带重试）"""
    session = requests.Session()
    session.headers.update(HEADERS)

    for attempt in range(1, max_retries + 1):
        try:
            retry_msg = f" (重试 {attempt}/{max_retries})" if attempt > 1 else ""
            print(f"[*] 访问登录页...{retry_msg}")
            login_page = session.get(f"{BASE_URL}/login/user/login_input", timeout=20)
            login_page.raise_for_status()

            print(f"[*] 正在登录 ({config['email']})...")
            login_data = {
                "email": config["email"],
                "password": config["password"],
            }

            soup = BeautifulSoup(login_page.text, "lxml")
            hidden_inputs = soup.find_all("input", {"type": "hidden"})
            for inp in hidden_inputs:
                name = inp.get("name")
                value = inp.get("value", "")
                if name and name not in login_data:
                    login_data[name] = value

            # 提取 CSRF token（如果有）
            csrf_meta = soup.find("meta", {"name": "csrf-token"})
            if csrf_meta:
                session.headers["X-CSRF-Token"] = csrf_meta.get("content", "")

            resp = session.post(LOGIN_URL, data=login_data, allow_redirects=True, timeout=20)

            # 验证登录状态
            test = session.get(DOC_DB_URL, timeout=15)
            if "database_doc" in test.text or "chkLogin" in test.text:
                print("[✓] 登录成功")
                return session

            # 检查是否被重定向到登录页
            if "login_input" in test.url or "login" in test.url:
                print("[!] 登录失败（被重定向到登录页）")
            else:
                print("[!] 登录状态不确定，继续尝试...")
                return session

        except requests.exceptions.RequestException as e:
            print(f"[!] 网络错误: {e}")

        if attempt < max_retries:
            wait = attempt * 2
            print(f"[*] {wait}s 后重试...")
            time.sleep(wait)

    print("[!] 登录重试已耗尽，使用当前 session 继续...")
    return session


# ============================================================
# 深度解析引擎
# ============================================================

def detect_file_format(url, title):
    """从 URL 或标题检测文件格式"""
    url_lower = unquote(url).lower()
    if url_lower.endswith(".pdf"):
        return "pdf"
    elif url_lower.endswith(".zip"):
        return "zip"
    elif url_lower.endswith(".tar.gz") or url_lower.endswith(".gz"):
        return "tar.gz"
    elif url_lower.endswith(".bin"):
        return "bin"
    elif url_lower.endswith(".docx") or url_lower.endswith(".doc"):
        return "docx"
    elif url_lower.endswith(".dmg"):
        return "dmg"
    elif url_lower.endswith(".rar"):
        return "rar"
    elif url_lower.endswith(".exe"):
        return "exe"
    # 从 URL 路径中的扩展名
    path = urlparse(url).path
    ext_match = re.search(r"\.(\w+)$", path)
    if ext_match:
        return ext_match.group(1).lower()
    return "unknown"


def detect_access_type(url):
    """判断访问类型：公开 CDN 还是需要登录"""
    if "cdn.gowinsemi.com" in url:
        return "public"
    elif "chkLogin" in url:
        return "login_required"
    else:
        return "unknown"


def detect_platform(title):
    """检测软件/固件的目标平台"""
    title_lower = title.lower()
    platforms = []
    if "win" in title_lower or "windows" in title_lower:
        platforms.append("Windows")
    if "linux" in title_lower:
        platforms.append("Linux")
    if "macos" in title_lower or "mac os" in title_lower or ".dmg" in title_lower:
        platforms.append("macOS")
    return platforms if platforms else None


def extract_version(title):
    """从标题中提取版本号"""
    # 软件版本: V1.9.12, V1.9.5.02Beta, v2.0
    ver_match = re.search(
        r"[Vv](\d+\.\d+(?:\.\d+)?(?:\.\d+)?(?:\s*Beta)?)", title
    )
    if ver_match:
        return ver_match.group(1).strip()

    # 文档编号版本: SUG100-2.1, UG290-2.8.2
    doc_ver = re.search(r"[A-Z]+\d+-(\d+\.\d+(?:\.\d+)?)", title)
    if doc_ver:
        return doc_ver.group(1)

    return None


def extract_doc_number(title):
    """提取文档编号（如 UG290, DS102, IPUG761, SUG918, TN440）"""
    match = re.search(r"\b(UG|DS|IPUG|SUG|TN|AN|WM)(\d+)[E]?\b", title.upper())
    if match:
        return f"{match.group(1)}{match.group(2)}"
    # GPCN 编号
    gpcn = re.search(r"(GPCN-\d{4}-\w+)", title)
    if gpcn:
        return gpcn.group(1)
    return None


def extract_year(title, url):
    """尝试提取文档发布年份"""
    # GPCN-2026-003 格式
    year_match = re.search(r"GPCN-(\d{4})", title)
    if year_match:
        return int(year_match.group(1))
    # 20240xxxx 格式
    year_match2 = re.search(r"\b(20\d{2})(?:0[4-9]|1[0-2]|0[1-3])\d{3}\b", title)
    if year_match2:
        return int(year_match2.group(1))
    return None


def extract_product_families(title):
    """从标题提取所有产品系列"""
    families = set()
    chips = set()

    # 匹配 GW 开头的芯片型号
    gw_matches = re.findall(r"GW\d+[A-Z]*(?:[-]\w+)?", title, re.IGNORECASE)
    for m in gw_matches:
        # 归一化为系列名
        base = re.match(r"(GW\d+[A-Z]*)", m.upper())
        if base:
            chip = base.group(1)
            chips.add(chip)
            # 映射到产品线名
            for prefix in sorted(FAMILY_MAP.keys(), key=len, reverse=True):
                if chip.startswith(prefix):
                    families.add(FAMILY_MAP[prefix])
                    break

    # 文字匹配
    title_lower = title.lower()
    if "littlebee" in title_lower:
        families.add("LittleBee")
    if "arora v" in title_lower or "arora_v" in title_lower:
        families.add("Arora V")
    elif "arora" in title_lower:
        families.add("Arora")

    return {
        "chips": sorted(chips) if chips else [],
        "product_line": sorted(families) if families else [],
    }


def classify_document(title, url, file_format):
    """综合分类文档，返回主分类和子分类"""
    t = title.lower()
    fmt = file_format

    # === 软件/工具 ===
    if ("gowin" in t and ("eda" in t or "v1.9" in t or "v1.8" in t or "v2." in t)
            and fmt in ("zip", "tar.gz", "dmg", "rar", "exe")):
        return "Software", "EDA"
    if "programmer" in t and fmt == "bin":
        return "Firmware", "Programmer"
    if "license server" in t or "license_server" in t:
        return "Software", "License"
    if "securefpga" in t and fmt == "zip":
        return "Software", "SecureFPGA"

    # === SDK ===
    if "sdk" in t and ("release note" in t or "releaseNote" in t):
        return "ReleaseNote", "SDK"
    if "sdk" in t:
        return "SDK", None

    # === 产品公告 ===
    if "gpcn" in t or "product change" in t or "design advisory" in t:
        return "Advisory", "PCN"
    if "discontinu" in t:
        return "Advisory", "EOL"
    if "voltage range change" in t or "upgraded" in t or "version upgraded" in t:
        return "Advisory", "Upgrade"

    # === 参考设计 ===
    if "refdesign" in t or "ref_design" in t or "reference design" in t:
        return "ReferenceDesign", None
    if "ref design" in t:
        return "ReferenceDesign", None

    # === 开发板 ===
    if re.search(r"\bsch\b", t) or "schematic" in t:
        return "Schematic", None
    if "development board" in t:
        return "DevBoard", "UserGuide"
    if re.match(r"dk[-_]", t):
        if "sch" in t:
            return "Schematic", None
        return "DevBoard", None

    # === 证书 ===
    if "certificate" in t or "iso26262" in t or "iec61508" in t:
        if fmt == "pdf":
            return "Certificate", None

    # === 数据手册 ===
    if "data sheet" in t or "datasheet" in t:
        return "DataSheet", None

    # === 勘误 ===
    if "errata" in t:
        return "Errata", None

    # === 封装引脚 ===
    if "package" in t and "pinout" in t:
        return "PackagePinout", None

    # === 用户指南 ===
    if "user guide" in t or "user's guide" in t:
        if "ip " in t or t.startswith("gowin "):
            return "UserGuide", "IP"
        return "UserGuide", None

    # === IP 核 ===
    if "ip user guide" in t or "ip core" in t:
        return "UserGuide", "IP"

    # === 应用笔记 ===
    if "application note" in t:
        return "AppNote", None

    # === 快速入门 ===
    if "quick start" in t:
        return "QuickStart", None

    # === 参考手册 ===
    if "reference manual" in t or "hardware design" in t:
        return "Reference", None

    # === 发布说明 ===
    if "release note" in t:
        return "ReleaseNote", None

    # === 简介 ===
    if "introduction" in t:
        return "Introduction", None

    # === 兼容性/比较 ===
    if "compatibility" in t or "comparison" in t:
        return "Reference", "Compatibility"

    # === 软件包（通用 zip 包含 gowin 名） ===
    if fmt in ("zip", "tar.gz", "dmg") and "gowin" in t:
        return "Software", None

    # === 兜底 ===
    if fmt == "pdf":
        return "Document", None
    if fmt in ("zip", "tar.gz"):
        return "Package", None
    if fmt == "bin":
        return "Firmware", None

    return "Other", None


# ============================================================
# 页面抓取
# ============================================================

def get_total_pages(session):
    """获取总页数"""
    resp = session.get(DOC_DB_URL, timeout=15)
    soup = BeautifulSoup(resp.text, "lxml")
    page_links = soup.find_all("a", href=re.compile(r"page=\d+"))
    max_page = 1
    for link in page_links:
        match = re.search(r"page=(\d+)", link.get("href", ""))
        if match:
            max_page = max(max_page, int(match.group(1)))
    return max_page


def parse_page(session, page_num):
    """解析单页文档列表"""
    url = f"{DOC_DB_URL}?page={page_num}"
    resp = session.get(url, timeout=15)
    soup = BeautifulSoup(resp.text, "lxml")
    docs = []

    links = soup.find_all("a", href=re.compile(r"chkLogin|cdn\.gowinsemi|database_doc"))

    for link in links:
        title = link.get_text(strip=True)
        href = link.get("href", "")

        if not title or not href:
            continue
        if title.isdigit() or title in ("Select All", "Deselect All", "..."):
            continue
        if re.match(r"^[\d.]+$", title):
            continue

        # 构建完整 URL
        if href.startswith("/"):
            full_url = f"https://www.gowinsemi.com{href}"
        elif not href.startswith("http"):
            full_url = urljoin(BASE_URL, href)
        else:
            full_url = href

        # 提取文档服务器 ID
        doc_id_match = re.search(r"database_doc[/%]2[fF](\d+)", href)
        doc_id = int(doc_id_match.group(1)) if doc_id_match else None

        # 深度分析
        file_format = detect_file_format(full_url, title)
        access_type = detect_access_type(full_url)
        platform = detect_platform(title)
        version = extract_version(title)
        doc_number = extract_doc_number(title)
        year = extract_year(title, full_url)
        families = extract_product_families(title)
        category, subcategory = classify_document(title, full_url, file_format)

        doc_entry = {
            "title": title,
            "url": full_url,
            "doc_id": doc_id,
            "category": category,
            "subcategory": subcategory,
            "file_format": file_format,
            "access": access_type,
            "version": version,
            "doc_number": doc_number,
            "chips": families["chips"],
            "product_line": families["product_line"],
        }

        if platform:
            doc_entry["platform"] = platform
        if year:
            doc_entry["year"] = year

        docs.append(doc_entry)

    return docs


def scrape_all(session):
    """抓取全部文档"""
    total_pages = get_total_pages(session)
    print(f"[*] 共 {total_pages} 页，开始抓取...")

    all_docs = []
    for page in range(1, total_pages + 1):
        try:
            docs = parse_page(session, page)
            all_docs.extend(docs)
            print(f"    第 {page}/{total_pages} 页 - 获取 {len(docs)} 条 (累计 {len(all_docs)})")
            time.sleep(0.1)
        except Exception as e:
            print(f"    第 {page}/{total_pages} 页 - 失败: {e}")
            time.sleep(0.5)
            # 重试一次
            try:
                docs = parse_page(session, page)
                all_docs.extend(docs)
                print(f"    第 {page}/{total_pages} 页 - 重试成功 ({len(docs)} 条)")
            except Exception as e2:
                print(f"    第 {page}/{total_pages} 页 - 重试失败: {e2}，跳过")

    return all_docs


def save_index(docs):
    """保存索引到本地"""
    index_data = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total": len(docs),
        "schema_version": 2,
        "documents": docs,
    }
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    print(f"[✓] 索引已保存: {INDEX_FILE} ({len(docs)} 条文档)")


def print_stats(docs):
    """打印统计信息"""
    categories = {}
    formats = {}
    access_types = {}
    product_lines = {}

    for doc in docs:
        cat = doc["category"]
        sub = doc.get("subcategory")
        key = f"{cat}/{sub}" if sub else cat
        categories[key] = categories.get(key, 0) + 1

        fmt = doc["file_format"]
        formats[fmt] = formats.get(fmt, 0) + 1

        acc = doc["access"]
        access_types[acc] = access_types.get(acc, 0) + 1

        for pl in doc.get("product_line", []):
            product_lines[pl] = product_lines.get(pl, 0) + 1

    print("\n[统计] 文档分类:")
    for k, v in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"    {k:<30} {v}")

    print("\n[统计] 文件格式:")
    for k, v in sorted(formats.items(), key=lambda x: -x[1]):
        print(f"    {k:<12} {v}")

    print("\n[统计] 访问类型:")
    for k, v in sorted(access_types.items(), key=lambda x: -x[1]):
        print(f"    {k:<16} {v}")

    print("\n[统计] 产品线:")
    for k, v in sorted(product_lines.items(), key=lambda x: -x[1]):
        print(f"    {k:<16} {v}")


# ============================================================
# 入口
# ============================================================

def main():
    print("=" * 50)
    print("  高云半导体文档索引构建器 v2")
    print("=" * 50)

    config = load_config()
    session = create_session(config)
    docs = scrape_all(session)
    save_index(docs)
    print_stats(docs)


if __name__ == "__main__":
    main()
