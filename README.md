# 高云半导体文档检索工具

文档检索聚合工具，统一检索 Gowin 官方与 Sipeed TANG 的资料，解决官网查询繁琐的问题。

> 现已提供 **Next.js 在线版**（可部署到 Vercel），见下方「在线版（Vercel）」。
> 原 Python/Flask 本地版仍保留。

## 在线版（Vercel）

应用读取已抓取好的静态索引 `data/index.json`，无后端依赖，可直接部署 Vercel。

```bash
npm install
npm run dev        # 本地预览 http://localhost:3000
npm run build      # 生产构建
```

部署：把仓库连接到 Vercel，框架选 Next.js，零额外配置即可。

### 刷新数据

```bash
python scraper.py          # 抓取 Gowin（需 config.json 账号）-> docs_index.json
python scraper_sipeed.py   # 抓取 Sipeed（公开 API，无需账号）-> sipeed_index.json
python build_index.py      # 合并 -> data/index.json
```

### Gowin 登录与「需登录」文档下载

高云官网（gowinsemi.com）部分文档下载需要登录，且登录带**图形验证码**，
无法服务端全自动免登录。本站做法：

1. 点击右上角「登录高云账号」，弹窗已预填公共账号（`contact@streamly.cn`）。
2. 服务端代理高云的验证码图（`/api/gowin/captcha`），用户**手动输入验证码（区分大小写）**。
3. 登录成功后，把高云的 `PHPSESSID` 存进本站 httpOnly cookie；「需登录」文档按钮变为「下载」，
   经本站代理（`/api/gowin/download`）用该会话拉取真实 PDF 回传给浏览器，无需再跳官网。

相关 API：`/api/gowin/{captcha,login,status,logout,download}`。会话过期后重新登录即可。

### 已知限制

- **Sipeed 大文件（≥10MB）**：Sipeed 不提供 HTTP 直链，这类文件统一指向
  `dl.sipeed.com/shareURL/...` 网盘引导页（含百度网盘 / Mega 链接），界面标注「网盘下载」。
- **Gowin 验证码**：登录需人工识别验证码，无法跳过（这是高云官网的安全机制）。
- 公开文档（cdn.gowinsemi.com）与 Sipeed 小文件始终可直接下载，无需登录。

---

## 本地版（Python / Flask）

本地文档检索工具，解决官网查询文档繁琐的问题。

## 功能

- 🔐 **自动登录** — 使用账号密码登录高云官网
- 📥 **全量抓取** — 自动遍历文档中心全部页面（~1000+ 文档）
- 💾 **本地索引** — JSON 格式缓存，离线可搜
- 🔍 **关键词搜索** — 支持多关键词、类型/产品系列筛选
- 🌐 **Web UI** — 本地 Web 界面，现代化交互体验
- ⌨️ **CLI 搜索** — 命令行快速检索

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置账号

复制配置模板并填入你的高云账号：

```bash
copy config.example.json config.json
```

编辑 `config.json`：
```json
{
    "email": "你的邮箱",
    "password": "你的密码",
    "base_url": "https://www.gowinsemi.com/en",
    "cdn_url": "https://cdn.gowinsemi.com.cn"
}
```

### 3. 构建索引

```bash
python scraper.py
```

首次运行会抓取全部 103 页文档列表，约需 1-2 分钟。
索引保存在 `docs_index.json`，后续可直接搜索无需重新抓取。

### 4. 搜索文档

#### Web UI（推荐）

```bash
python server.py
```

浏览器访问 http://localhost:5000

#### 命令行

```bash
# 关键词搜索
python search.py DDR3

# 按类型筛选
python search.py --type DataSheet GW5A

# 按产品系列筛选
python search.py --family GW2A user guide

# 查看所有文档类型
python search.py --list-types

# 查看所有产品系列
python search.py --list-families
```

## 文档类型说明

| 类型 | 含义 |
|------|------|
| DataSheet | 数据手册 |
| UserGuide | 用户指南 |
| Reference | 参考手册/设计 |
| AppNote | 应用笔记 |
| ReleaseNote | 发布说明 |
| Schematic | 原理图 |
| DevBoard | 开发板文档 |
| PackagePinout | 封装引脚 |
| IP | IP 核文档 |
| SDK | SDK 文档 |
| Advisory | 产品公告 |

## 更新索引

文档有更新时重新运行抓取器即可：

```bash
python scraper.py
```

## 注意事项

- `config.json` 含敏感信息，已加入 `.gitignore`
- 抓取间隔 0.5s，对服务器友好
- 下载链接需登录状态，点击后浏览器如未登录需先登录
