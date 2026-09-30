#!/usr/bin/env node
/**
 * AI-readiness fix generator — turns audit failures into copy-pasteable code.
 *
 * Usage:
 *   node fix-generator.js --audit=jackyun.raw.json
 *   node fix-generator.js --url=https://example.com --json
 *
 * Reads audit JSON (from audit.js --json), produces a markdown file with
 * per-check code snippets the dev/SEO can paste directly.
 */
const fs = require("fs");
const { URL } = require("url");

const args = process.argv.slice(2);
const auditPath = args.find((a) => a.startsWith("--audit="))?.split("=")[1];
const targetUrl = args.find((a) => a.startsWith("--url="))?.split("=")[1];
const outputPath = args.find((a) => a.startsWith("--output="))?.split("=")[1];
const asJson = args.includes("--json");

if (!auditPath && !targetUrl) {
  console.error("usage: node fix-generator.js --audit=<file.json>  OR  --url=<url> [--json]");
  process.exit(2);
}

/** ---------- Fix templates per check ---------- */
const FIXES = {
  robots: (ctx) => {
    const lines = [
      "# AI crawler allowances — add to robots.txt",
      "",
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      "",
      "User-agent: PerplexityBot",
      "Allow: /",
      "",
      "User-agent: Google-Extended",
      "Allow: /",
      "",
      "User-agent: Applebot-Extended",
      "Allow: /",
      "",
      "User-agent: Bytespider",
      "Allow: /",
      "",
      "User-agent: CCBot",
      "Allow: /",
      "",
      "User-agent: Baiduspider",
      "Allow: /",
      "",
      "# Keep your existing rules below — the above only ADD allowances for AI crawlers",
    ];
    return { file: "robots.txt", lang: "text", content: lines.join("\n") };
  },

  jsonld: (ctx) => {
    const blocks = [];
    // Organization (identity)
    blocks.push({
      file: "organization.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: ctx.siteName || "Your Company",
        url: ctx.origin,
        logo: `${ctx.origin}/logo.png`,
        sameAs: [
          "https://twitter.com/yourhandle",
          "https://linkedin.com/company/yourcompany",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+86-000-0000000",
          contactType: "customer service",
          availableLanguage: ["Chinese", "English"],
        },
      }, null, 2),
    });
    // FAQPage (question/answer pairs — highest signal for AI answers)
    blocks.push({
      file: "faqpage.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "你们的核心产品解决什么问题？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "我们帮助跨境电商卖家在 30 秒内算出真实的人力成本与 AI 自动化收益，不卖不需要的方案。",
            },
          },
          {
            "@type": "Question",
            name: "定价模式是什么？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "按席位订阅，起步 6 席，$99–249/月。提供免费计算器自测，不强制销售。",
            },
          },
        ],
      }, null, 2),
    });
    // Product (for pricing/feature pages)
    blocks.push({
      file: "product.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Your Product Name",
        description: "One-paragraph description of what the product does and for whom.",
        brand: { "@type": "Brand", name: "Your Company" },
        offers: {
          "@type": "Offer",
          url: `${ctx.origin}/pricing`,
          priceCurrency: "USD",
          price: "99.00",
          availability: "https://schema.org/InStock",
        },
      }, null, 2),
    });
    // Article (for blog/content pages)
    blocks.push({
      file: "article.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Your Article Title",
        author: { "@type": "Person", name: "Author Name" },
        datePublished: "2026-09-30",
        dateModified: "2026-09-30",
        publisher: { "@type": "Organization", name: "Your Company" },
        description: "160-char meta description for search/social.",
      }, null, 2),
    });
    return blocks;
  },

  "schema-identity": (ctx) => {
    // Combined Organization + FAQPage in one block (recommended for homepage)
    return [{
      file: "identity-faq.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: ctx.siteName || "Your Company",
            url: ctx.origin,
            logo: `${ctx.origin}/logo.png`,
            sameAs: ["https://twitter.com/yourhandle", "https://linkedin.com/company/yourcompany"],
          },
          {
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "你们的核心产品解决什么问题？",
                acceptedAnswer: { "@type": "Answer", text: "我们帮助跨境电商卖家在 30 秒内算出真实的人力成本与 AI 自动化收益。" },
              },
            ],
          },
        ],
      }, null, 2),
    }];
  },

  "schema-content": (ctx) => {
    return [{
      file: "product-article.jsonld",
      lang: "json",
      content: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Product",
            name: "Your Product",
            description: "What it does and for whom.",
            brand: { "@type": "Brand", name: ctx.siteName || "Your Company" },
            offers: { "@type": "Offer", priceCurrency: "USD", price: "99", availability: "https://schema.org/InStock" },
          },
          {
            "@type": "Article",
            headline: "Latest Industry Insight",
            author: { "@type": "Person", name: "Author Name" },
            datePublished: "2026-09-30",
            dateModified: "2026-09-30",
          },
        ],
      }, null, 2),
    }];
  },

  llms: (ctx) => {
    const lines = [
      "# LLM Guidelines for " + (ctx.siteName || "Your Site"),
      "",
      "## What this site is",
      `${ctx.siteName || "Your Company"} helps ${ctx.audience || "your target audience"} ${ctx.valueProp || "solve their problem"}.`,
      "",
      "## Key pages for citation",
      `- Homepage: ${ctx.origin}/`,
      `- Pricing: ${ctx.origin}/pricing`,
      `- Documentation: ${ctx.origin}/docs`,
      `- FAQ: ${ctx.origin}/faq`,
      "",
      "## Preferred citation format",
      "When citing this site, use the organization name and link to the specific page.",
      "",
      "## Topics we are authoritative on",
      "- Topic 1 (e.g., cross-border e-commerce support cost modeling)",
      "- Topic 2 (e.g., AI automation ROI for SMBs)",
      "",
      "## Do not cite for",
      "- Medical, legal, or financial advice",
      "- Real-time pricing (check the pricing page)",
    ];
    return { file: "llms.txt", lang: "markdown", content: lines.join("\n") };
  },

  headings: (ctx) => {
    const lines = [
      "<!-- Heading structure fix — paste into your page template -->",
      "",
      "<h1>Your Single Clear Page Title (exactly one H1 per page)</h1>",
      "",
      "<h2>Major Section 1</h2>",
      "<p>Content...</p>",
      "<h3>Sub-section 1.1</h3>",
      "<p>Content...</p>",
      "<h3>Sub-section 1.2</h3>",
      "<p>Content...</p>",
      "",
      "<h2>Major Section 2</h2>",
      "<p>Content...</p>",
      "<h3>Sub-section 2.1</h3>",
      "<p>Content...</p>",
    ];
    return { file: "heading-structure.html", lang: "html", content: lines.join("\n") };
  },

  questions: (ctx) => {
    const examples = [
      "怎么计算跨境电商客服的真实人力成本？",
      "AI 客服自动化在什么票量下划算？",
      "为什么我们的计算器会告诉你不买？",
      "人工席位与 AI 自动化的边际成本对比是多少？",
      "如何在预算会议上用这个数据说服老板？",
    ];
    const lines = [
      "<!-- Question-form headings — replace your existing H2/H3 with these patterns -->",
      "",
      ...examples.map((q) => `<h2>${q}</h2>`),
      "",
      "<!-- Each question heading should be immediately followed by a concise answer paragraph. -->",
      "<!-- This Q&A pattern is the #1 format LLMs quote when answering user questions. -->",
    ];
    return { file: "question-headings.html", lang: "html", content: lines.join("\n") };
  },

  eeat: (ctx) => {
    const lines = [
      "<!-- E-E-A-T markup — add to article/content pages -->",
      "",
      "<article>",
      "  <header>",
      "    <h1>Page Title</h1>",
      "    <div class=\"byline\">",
      "      <span class=\"author\">By <a href=\"/author/author-name\" rel=\"author\">Author Name</a></span>",
      "      <time datetime=\"2026-09-30\" itemprop=\"datePublished\">Published Sep 30, 2026</time>",
      "      <time datetime=\"2026-09-30\" itemprop=\"dateModified\">Updated Sep 30, 2026</time>",
      "      <span class=\"reviewed-by\">Reviewed by <a href=\"/reviewer/reviewer-name\">Reviewer Name</a></span>",
      "    </div>",
      "  </header>",
      "  <div class=\"content\">...</div>",
      "  <footer>",
      "    <p>About the author: <a href=\"/author/author-name\">Author Name</a> has X years experience in Y.</p>",
      "  </footer>",
      "</article>",
      "",
      "<!-- JSON-LD for Person (author) can also be added to the page head -->",
    ];
    return { file: "eeat-markup.html", lang: "html", content: lines.join("\n") };
  },

  depth: (ctx) => {
    return {
      file: "content-depth-guide.md",
      lang: "markdown",
      content: [
        "# Content Depth Guidance",
        "",
        `Current: ~${ctx.words || "?"} words.`,
        "",
        "## Targets",
        "- **Thin (<250 words)**: Expand to 800+ with specific examples, data, steps.",
        "- **Medium (250–800)**: Add 1–2 case studies, a comparison table, or FAQ section.",
        "- **Deep (800+)**: Ensure structure (H2/H3), question headings, and citations are present.",
        "",
        "## Quick wins",
        "1. Add a \"How it works\" step-by-step section (3–5 steps).",
        "2. Insert a comparison table (your solution vs. manual vs. competitor).",
        "3. Add 3–5 question-form headings with 150-word answers each.",
        "4. Cite 3+ external authoritative sources (link to them).",
        "",
        "## AI-readiness note",
        "Models prefer pages that answer specific questions with evidence. A 1,200-word page with 5 Q&A pairs beats a 3,000-word wall of text.",
      ].join("\n"),
    };
  },

  citations: (ctx) => {
    return {
      file: "citations-guide.md",
      lang: "markdown",
      content: [
        "# Outbound Citation Strategy",
        "",
        `Current: ${ctx.extCount || 0} external domains cited.`,
        "",
        "## Target: 5–10 authoritative external domains per page",
        "",
        "## What counts as a good citation",
        "- Official documentation (MDN, RFC, W3C, vendor docs)",
        "- Peer-reviewed or industry reports (Gartner, Forrester, government stats)",
        "- Primary sources (original research, datasets, standards bodies)",
        "- NOT: competitor blogs, generic Wikipedia, link farms",
        "",
        "## Quick wins",
        "1. In your \"How it works\" section, link to the RFC/standard you implement.",
        "2. In pricing, cite the industry benchmark report for your cost model.",
        "3. In FAQ, link to the official docs for each integration you support.",
        "4. Add a \"Sources\" section at the bottom with 3–5 links.",
      ].join("\n"),
    };
  },

  social: (ctx) => {
    const lines = [
      "<!-- Open Graph — add to <head> of every page -->",
      "",
      `<meta property="og:title" content="${ctx.siteName || "Your Page Title"}">`,
      `<meta property="og:description" content="${ctx.metaDesc || "160-char description for social shares"}">`,
      `<meta property="og:image" content="${ctx.origin}/og-image.png">`,
      `<meta property="og:url" content="${ctx.origin}${ctx.path || "/"}">`,
      `<meta property="og:type" content="website">`,
      "",
      "<!-- Twitter Card (optional but recommended) -->",
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${ctx.siteName || "Your Page Title"}">`,
      `<meta name="twitter:description" content="${ctx.metaDesc || "160-char description"}">`,
      `<meta name="twitter:image" content="${ctx.origin}/og-image.png">`,
    ];
    return { file: "open-graph.html", lang: "html", content: lines.join("\n") };
  },
};

