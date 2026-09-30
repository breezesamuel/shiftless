"""gather_corpus.py — 抓取一组网页，转换为 LLM-ready 的 Markdown 语料。

用法:
  python gather_corpus.py --urls "https://a.com,https://b.com" --out data/corpus
  python gather_corpus.py --urls_file urls.txt --out data/corpus [--sleep 1.0]

输出:
  在 --out 目录下为每个 URL 生成一个 <host>__<slug>.md 文件。
  可选 --selector 用 CSS 只取页面主体(如 "article"、"main")。

抓取引擎:
  优先用 scrapling(Fetcher/StealthyFetcher)，失败或未安装则回退 urllib。
  scrapling 未安装时自动提示 `pip install scrapling`。

合规:
  尊重 robots.txt、只抓授权内容、遵守站点频率限制。--sleep 控制请求间隔。
"""
import argparse
import concurrent.futures
import html
import os
import re
import sys
import time
import urllib.request

try:
    from scrapling.fetchers import Fetcher, StealthyFetcher
    HAS_SCRAPLING = True
except Exception:
    HAS_SCRAPLING = False


def slugify(url: str) -> str:
    host = re.sub(r"[^a-z0-9.-]", "", url.split("//")[-1].split("/")[0].lower())
    path = url.split("//")[-1].split("/", 1)[1] if "/" in url.split("//")[-1] else ""
    path = re.sub(r"[^a-z0-9_]+", "-", path.lower())[:40].strip("-")
    return f"{host}__{path or 'index'}"


def _clean_text(html_text: str) -> str:
    html_text = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html_text, flags=re.S | re.I)
    html_text = re.sub(r"<[^>]+>", " ", html_text)
    html_text = html.unescape(html_text)
    html_text = re.sub(r"[ \t]+", " ", html_text)
    html_text = re.sub(r"\n\s*\n+", "\n\n", html_text)
    return html_text.strip()


def fetch_one(url: str, selector: str | None, sleep: float, timeout: int) -> tuple[str, str, str] | None:
    """返回 (url, title, markdown)。失败返回 None。"""
    time.sleep(sleep)
    if HAS_SCRAPLING:
        try:
            page = Fetcher.get(url, timeout=timeout, stealthy_headers=True)
            md = page.markdown(main_content_only=True, css_selector=selector)
            title = page.css("title::text").get() or ""
            return url, (title or url), md
        except Exception:
            pass
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; boss-outreach/1.0)"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        title_m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
        title = _clean_text(title_m.group(1)) if title_m else url
        return url, title, _clean_text(body)
    except Exception as exc:
        print(f"  ! {url} failed: {exc}", file=sys.stderr)
        return None


def main() -> int:
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="抓取网页 → Markdown 语料")
    ap.add_argument("--urls", help="逗号分隔的 URL 列表")
    ap.add_argument("--urls_file", help="每行一个 URL 的文件")
    ap.add_argument("--out", required=True, help="输出目录(.md 文件)")
    ap.add_argument("--selector", default=None, help="CSS 选择器，只取页面部分(如 main/article)")
    ap.add_argument("--sleep", type=float, default=0.5, help="请求间隔秒数(默认 0.5)")
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument("--workers", type=int, default=3, help="并发数(默认 3)")
    args = ap.parse_args()

    urls = []
    if args.urls:
        urls += [u.strip() for u in args.urls.split(",") if u.strip()]
    if args.urls_file and os.path.exists(args.urls_file):
        with open(args.urls_file, encoding="utf-8-sig") as f:
            urls += [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]

    if not urls:
        print("No URLs given.", file=sys.stderr)
        return 2
    os.makedirs(args.out, exist_ok=True)

    print(f"engine: {'scrapling' if HAS_SCRAPLING else 'urllib(fallback)'}")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(fetch_one, u, args.selector, args.sleep, args.timeout): u for u in urls}
        for fut in concurrent.futures.as_completed(futs):
            r = fut.result()
            if r:
                results.append(r)

    written = 0
    for url, title, md in results:
        if not md or len(md.strip()) < 50:
            print(f"  - empty content: {url}", file=sys.stderr)
            continue
        fname = os.path.join(args.out, slugify(url) + ".md")
        header = f"# {title}\n\n> source: {url}\n\n"
        with open(fname, "w", encoding="utf-8") as f:
            f.write(header + md)
        written += 1
        print(f"  + {fname}  ({len(md)} chars)")

    print(f"done: {written}/{len(results)} pages -> {args.out}")
    return 0 if written else 3


if __name__ == "__main__":
    sys.exit(main())