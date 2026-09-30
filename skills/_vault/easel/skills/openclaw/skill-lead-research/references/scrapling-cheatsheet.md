# Scrapling 速查（给 skill 用的核心子集）

完整 skill 在 `_vault/scrapling/Scrapling-main/agent-skill/Scrapling-Skill/`。这里只记本 skill 干活的用法。

## 引擎选择

| 情况 | 用 |
|------|-----|
| 普通站点、博客、文档 | `fetch`（HTML 请求） |
| 现代 Web 应用、动态内容 | `fetch`（浏览器渲染） |
| 云防火墙 / 反爬 | `stealthy-fetch` |
| 先试简单的 | 从 HTML 请求开始，失败再升级 |

`gather_corpus.py` 已封装：默认 scrapling 的 `Fetcher`（HTML 请求），抓失败会自动回退 urllib。需要浏览器/stealth 时改脚本换用 `StealthyFetcher`。

## 关键点

- **一定用 `--ai-targeted`**（或脚本的 `markdown(main_content_only=True)`）：只取主内容、剔除隐藏元素与注入文本，省 token 又防 prompt injection。
- **输出 `.md`** 优先于 `.html`：可读、省 token。
- **用 CSS selector 收窄**：只抓正文 `article` / `main`，别把整个导航栏带进语料。
- 被反爬时**降级**而不是硬闯：`403/空 content` 就报 DATA GAP，或改用 web search 拿公开描述。

## 绕过与约束

- Cloudflare Turnstile 由库自动解，无需密钥。
- 遵守 robots.txt、加 `download_delay`；`robots_txt_obey=True` 可自动执行。
- **不突破登录墙/付费墙**；不抓个人敏感数据。
- 本机走代理时（`127.0.0.1:7897`），抓取命令加 `--proxy http://127.0.0.1:7897`（`gather_corpus.py` 若需代理可加 `--proxy` 参数自行扩展）。

## 一句话

页面 → `markdown()` → `.md` 文件 = RAG 语料。整站用 `SiteToMarkdownSpider`（见 building-rag-systems.md）。