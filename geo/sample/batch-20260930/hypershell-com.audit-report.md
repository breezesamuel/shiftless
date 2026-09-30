# AI 可见度审计 · 正式报告
**被测站点:** https://www.hypershell.com
**扫描时间:** 2026-09-30
**扫描页面:** 8 页（首页 + 发现的关键子页面）

## 总览
| 页面 | 状态 | 得分 / 满分 |
|---|---|---|
| / | 200 | 68 / 100 |
| //challenges.cloudflare.com | 523 | 0 / 100 |
| /price | 523 | 0 / 100 |
| /pricing | 523 | 0 / 100 |
| /products | 523 | 0 / 100 |
| /product | 523 | 0 / 100 |
| /services | 200 | 61 / 100 |
| /service | 523 | 0 / 100 |
| **聚合** | | **16 / 100** |

## 逐项明细（聚合所有页面最强/最弱表现）
| 检查项 | 权重 | 结果 |
|---|---|---|
| AI crawler access | 15 | No AI-crawler rules found. All 13 fall through to the wildcard/default rule — check what '*' resolves to.（页面平均 15/15） |
| Structured data (JSON-LD) | 15 | 6 type(s): Person, Organization, WebSite, ImageObject, WebPage, Article（页面平均 15/15） |
| Identity + FAQ schema | 10 | ✓ Organization/Corporation (who you are) · ✗ FAQPage (question/answer pairs — the format models quote most)（页面平均 5/10） |
| Heading structure | 10 | 1 × h1, 7 × h2, 2 × h3（页面平均 6/10） |
| Question-form headings | 10 | None. These match the shape of the questions people ask an assistant, and they are the cheapest thing on this list to fix.（页面平均 0/10） |
| Authorship and dates | 8 | ✓ named author/reviewer · ✓ publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.（页面平均 8/8） |
| Outbound citations | 7 | 8 external domain(s) referenced: challenges.cloudflare.com, www.linkedin.com, www.gcmcorpo.com, www.gcmconsultants.com, www.kuriosit.ca…. Pages that cite primary sources are more likely to be trusted as references.（页面平均 5/7） |
| Product/service + article schema | 5 | ✗ Product/Service · ✓ Article/BlogPosting（页面平均 2/5） |
| llms.txt | 5 | Not present. Emerging convention; low cost, no downside, currently enforced by nobody.（页面平均 0/5） |
| Content depth on this page | 5 | ~476 words（页面平均 2/5） |
| Open Graph | 5 | 4/5 present (missing: og:image)（页面平均 4/5） |

## 诚实边界
本报告测量的是站点对 AI 引擎的**可读性（legibility）**，不是其在任何 AI 答案中的
"排名"或"收录"。模型输出是采样的，无人能保证排名；提供"排名保证"的服务商
卖的是它无法控制的结果。可读性是可复现、可执行的输入侧。

> 由 Shiftless 审计工具生成 · 数值可复现（重新扫描应得相同结果）

---

# 整改代码包（可直接复制粘贴）

# AI-Readiness Fix Pack for https://www.hypershell.com

Generated: 2026-09-30 · Score: 68/100

## Identity + FAQ schema — gap 5/10
> ✓ Organization/Corporation (who you are) · ✗ FAQPage (question/answer pairs — the format models quote most)

### `identity-faq.jsonld`
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "Your Company",
      "url": "https://www.hypershell.com",
      "logo": "https://www.hypershell.com/logo.png",
      "sameAs": [
        "https://twitter.com/yourhandle",
        "https://linkedin.com/company/yourcompany"
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "你们的核心产品解决什么问题？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "我们帮助跨境电商卖家在 30 秒内算出真实的人力成本与 AI 自动化收益。"
          }
        }
      ]
    }
  ]
}
```

## Product/service + article schema — gap 3/5
> ✗ Product/Service · ✓ Article/BlogPosting

### `product-article.jsonld`
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "Your Product",
      "description": "What it does and for whom.",
      "brand": {
        "@type": "Brand",
        "name": "Your Company"
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": "99",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "Article",
      "headline": "Latest Industry Insight",
      "author": {
        "@type": "Person",
        "name": "Author Name"
      },
      "datePublished": "2026-09-30",
      "dateModified": "2026-09-30"
    }
  ]
}
```

