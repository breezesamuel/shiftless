"""retrieve.py — BM25 检索增强生成(RAG)的检索端：给定 query，返回相关语料片段。

用法:
  python retrieve.py --index data/corpus/bm25.json --corpus data/corpus --query "他们的定价策略" --top 5
  python retrieve.py --index data/corpus/bm25.json --corpus data/corpus --query "用户痛点" --top 5 --context 400

输出:
  按相关度排序的语料片段（含来源文件、块号、得分、片段文本），供大模型做 grounded 生成。
  片段文本从 --corpus 目录下的 .md 原文件原样截取，短于 context 则整块输出。
"""
import argparse
import json
import math
import os
import re
import sys
from collections import Counter

STOPWORDS = set("""的 了 在 是 我 有 和 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 而 与 及 或 被 把 让 对 从 向 因 为 于 等 并 却 但 及 之 且 该 这些 那些 我们 你们 他们 这个 那个 一种 进行 通过 以及 比如 例如 如果 因为 所以 但 不过 还是 就是 已经 正在 将会 能够 应该 需要 可以 不同 相关 主要 目前 现在 其中 此外 另外 综上 同时 使用 提供 产品 服务 a an the of to in on for and or is are was were be been it its this that with from by as at 等""".split())
PUNCT = "，。；：！？、（）()【】《》「」『』\"'`~!@#$%^&*+=_|\\/<>{}[]—…·-"


def tokenize(text: str) -> list[str]:
    out = []
    for m in re.finditer(r"[A-Za-z0-9]+|[\u4e00-\u9fff]", text):
        t = m.group(0).lower()
        if t in STOPWORDS or (len(t) <= 1 and t in PUNCT) or len(t) == 0:
            continue
        out.append(t)
    return out


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    text = re.sub(r"\n\s*\n+", "\n", text).strip()
    if len(text) <= size:
        return [text] if text else []
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + size])
        start += max(1, size - overlap)
    return chunks


def main() -> int:
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="BM25 检索增强生成")
    ap.add_argument("--index", required=True, help="build_index.py 产出的 JSON")
    ap.add_argument("--corpus", required=True, help="语料目录(与建索引时同一个)")
    ap.add_argument("--query", required=True, help="查询")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--context", type=int, default=600, help="每片段最长输出字数")
    ap.add_argument("--chunk", type=int, default=600, help="必须与 build_index.py 的 --chunk 一致")
    ap.add_argument("--overlap", type=int, default=80, help="必须与 build_index.py 的 --overlap 一致")
    args = ap.parse_args()

    with open(args.index, encoding="utf-8") as f:
        idx = json.load(f)
    N = idx["n_docs"]
    idf = idx["idf"]
    docs = idx["docs"]
    doc_tokens = [Counter(dt) for dt in idx["doc_tokens"]]

    q_toks = tokenize(args.query)
    if not q_toks:
        print("empty query after tokenization", file=sys.stderr)
        return 2
    k1, b, avgdl = 1.5, 0.75, 0.0
    lens = [sum(dt.values()) for dt in doc_tokens]
    avgdl = sum(lens) / N if N else 1.0

    scores = []
    for i, dt in enumerate(doc_tokens):
        dl = lens[i]
        s = 0.0
        for t in q_toks:
            f = dt.get(t, 0)
            if f:
                s += idf.get(t, 0.0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl)))
        if s > 0:
            scores.append((s, i))
    scores.sort(reverse=True)

    # 从语料重切块，按 chunk id (file:start) 还原文本
    file_cache = {}
    def chunk_id_to_text(doc_id: str) -> str:
        fn, _, off = doc_id.rpartition(":")
        off = int(off)
        if fn not in file_cache:
            with open(os.path.join(args.corpus, fn), encoding="utf-8") as f:
                file_cache[fn] = re.sub(r"\n\s*\n+", "\n", f.read()).strip()
        chunks = chunk_text(file_cache[fn], args.chunk, args.overlap)
        return chunks[off] if off < len(chunks) else chunks[0] if chunks else ""

    print(f"top-{args.top} hits (query: {args.query})\n")
    for rank, (s, i) in enumerate(scores[: args.top], 1):
        doc_id = docs[i]
        txt = chunk_id_to_text(doc_id)
        print(f"[{rank}] score={s:.3f}  source={doc_id}")
        print("----")
        print(txt[: args.context])
        print()
    if not scores:
        print("no hits — 尝试换关键词，或先确认语料与索引匹配")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())