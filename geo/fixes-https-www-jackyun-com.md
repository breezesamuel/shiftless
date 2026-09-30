# AI-Readiness Fix Pack for https://www.jackyun.com/

Generated: 2026-09-30 · Score: 35/100

## Structured data (JSON-LD) — gap 15/15
> No JSON-LD found. Entity extraction for AI answers is manual and error-prone without it.

### `organization.jsonld`
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://www.jackyun.com",
  "logo": "https://www.jackyun.com/logo.png",
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
    "url": "https://www.jackyun.com/pricing",
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

## Identity + FAQ schema — gap 10/10
> 鉁?Organization/Corporation (who you are) 路 鉁?FAQPage (question/answer pairs 鈥?the format models quote most)

### `identity-faq.jsonld`
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "Your Company",
      "url": "https://www.jackyun.com",
      "logo": "https://www.jackyun.com/logo.png",
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
> 鉁?Product/Service 路 鉁?Article/BlogPosting

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

## Heading structure — gap 7/10
> 2 脳 h1 (exactly one is the convention; 0 leaves the page untitled, >1 splits the subject), 12 脳 h2, 4 脳 h3

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

## Authorship and dates — gap 8/8
> 鉁?named author/reviewer 路 鉁?publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.

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

## Content depth on this page — gap 2/5
> ~499 words

### `content-depth-guide.md`
```markdown
# Content Depth Guidance

Current: ~499 words.

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

## Open Graph — gap 5/5
> 0/5 present (missing: og:title, og:description, og:image, og:url, og:type)

### `open-graph.html`
```html
<!-- Open Graph — add to <head> of every page -->

<meta property="og:title" content="Your Company">
<meta property="og:description" content="Free calculator: how many support agents you need, what it costs, and whether AI automation pays off.">
<meta property="og:image" content="https://www.jackyun.com/og-image.png">
<meta property="og:url" content="https://www.jackyun.com/">
<meta property="og:type" content="website">

<!-- Twitter Card (optional but recommended) -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Your Company">
<meta name="twitter:description" content="Free calculator: how many support agents you need, what it costs, and whether AI automation pays off.">
<meta name="twitter:image" content="https://www.jackyun.com/og-image.png">
```