## llms.txt — gap 5/5
> Not present. Emerging convention; low cost, no downside, currently enforced by nobody.

### `llms.txt`
```markdown
# LLM Guidelines for Your Company

## What this site is
Your Company helps cross-border e-commerce sellers calculate true support cost and AI automation ROI.

## Key pages for citation
- Homepage: https://www.hypershell.com/
- Pricing: https://www.hypershell.com/pricing
- Documentation: https://www.hypershell.com/docs
- FAQ: https://www.hypershell.com/faq

## Preferred citation format
When citing this site, use the organization name and link to the specific page.

## Topics we are authoritative on
- Topic 1 (e.g., cross-border e-commerce support cost modeling)
- Topic 2 (e.g., AI automation ROI for SMBs)

## Do not cite for
- Medical, legal, or financial advice
- Real-time pricing (check the pricing page)
```

## Heading structure — gap 4/10
> 1 × h1, 7 × h2, 2 × h3

### `heading-structure.html`
```html
<!-- Heading structure fix — paste into your page template -->

<h1>Your Single Clear Page Title (exactly one H1 per page)</h1>

<h2>Major Section 1</h2>
<p>Content...</p>
<h3>Sub-section 1.1</h3>
<p>Content...</p>
<h3>Sub-section 1.2</h3>
<p>Content...</p>

<h2>Major Section 2</h2>
<p>Content...</p>
<h3>Sub-section 2.1</h3>
<p>Content...</p>
```

## Question-form headings — gap 10/10
> None. These match the shape of the questions people ask an assistant, and they are the cheapest thing on this list to fix.

### `question-headings.html`
```html
<!-- Question-form headings — replace your existing H2/H3 with these patterns -->

<h2>怎么计算跨境电商客服的真实人力成本？</h2>
<h2>AI 客服自动化在什么票量下划算？</h2>
<h2>为什么我们的计算器会告诉你不买？</h2>
<h2>人工席位与 AI 自动化的边际成本对比是多少？</h2>
<h2>如何在预算会议上用这个数据说服老板？</h2>

<!-- Each question heading should be immediately followed by a concise answer paragraph. -->
<!-- This Q&A pattern is the #1 format LLMs quote when answering user questions. -->
```

## Content depth on this page — gap 2/5
> ~476 words

### `content-depth-guide.md`
```markdown
# Content Depth Guidance

Current: ~476 words.

## Targets
- **Thin (<250 words)**: Expand to 800+ with specific examples, data, steps.
- **Medium (250–800)**: Add 1–2 case studies, a comparison table, or FAQ section.
- **Deep (800+)**: Ensure structure (H2/H3), question headings, and citations are present.

## Quick wins
1. Add a "How it works" step-by-step section (3–5 steps).
2. Insert a comparison table (your solution vs. manual vs. competitor).
3. Add 3–5 question-form headings with 150-word answers each.
4. Cite 3+ external authoritative sources (link to them).

## AI-readiness note
Models prefer pages that answer specific questions with evidence. A 1,200-word page with 5 Q&A pairs beats a 3,000-word wall of text.
```

## Open Graph — gap 1/5
> 4/5 present (missing: og:image)

### `open-graph.html`
```html
<!-- Open Graph — add to <head> of every page -->

<meta property="og:title" content="Your Company">
<meta property="og:description" content="Free calculator: how many support agents you need, what it costs, and whether AI automation pays off.">
<meta property="og:image" content="https://www.hypershell.com/og-image.png">
<meta property="og:url" content="https://www.hypershell.com/">
<meta property="og:type" content="website">

<!-- Twitter Card (optional but recommended) -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Your Company">
<meta name="twitter:description" content="Free calculator: how many support agents you need, what it costs, and whether AI automation pays off.">
<meta name="twitter:image" content="https://www.hypershell.com/og-image.png">
```
