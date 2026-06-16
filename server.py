"""
高云半导体文档检索 - Web UI 版 v2
启动后访问 http://localhost:5000
"""

import json
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from fuzzy_engine import fuzzy_search, expand_query

INDEX_FILE = Path(__file__).parent / "docs_index.json"
SIPEED_INDEX_FILE = Path(__file__).parent / "sipeed_index.json"
STATIC_DIR = Path(__file__).parent / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR))


def load_index():
    """加载并合并 Gowin + Sipeed 索引"""
    docs = []
    updated_times = []

    # Gowin
    if INDEX_FILE.exists():
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        for doc in data.get("documents", []):
            if "source" not in doc:
                doc["source"] = "gowin"
            docs.append(doc)
        updated_times.append(data.get("updated_at", ""))

    # Sipeed
    if SIPEED_INDEX_FILE.exists():
        with open(SIPEED_INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        docs.extend(data.get("documents", []))
        updated_times.append(data.get("updated_at", ""))

    updated_at = max(updated_times) if updated_times else "N/A"
    return {"updated_at": updated_at, "total": len(docs), "schema_version": 2, "documents": docs}


@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/api/search")
def api_search():
    keyword = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    chip = request.args.get("chip", "").strip()
    product_line = request.args.get("product_line", "").strip()
    file_format = request.args.get("format", "").strip()
    access = request.args.get("access", "").strip()
    platform = request.args.get("platform", "").strip()
    source = request.args.get("source", "").strip()
    page = int(request.args.get("page", "1"))
    page_size = int(request.args.get("size", "20"))

    data = load_index()
    docs = data["documents"]

    # 过滤
    if source:
        docs = [d for d in docs if d.get("source", "gowin") == source.lower()]
    if category:
        cat_lower = category.lower()
        docs = [d for d in docs
                if d["category"].lower() == cat_lower
                or (d.get("subcategory") or "").lower() == cat_lower
                or f"{d['category']}/{d.get('subcategory', '')}".lower() == cat_lower]

    if chip:
        chip_upper = chip.upper()
        docs = [d for d in docs
                if any(chip_upper in c for c in d.get("chips", []))]

    if product_line:
        pl_lower = product_line.lower()
        docs = [d for d in docs
                if any(pl_lower in p.lower() for p in d.get("product_line", []))]

    if file_format:
        docs = [d for d in docs if d.get("file_format", "") == file_format.lower()]

    if access:
        docs = [d for d in docs if d.get("access", "") == access]

    if platform:
        plat_lower = platform.lower()
        docs = [d for d in docs
                if any(plat_lower in p.lower() for p in d.get("platform", []))]

    if keyword:
        docs = fuzzy_search(docs, keyword, max_results=500)

    # 分页
    total = len(docs)
    start = (page - 1) * page_size
    end = start + page_size
    page_docs = docs[start:end]

    return jsonify({
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "updated_at": data.get("updated_at", "N/A"),
        "results": page_docs,
    })


@app.route("/api/categories")
def api_categories():
    data = load_index()
    cats = {}
    for doc in data["documents"]:
        cat = doc["category"]
        sub = doc.get("subcategory")
        key = f"{cat}/{sub}" if sub else cat
        cats[key] = cats.get(key, 0) + 1
    return jsonify(sorted(cats.items(), key=lambda x: -x[1]))


@app.route("/api/chips")
def api_chips():
    data = load_index()
    chips = {}
    for doc in data["documents"]:
        for c in doc.get("chips", []):
            chips[c] = chips.get(c, 0) + 1
    return jsonify(sorted(chips.items(), key=lambda x: -x[1]))


@app.route("/api/product_lines")
def api_product_lines():
    data = load_index()
    pls = {}
    for doc in data["documents"]:
        for p in doc.get("product_line", []):
            pls[p] = pls.get(p, 0) + 1
    return jsonify(sorted(pls.items(), key=lambda x: -x[1]))


@app.route("/api/formats")
def api_formats():
    data = load_index()
    formats = {}
    for doc in data["documents"]:
        fmt = doc.get("file_format", "unknown")
        formats[fmt] = formats.get(fmt, 0) + 1
    return jsonify(sorted(formats.items(), key=lambda x: -x[1]))


@app.route("/api/stats")
def api_stats():
    data = load_index()
    docs = data["documents"]

    access_map = {}
    for doc in docs:
        acc = doc.get("access", "unknown")
        access_map[acc] = access_map.get(acc, 0) + 1

    return jsonify({
        "total": data.get("total", 0),
        "updated_at": data.get("updated_at", "N/A"),
        "schema_version": data.get("schema_version", 1),
        "access": access_map,
    })


if __name__ == "__main__":
    if not INDEX_FILE.exists():
        print("[警告] 索引文件不存在，请先运行 python scraper.py")
        print("[*] 将以空索引启动...")

    print("=" * 50)
    print("  高云半导体文档检索 - Web UI v2")
    print("  访问: http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
