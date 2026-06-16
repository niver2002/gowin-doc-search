# 高云半导体文档检索工具

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
