import type { Metadata } from "next";
import { EmbedCalculator } from "@/components/EmbedCalculator";

export const metadata: Metadata = {
  title: "Embed: Support Headcount Calculator",
  description:
    "Embeddable support headcount and automation ROI calculator. Same model as the main tool, no cookies, no email, no lead capture.",
  robots: { index: false, follow: true },
};

export default function EmbedPage() {
  return (
    <div style={{ background: "#fff", padding: 24 }}>
      <EmbedCalculator />
    </div>
  );
}
