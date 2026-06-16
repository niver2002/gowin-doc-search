"""合并 Gowin 与 Sipeed 索引为前端可用的 data/index.json。

用法：
    python scraper.py            # 生成 docs_index.json（需 config.json 账号）
    python scraper_sipeed.py     # 生成 sipeed_index.json（公开 API，无需账号）
    python build_index.py        # 合并为 data/index.json（Next.js 应用读取）
"""
import json
import os
import time


def load(path):
    if not os.path.exists(path):
        print(f"[warn] 缺少 {path}，跳过")
        return {"documents": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    g = load("docs_index.json")
    s = load("sipeed_index.json")

    docs = []
    for d in g["documents"]:
        d.setdefault("source", "gowin")
        d.setdefault("platform", d.get("platform") or [])
        docs.append(d)
    for d in s["documents"]:
        d["source"] = "sipeed"
        docs.append(d)

    os.makedirs("data", exist_ok=True)
    out = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total": len(docs),
        "gowin_total": len(g["documents"]),
        "sipeed_total": len(s["documents"]),
        "documents": docs,
    }
    with open("data/index.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"[ok] data/index.json 已生成：共 {len(docs)} 条 "
          f"(Gowin {len(g['documents'])} / Sipeed {len(s['documents'])})")


if __name__ == "__main__":
    main()
