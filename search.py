"""
高云半导体文档本地搜索 - CLI 版 v2
用法:
    python search.py <关键词>
    python search.py --category DataSheet <关键词>
    python search.py --chip GW5A <关键词>
    python search.py --product-line "Arora V" <关键词>
    python search.py --format pdf <关键词>
    python search.py --access public
    python search.py --list-categories
    python search.py --list-chips
    python search.py --list-product-lines
    python search.py --stats
"""

import json
import sys
from pathlib import Path

INDEX_FILE = Path(__file__).parent / "docs_index.json"


def load_index():
    if not INDEX_FILE.exists():
        print(f"[错误] 索引文件不存在: {INDEX_FILE}")
        print("请先运行 python scraper.py 构建索引")
        sys.exit(1)
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def search(docs, keyword=None, category=None, chip=None, product_line=None,
           file_format=None, access=None, platform=None):
    """多维度搜索文档"""
    results = docs

    if category:
        cat_lower = category.lower()
        results = [d for d in results
                   if d["category"].lower() == cat_lower
                   or (d.get("subcategory") or "").lower() == cat_lower
                   or f"{d['category']}/{d.get('subcategory', '')}".lower() == cat_lower]

    if chip:
        chip_upper = chip.upper()
        results = [d for d in results
                   if any(chip_upper in c for c in d.get("chips", []))]

    if product_line:
        pl_lower = product_line.lower()
        results = [d for d in results
                   if any(pl_lower in p.lower() for p in d.get("product_line", []))]

    if file_format:
        fmt_lower = file_format.lower()
        results = [d for d in results if d.get("file_format", "") == fmt_lower]

    if access:
        results = [d for d in results if d.get("access", "") == access]

    if platform:
        plat_lower = platform.lower()
        results = [d for d in results
                   if any(plat_lower in p.lower() for p in d.get("platform", []))]

    if keyword:
        keywords = keyword.lower().split()
        results = [d for d in results
                   if all(kw in d["title"].lower() for kw in keywords)]

    return results


def print_results(results, max_show=30):
    """打印搜索结果"""
    if not results:
        print("  未找到匹配文档")
        return

    total = len(results)
    show = results[:max_show]

    print(f"\n  找到 {total} 条结果"
          + (f"（显示前 {max_show} 条）" if total > max_show else "") + ":\n")
    print(f"  {'#':<4} {'分类':<22} {'格式':<6} {'访问':<10} {'标题'}")
    print(f"  {'-'*4} {'-'*22} {'-'*6} {'-'*10} {'-'*50}")

    for i, doc in enumerate(show, 1):
        cat = doc["category"]
        sub = doc.get("subcategory")
        cat_str = f"{cat}/{sub}" if sub else cat
        fmt = doc.get("file_format", "?")
        acc = "公开" if doc.get("access") == "public" else "登录"
        title = doc["title"][:60]
        print(f"  {i:<4} {cat_str:<22} {fmt:<6} {acc:<10} {title}")

    if total > max_show:
        print(f"\n  ... 还有 {total - max_show} 条未显示")


def print_detail(doc):
    """打印单条文档详情"""
    print(f"\n  标题:     {doc['title']}")
    print(f"  分类:     {doc['category']}" + (f"/{doc['subcategory']}" if doc.get('subcategory') else ""))
    print(f"  格式:     {doc.get('file_format', 'unknown')}")
    print(f"  访问:     {doc.get('access', 'unknown')}")
    if doc.get("version"):
        print(f"  版本:     {doc['version']}")
    if doc.get("doc_number"):
        print(f"  文档编号: {doc['doc_number']}")
    if doc.get("chips"):
        print(f"  芯片:     {', '.join(doc['chips'])}")
    if doc.get("product_line"):
        print(f"  产品线:   {', '.join(doc['product_line'])}")
    if doc.get("platform"):
        print(f"  平台:     {', '.join(doc['platform'])}")
    if doc.get("year"):
        print(f"  年份:     {doc['year']}")
    print(f"  链接:     {doc['url']}")


def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        return

    # 解析参数
    keyword_parts = []
    category = None
    chip = None
    product_line = None
    file_format = None
    access = None
    platform = None
    show_detail = None

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--category" and i + 1 < len(args):
            category = args[i + 1]; i += 2
        elif a == "--chip" and i + 1 < len(args):
            chip = args[i + 1]; i += 2
        elif a == "--product-line" and i + 1 < len(args):
            product_line = args[i + 1]; i += 2
        elif a == "--format" and i + 1 < len(args):
            file_format = args[i + 1]; i += 2
        elif a == "--access" and i + 1 < len(args):
            access = args[i + 1]; i += 2
        elif a == "--platform" and i + 1 < len(args):
            platform = args[i + 1]; i += 2
        elif a == "--detail" and i + 1 < len(args):
            show_detail = int(args[i + 1]); i += 2
        elif a == "--list-categories":
            index = load_index()
            cats = {}
            for doc in index["documents"]:
                cat = doc["category"]
                sub = doc.get("subcategory")
                key = f"{cat}/{sub}" if sub else cat
                cats[key] = cats.get(key, 0) + 1
            print("\n  可用分类:")
            for k, c in sorted(cats.items(), key=lambda x: -x[1]):
                print(f"    {k:<30} ({c} 条)")
            return
        elif a == "--list-chips":
            index = load_index()
            chips = {}
            for doc in index["documents"]:
                for c in doc.get("chips", []):
                    chips[c] = chips.get(c, 0) + 1
            print("\n  可用芯片系列:")
            for k, c in sorted(chips.items(), key=lambda x: -x[1]):
                print(f"    {k:<16} ({c} 条)")
            return
        elif a == "--list-product-lines":
            index = load_index()
            pls = {}
            for doc in index["documents"]:
                for p in doc.get("product_line", []):
                    pls[p] = pls.get(p, 0) + 1
            print("\n  可用产品线:")
            for k, c in sorted(pls.items(), key=lambda x: -x[1]):
                print(f"    {k:<16} ({c} 条)")
            return
        elif a == "--stats":
            index = load_index()
            docs = index["documents"]
            formats = {}
            access_map = {}
            for doc in docs:
                fmt = doc.get("file_format", "?")
                formats[fmt] = formats.get(fmt, 0) + 1
                acc = doc.get("access", "?")
                access_map[acc] = access_map.get(acc, 0) + 1
            print(f"\n  索引更新: {index['updated_at']}")
            print(f"  总文档数: {index['total']}")
            print(f"\n  文件格式:")
            for k, v in sorted(formats.items(), key=lambda x: -x[1]):
                print(f"    {k:<10} {v}")
            print(f"\n  访问类型:")
            for k, v in sorted(access_map.items(), key=lambda x: -x[1]):
                print(f"    {k:<18} {v}")
            return
        else:
            keyword_parts.append(a)
            i += 1

    keyword = " ".join(keyword_parts) if keyword_parts else None

    # 加载并搜索
    index = load_index()
    print(f"  索引更新: {index['updated_at']} | 共 {index['total']} 条 | schema v{index.get('schema_version', 1)}")

    results = search(
        index["documents"],
        keyword=keyword,
        category=category,
        chip=chip,
        product_line=product_line,
        file_format=file_format,
        access=access,
        platform=platform,
    )

    if show_detail is not None and 1 <= show_detail <= len(results):
        print_detail(results[show_detail - 1])
    else:
        print_results(results)


if __name__ == "__main__":
    main()
