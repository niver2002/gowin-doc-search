"""
高云半导体文档检索 - 一键启动入口
自动登录 → 构建/更新索引 → 启动 Web UI → 打开浏览器
"""

import json
import sys
import os
import time
import webbrowser
import threading
from pathlib import Path

# 确保工作目录为脚本所在目录
os.chdir(Path(__file__).parent)

from scraper import load_config, create_session, scrape_all, save_index, INDEX_FILE
from scraper_sipeed import scrape_sipeed, save_sipeed_index, INDEX_FILE as SIPEED_INDEX_FILE
from server import app


def should_update_index():
    """判断是否需要更新索引：不存在或超过 24 小时"""
    if not INDEX_FILE.exists():
        return True
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        updated = data.get("updated_at", "")
        if not updated:
            return True
        from datetime import datetime
        last = datetime.strptime(updated, "%Y-%m-%d %H:%M:%S")
        diff = (datetime.now() - last).total_seconds()
        return diff > 86400  # 超过 24 小时更新
    except Exception:
        return True


def should_update_sipeed_index():
    """判断 Sipeed 索引是否需要更新"""
    if not SIPEED_INDEX_FILE.exists():
        return True
    try:
        with open(SIPEED_INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        updated = data.get("updated_at", "")
        if not updated:
            return True
        from datetime import datetime
        last = datetime.strptime(updated, "%Y-%m-%d %H:%M:%S")
        diff = (datetime.now() - last).total_seconds()
        return diff > 86400
    except Exception:
        return True


def update_index():
    """登录并更新索引（两个数据源并行拓取）"""
    need_gowin = should_update_index()
    need_sipeed = should_update_sipeed_index()

    if not need_gowin:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"[✓] Gowin 索引有效 ({data['total']} 条, 更新于 {data['updated_at']})")

    if not need_sipeed:
        with open(SIPEED_INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"[✓] Sipeed 索引有效 ({data['total']} 条, 更新于 {data['updated_at']})")

    if not need_gowin and not need_sipeed:
        return

    # 并行抓取
    import concurrent.futures

    def do_gowin():
        if not need_gowin:
            return
        print("[*] Gowin 索引更新中...")
        config = load_config()
        session = create_session(config)
        docs = scrape_all(session)
        save_index(docs)

    def do_sipeed():
        if not need_sipeed:
            return
        print("[*] Sipeed 索引更新中...")
        sipeed_docs = scrape_sipeed()
        save_sipeed_index(sipeed_docs)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(do_gowin), executor.submit(do_sipeed)]
        concurrent.futures.wait(futures)
        for f in futures:
            if f.exception():
                print(f"[!] 抓取异常: {f.exception()}")


def open_browser_delayed(port, delay=1.5):
    """延迟打开浏览器"""
    time.sleep(delay)
    url = f"http://localhost:{port}"
    print(f"[*] 打开浏览器: {url}")
    webbrowser.open(url)


def main():
    port = 5000

    print("=" * 50)
    print("  高云半导体文档检索工具")
    print("=" * 50)
    print()

    # 1. 更新索引
    try:
        update_index()
    except Exception as e:
        print(f"[!] 索引更新失败: {e}")
        if not INDEX_FILE.exists():
            print("[!] 无本地索引，无法启动。请检查网络连接。")
            input("按回车退出...")
            sys.exit(1)
        print("[*] 使用现有索引继续...")

    print()
    print(f"[*] 启动 Web 服务: http://localhost:{port}")
    print("[*] 按 Ctrl+C 退出")
    print()

    # 2. 延迟打开浏览器
    threading.Thread(target=open_browser_delayed, args=(port,), daemon=True).start()

    # 3. 启动 Flask（关闭 debug 避免双重启动）
    app.run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()
