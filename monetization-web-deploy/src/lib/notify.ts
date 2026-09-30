// Zero-account push delivery via ntfy.sh — the user subscribes on their phone and
// receives every lead/order instantly. No signup, no API key, no third-party account.
//
// NOTE: we deliberately use ntfy's header API (RFC 2047 encoded headers, empty body)
// rather than a JSON/form body. Body-based publishing was being mangled in transit and
// arrived as a raw blob instead of a parsed notification.
//
// Reliability: ntfy is a free public service and can rate-limit or blip. A missed
// notification means a lost lead, because orders are not persisted server-side.
// So we publish to a primary and a backup topic and retry with backoff.
const NTFTY_BASE = "https://ntfy.sh";

const PRIORITY: Record<string, number> = { min: 1, default: 3, high: 4, max: 5 };

/** RFC 2047 base64 encoding so non-ASCII titles survive as HTTP headers. */
function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function ntfyTopics(): string[] {
  return [process.env.NTFY_TOPIC ?? "", process.env.NTFY_TOPIC_BACKUP ?? ""].filter(Boolean);
}

async function publish(
  topic: string,
  title: string,
  message: string,
  priority: "min" | "default" | "high" | "max",
  tags: string[],
): Promise<boolean> {
  const res = await fetch(`${NTFTY_BASE}/${topic}`, {
    method: "POST",
    headers: {
      Title: encodeHeader(title),
      Message: encodeHeader(message),
      Priority: String(PRIORITY[priority] ?? 4),
      Tags: tags.join(","),
    },
    body: "",
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

export async function ntfy(
  title: string,
  message: string,
  priority: "min" | "default" | "high" | "max" = "high",
  tags: string[] = ["money"],
): Promise<boolean> {
  const topics = ntfyTopics();
  if (topics.length === 0) return false;

  for (let attempt = 0; attempt < 3; attempt++) {
    // deliver to every configured topic before giving up on this attempt
    const results = await Promise.all(
      topics.map((t) =>
        publish(t, title, message, priority, tags).catch(() => false),
      ),
    );
    if (results.some(Boolean)) return true;
    // 400ms, 1200ms — enough to ride out a transient rate limit
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1) ** 2));
  }
  return false;
}
