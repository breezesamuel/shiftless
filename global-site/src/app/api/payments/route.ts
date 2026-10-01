import { NextResponse } from "next/server";

import { paymentChannels, anyChannelLive } from "@/lib/payments";

/**
 * Which payment channels can actually take money right now.
 *
 * Returns labels and booleans only. No merchant id, no key material, and no
 * `blockedOn` detail — the operator-facing "you still need X" text stays on the
 * server, because naming the exact missing env var tells an attacker which
 * secrets the deployment is expected to hold.
 */
export async function GET() {
  const channels = paymentChannels();

  return NextResponse.json(
    {
      ok: true,
      anyLive: anyChannelLive(),
      channels: channels.map((c) => ({
        id: c.id,
        label: c.label,
        live: c.live,
      })),
    },
    {
      headers: {
        // Channel availability changes only when the operator changes env vars,
        // which restarts the deployment. A short cache avoids a request per
        // page view without going stale in a way anyone would notice.
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}