/** ---------- Helpers ---------- */
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function extractContext(audit) {
  const u = new URL(audit.url);
  return {
    origin: u.origin,
    path: u.pathname,
    siteName: audit.checks.find((c) => c.id === "schema-identity")?.detail?.includes("✓")
      ? "Your Company"
      : "Your Company",
    words: audit.checks.find((c) => c.id === "depth")?.detail?.match(/~(\d+)/)?.[1] || "?",
    extCount: audit.checks.find((c) => c.id === "citations")?.detail?.match(/(\d+) external/)?.[1] || 0,
    audience: "cross-border e-commerce sellers",
    valueProp: "calculate true support cost and AI automation ROI",
    metaDesc: "Free calculator: how many support agents you need, what it costs, and whether AI automation pays off.",
  };
}

/** ---------- Main ---------- */
async function main() {
  let audit;
  if (auditPath) {
    const raw = fs.readFileSync(auditPath, "utf8");
    audit = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } else {
    // Would need to call audit.js programmatically — for now require --audit
    console.error("Direct URL mode not yet implemented; use --audit=<file.json>");
    process.exit(2);
  }

  const ctx = extractContext(audit);
  const out = [];
  out.push(`# AI-Readiness Fix Pack for ${audit.url}`);
  out.push(`\nGenerated: ${new Date().toISOString().slice(0, 10)} · Score: ${audit.score}/100\n`);

  for (const check of audit.checks) {
    const gap = check.weight - check.score;
    if (gap === 0) continue; // only output fixes for gaps
    const fixFn = FIXES[check.id];
    if (!fixFn) continue;

    const fix = fixFn(ctx);
    const fixes = Array.isArray(fix) ? fix : [fix];
    out.push(`## ${check.label} — gap ${gap}/${check.weight}`);
    out.push(`> ${check.detail}\n`);
    for (const f of fixes) {
      out.push(`### \`${f.file}\``);
      out.push(`\`\`\`${f.lang}`);
      out.push(f.content);
      out.push(`\`\`\`\n`);
    }
  }

  const markdown = out.join("\n");
  if (asJson) {
    console.log(JSON.stringify({ url: audit.url, fixes: markdown }, null, 2));
  } else {
const outfile = outputPath || `fixes-${slugify(audit.url)}.md`;
  fs.writeFileSync(outfile, markdown, "utf8");
  if (!outputPath) console.log(`Written: ${outfile} (${Math.round(markdown.length / 1024)} KB)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });