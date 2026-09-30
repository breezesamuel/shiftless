import { FAQ } from "@/lib/faq";

/**
 * JSON-LD.
 *
 * Two things this buys, in order of value:
 * 1. FAQPage schema lets the FAQ block compete for rich results. The block was
 *    already written; without schema it is invisible as a SERP feature.
 * 2. SoftwareApplication / Organization / BreadcrumbList give the entity model,
 *    which is a prerequisite for eligibility in AI answer surfaces — the
 *    fastest-growing referral channel for a tool like this.
 *
 * Implementation note, learned the hard way: this was originally a client
 * component using next/script, which rendered NOTHING into the served HTML
 * because next/script defers to afterInteractive. Google and most crawlers do
 * not execute JS, so a schema that only exists after hydration is worth nothing.
 * It must be a server component emitting a raw <script> tag in the document.
 *
 * FAQ copy is imported from src/lib/faq.ts, the same array the visible FAQ block
 * renders, so the schema can never describe different questions than the page
 * shows.
 */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://shiftless.vercel.app/#website",
        url: "https://shiftless.vercel.app",
        name: "Shiftless",
        description:
          "Free support headcount and customer service automation ROI calculator.",
        inLanguage: "en",
        publisher: { "@id": "https://shiftless.vercel.app/#org" },
      },
      {
        "@type": "Organization",
        "@id": "https://shiftless.vercel.app/#org",
        name: "Shanghai Bingdashan Intelligent Technology Co., Ltd.",
        alternateName: "上海丙大山智能科技有限公司",
        url: "https://shiftless.vercel.app",
      },
      {
        "@type": "WebApplication",
        name: "Support Headcount & Automation ROI Calculator",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        url: "https://shiftless.vercel.app",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Support headcount from ticket volume and handle time",
          "Fully loaded cost per agent",
          "Automation payback and year-1 return",
          "Industry automation ceilings",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": "https://shiftless.vercel.app/#faq",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Calculator",
            item: "https://shiftless.vercel.app/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Benchmarks",
            item: "https://shiftless.vercel.app/benchmarks",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "AI vs human cost",
            item: "https://shiftless.vercel.app/ai-vs-human-cost",
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Serialization of a local constant — no untrusted input. The escape
      // guards against a script-breakout if any copy ever gains a "</script>".
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
