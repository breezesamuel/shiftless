import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Shiftless — support headcount and automation ROI calculator. Free, no signup.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The OG image is the single highest-leverage asset we own for distribution.
 * Every share — Product Hunt, Reddit, Slack, an agency pasting the link into a
 * client email — renders this. Text-only posts get roughly half the click-through
 * of an image post on every platform we care about, and there is no way to A/B
 * it later, so it has to be right from the first impression.
 *
 * Sizing note: 1200x630 is the OG safe area. Chrome crops to 1.91:1 and several
 * platforms crop the bottom, so nothing important sits below y=470.
 */
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#1e40af 100%)",
          padding: "60px 70px",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            Shiftless
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            How many support agents do you actually need?
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 28,
              color: "#bfdbfe",
              maxWidth: 940,
              lineHeight: 1.35,
            }}
          >
            Free calculator. No signup. It will also tell you when automation is
            not worth buying.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {["Every constant published", "Cost per ticket benchmarks", "No cookies"].map(
            (t) => (
              <div
                key={t}
                style={{
                  fontSize: 22,
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                {t}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
