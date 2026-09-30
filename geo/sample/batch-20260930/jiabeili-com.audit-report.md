# AI 可见度审计 · 正式报告
**被测站点:** https://www.jiabeili.com
**扫描时间:** 2026-09-30
**扫描页面:** 6 页（首页 + 发现的关键子页面）

## 总览
| 页面 | 状态 | 得分 / 满分 |
|---|---|---|
| / | 200 | 48 / 100 |
| /nba | 200 | 48 / 100 |
| /cba | 200 | 48 / 100 |
| /yingchao | 200 | 48 / 100 |
| /xijia | 200 | 48 / 100 |
| /dejia | 200 | 48 / 100 |
| **聚合** | | **48 / 100** |

## 逐项明细（聚合所有页面最强/最弱表现）
| 检查项 | 权重 | 结果 |
|---|---|---|
| AI crawler access | 15 | No AI-crawler rules found. All 13 fall through to the wildcard/default rule — check what '*' resolves to.（页面平均 15/15） |
| Structured data (JSON-LD) | 15 | 2 type(s): WebSite, Organization（页面平均 6/15） |
| Identity + FAQ schema | 10 | ✓ Organization/Corporation (who you are) · ✗ FAQPage (question/answer pairs — the format models quote most)（页面平均 5/10） |
| Heading structure | 10 | 1 × h1, 8 × h2, 0 × h3（页面平均 6/10） |
| Question-form headings | 10 | None. These match the shape of the questions people ask an assistant, and they are the cheapest thing on this list to fix.（页面平均 0/10） |
| Authorship and dates | 8 | ✗ named author/reviewer · ✓ publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.（页面平均 4/8） |
| Outbound citations | 7 | No outbound citations. A page that cites nothing gives a model no reason to prefer it over a competitor that does.（页面平均 0/7） |
| Product/service + article schema | 5 | ✗ Product/Service · ✗ Article/BlogPosting（页面平均 0/5） |
| llms.txt | 5 | Path returns 200 but as text/html — almost certainly a catch-all, not a real llms.txt.（页面平均 0/5） |
| Content depth on this page | 5 | ~1964 words（页面平均 5/5） |
| Open Graph | 5 | Complete.（页面平均 5/5） |

## 诚实边界
本报告测量的是站点对 AI 引擎的**可读性（legibility）**，不是其在任何 AI 答案中的
"排名"或"收录"。模型输出是采样的，无人能保证排名；提供"排名保证"的服务商
卖的是它无法控制的结果。可读性是可复现、可执行的输入侧。

> 由 Shiftless 审计工具生成 · 数值可复现（重新扫描应得相同结果）

---

# 整改代码包（可直接复制粘贴）

# AI-Readiness Fix Pack for https://www.jiabeili.com

Generated: 2026-09-30 · Score: 48/100

## Structured data (JSON-LD) — gap 9/15
> 2 type(s): WebSite, Organization

### `organization.jsonld`
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://www.jiabeili.com",
  "logo": "https://www.jiabeili.com/logo.png",
  "sameAs": [
    "https://twitter.com/yourhandle",
    "https://linkedin.com/company/yourcompany"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+86-000-0000000",
    "contactType": "customer service",
    "availableLanguage": [
      "Chinese",
      "English"
    ]
  }
}
```

### `faqpage.jsonld`
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "你们的核心产品解决什么问题？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "我们帮助跨境电商卖家在 30 秒内算出真实的人力成本与 AI 自动化收益，不卖不需要的方案。"
      }
    },
    {
      "@type": "Question",
      "name": "定价模式是什么？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "按席位订阅，起步 6 席，$99–249/月。提供免费计算器自测，不强制销售。"
      }
    }
  ]
}
```

### `product.jsonld`
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Your Product Name",
  "description": "One-paragraph description of what the product does and for whom.",
  "brand": {
    "@type": "Brand",
    "name": "Your Company"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://www.jiabeili.com/pricing",
    "priceCurrency": "USD",
    "price": "99.00",
    "availability": "https://schema.org/InStock"
  }
}
```

### `article.jsonld`
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2026-09-30",
  "dateModified": "2026-09-30",
  "publisher": {
    "@type": "Organization",
    "name": "Your Company"
  },
  "description": "160-char meta description for search/social."
}
```

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
      "url": "https://www.jiabeili.com",
      "logo": "https://www.jiabeili.com/logo.png",
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

## Product/service + article schema — gap 5/5
> ✗ Product/Service · ✗ Article/BlogPosting

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
> Path returns 200 but as text/html — almost certainly a catch-all, not a real llms.txt.

### `llms.txt`
```markdown
# LLM Guidelines for Your Company

## What this site is
Your Company helps cross-border e-commerce sellers calculate true support cost and AI automation ROI.

## Key pages for citation
- Homepage: https://www.jiabeili.com/
- Pricing: https://www.jiabeili.com/pricing
- Documentation: https://www.jiabeili.com/docs
- FAQ: https://www.jiabeili.com/faq

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
> 1 × h1, 8 × h2, 0 × h3

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

## Authorship and dates — gap 4/8
> ✗ named author/reviewer · ✓ publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.

### `eeat-markup.html`
```html
<!-- E-E-A-T markup — add to article/content pages -->

<article>
  <header>
    <h1>Page Title</h1>
    <div class="byline">
      <span class="author">By <a href="/author/author-name" rel="author">Author Name</a></span>
      <time datetime="2026-09-30" itemprop="datePublished">Published Sep 30, 2026</time>
      <time datetime="2026-09-30" itemprop="dateModified">Updated Sep 30, 2026</time>
      <span class="reviewed-by">Reviewed by <a href="/reviewer/reviewer-name">Reviewer Name</a></span>
    </div>
  </header>
  <div class="content">...</div>
  <footer>
    <p>About the author: <a href="/author/author-name">Author Name</a> has X years experience in Y.</p>
  </footer>
</article>

<!-- JSON-LD for Person (author) can also be added to the page head -->
```

## Outbound citations — gap 7/7
> No outbound citations. A page that cites nothing gives a model no reason to prefer it over a competitor that does.

### `citations-guide.md`
```markdown
# Outbound Citation Strategy

Current: 0 external domains cited.

## Target: 5–10 authoritative external domains per page

## What counts as a good citation
- Official documentation (MDN, RFC, W3C, vendor docs)
- Peer-reviewed or industry reports (Gartner, Forrester, government stats)
- Primary sources (original research, datasets, standards bodies)
- NOT: competitor blogs, generic Wikipedia, link farms

## Quick wins
1. In your "How it works" section, link to the RFC/standard you implement.
2. In pricing, cite the industry benchmark report for your cost model.
3. In FAQ, link to the official docs for each integration you support.
4. Add a "Sources" section at the bottom with 3–5 links.
```
