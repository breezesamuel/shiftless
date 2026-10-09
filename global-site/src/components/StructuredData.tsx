import { FAQ } from "@/lib/faq";
import { SITE_URL } from "@/lib/site";

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
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Shiftless",
        description:
          "Free support headcount and customer service automation ROI calculator.",
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Shanghai Bingdashan Intelligent Technology Co., Ltd.",
        alternateName: "上海丙大山智能科技有限公司",
        url: SITE_URL,
      },
      {
        "@type": "WebApplication",
        name: "Support Headcount & Automation ROI Calculator",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        url: SITE_URL,
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
        "@id": `${SITE_URL}/#faq`,
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
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Benchmarks",
            item: `${SITE_URL}/benchmarks`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "AI vs human cost",
            item: `${SITE_URL}/ai-vs-human-cost`,
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