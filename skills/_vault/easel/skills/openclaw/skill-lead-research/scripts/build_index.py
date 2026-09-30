"""build_index.py — 把抓到的 Markdown 语料切块并建 BM25 倒排索引（纯标准库，中文友好）。

用法:
  python build_index.py --corpus data/corpus --index data/corpus/bm25.json
  python build_index.py --corpus data/corpus --index data/corpus/bm25.json --chunk 600 --overlap 80

说明:
  每个 .md 文件按 ~600 字切成有重叠的 chunk，chunk ID 格式 <file-id>:<start>。
  索引存到 --index 指向的 JSON；retrieve.py 用它做检索增强（RAG）。
"""
import argparse
import json
import math
import os
import re
import sys
from collections import Counter

STOPWORDS = set("""的 了 在 是 我 有 和 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 而 与 及 或 被 把 让 对 从 向 因 为 于 等 并 却 但 及 之 且 该 这些 那些 我们 你们 他们 这个 那个 一种 进行 通过 以及 比如 例如 如果 因为 所以 但 不过 还是 就是 已经 正在 将会 能够 应该 需要 可以 不同 相关 主要 目前 现在 其中 此外 另外 综上 同时 使用 提供 产品 服务 a an the of to in on for and or is are was were be been it its this that with from by as at""".split())

PUNCT = "，。；：！？、（）()【】《》「」『』\"'`~!@#$%^&*+=_|\\/<>{}[]—…·-"


def tokenize(text: str) -> list[str]:
    """中文按单字+连续字母串分词（够用于 BM25 检索），去掉标点和停用词。"""
    tokens = []
    for m in re.finditer(r"[A-Za-z0-9]+|[\u4e00-\u9fff]", text):
        t = m.group(0).lower()
        if len(t) <= 1 and t in PUNCT:
            continue
        if t in STOPWORDS:
            continue
        tokens.append(t)
    return tokens


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
    ap = argparse.ArgumentParser(description="Markdown 语料 → BM25 索引")
    ap.add_argument("--corpus", required=True, help="语料目录(.md)")
    ap.add_argument("--index", required=True, help="输出索引 JSON 路径")
    ap.add_argument("--chunk", type=int, default=600)
    ap.add_argument("--overlap", type=int, default=80)
    args = ap.parse_args()

    docs, doc_texts = [], []
    n_files = 0
    for fn in sorted(os.listdir(args.corpus)):
        if not fn.endswith(".md"):
            continue
        with open(os.path.join(args.corpus, fn), encoding="utf-8") as f:
            body = f.read()
        n_files += 1
        for i, chunk in enumerate(chunk_text(body, args.chunk, args.overlap)):
            docs.append(f"{fn}:{i}")
            doc_texts.append(chunk)

    if not docs:
        print("No markdown files found. Run gather_corpus.py first.", file=sys.stderr)
        return 2

    df = Counter()
    doc_tokens = []
    for txt in doc_texts:
        toks = tokenize(txt)
        uniq = set(toks)
        for t in uniq:
            df[t] += 1
        doc_tokens.append(Counter(toks))

    N = len(docs)
    idf = {t: math.log((N - c + 0.5) / (c + 0.5) + 1.0) for t, c in df.items()}

    os.makedirs(os.path.dirname(args.index) or ".", exist_ok=True)
    with open(args.index, "w", encoding="utf-8") as f:
        json.dump({"n_docs": N, "df": df, "idf": idf, "docs": docs, "doc_tokens": doc_tokens}, f, ensure_ascii=False)
    print(f"indexed {N} chunks from {n_files} files -> {args.index}")
    return 0


if __name__ == "__main__":
    sys.exit(main())