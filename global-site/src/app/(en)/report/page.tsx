import { ReportClient } from "@/components/ReportClient";

export const metadata = {
  title: "Your support plan — Shiftless",
  description:
    "The full derived support plan for your volume, handle time and coverage.",
  // noindex: this is a paid deliverable behind a permalink, not a landing page.
  // Indexing thousands of near-identical parameterised reports would be spam.
  robots: { index: false, follow: false },
};

/**
 * Access control, stated plainly rather than implied by a lock icon.
 *
 * This URL is the content, not a DRM boundary. The report is generated on the
 * client from the query string, so anyone who knows the permalink can render
 * it. Enforcing payment would mean a server-side check against an order
 * database, and at the volume this will realistically do, that is
 * infrastructure we cannot justify against a buyer who screenshots a page.
 *
 * The real gate is operational: the order is recorded in /api/order, payment is
 * confirmed by hand, and this link is emailed to the buyer. A guessable
 * permalink risks the product being shared, not a dollar being lost.
 */
export default function ReportPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <ReportClient />
    </main>
  );
}
