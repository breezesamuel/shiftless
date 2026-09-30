const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__rateBuckets ??= new Map<string, Bucket>());

export function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  const agent = headers.get("user-agent") ?? "";
  const digest = [...agent].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);
  return `${ip}:${digest}`;
}

export function rateLimit(key: string, max = MAX_PER_WINDOW): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

export function isHoneypotTripped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const trap = record.website ?? record.company_url ?? record.fax;
  return typeof trap === "string" && trap.trim().length > 0;
}
