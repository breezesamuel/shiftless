import { kv } from "@vercel/kv";
import { get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";
import crypto from "crypto";

export type User = {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
};

export type Quota = {
  uses: number;
  resetAt: string;
};

const FREE_USES_LIMIT = 10;
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;
const TTL_1Y = 60 * 60 * 24 * 365;

/**
 * Thrown when no KV store is wired up. Callers must translate this into an
 * explicit "not ready" response instead of letting it surface as a 500 — a
 * blank 500 would read as "your quota is broken" rather than "we have not
 * provisioned the database yet".
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super("KV storage is not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing)");
    this.name = "StorageNotConfiguredError";
  }
}

export function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

function requireKv() {
  if (!isKvConfigured()) throw new StorageNotConfiguredError();
  return kv;
}

/**
 * Vercel Blob fallback for lead capture.
 *
 * The Upstash integration needs a browser OAuth click, which means lead storage
 * was one person-shaped step away from being permanently unconfigured — and an
 * unconfigured store means every captured email is silently dropped. Blob needs
 * no such step: the token is already in the environment, the store is linked to
 * the project, and it is created by the same account as the site.
 *
 * So Blob is the floor, not the ceiling. KV stays preferred when present because
 * it has TTLs and an index that make quota and auth cheap. Blob is used when it
 * is not, because losing a lead is not recoverable and losing a KV round-trip is.
 */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * True when a lead can be persisted somewhere real. This is deliberately wider
 * than isKvConfigured(): any one durable sink is enough to keep the funnel
 * honest, and the health endpoint reports which one is actually carrying it.
 */
export function isLeadStorageConfigured(): boolean {
  return isKvConfigured() || isBlobConfigured();
}

const LEAD_PREFIX = "leads/";

/** Blob has no TTL, so the retention window is applied on read instead. */
function leadIsFresh(iso: string | undefined, ttlSeconds: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < ttlSeconds * 1000;
}

async function readBlob(pathname: string): Promise<string | null> {
  const res = await blobGet(pathname, { access: "private" });
  if (!res || res.statusCode === 304 || !res.stream) return null;
  return new Response(res.stream).text();
}

export function storageState(): "ready" | "unconfigured" {
  return isKvConfigured() ? "ready" : "unconfigured";
}

function monthResetAt(now = new Date()): string {
  return new Date(now.getTime() + MS_PER_MONTH).toISOString();
}

export async function getOrCreateUser(email: string): Promise<User> {
  const store = requireKv();
  const e = email.toLowerCase();
  const id = crypto
    .createHash("sha256")
    .update("user:" + e)
    .digest("hex")
    .slice(0, 16);
  const key = `user:${id}`;
  const existing = await store.get<User>(key);
  if (existing) return existing;
  const user: User = { id, email: e, createdAt: new Date().toISOString() };
  await store.set(key, user, { ex: TTL_1Y });
  await store.set(`email:${e}`, id, { ex: TTL_1Y });
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const store = requireKv();
  const e = email.toLowerCase();
  const id = await store.get<string>(`email:${e}`);
  if (!id) return null;
  const u = await store.get<User>(`user:${id}`);
  return u || null;
}

export async function getQuota(userId: string): Promise<Quota> {
  const store = requireKv();
  const key = `quota:${userId}`;
  const q = await store.get<Quota>(key);
  if (q) return q;
  const fresh: Quota = { uses: 0, resetAt: monthResetAt() };
  await store.set(key, fresh, { ex: TTL_1Y });
  return fresh;
}

/**
 * Consume one free use.
 *
 * This is a read-then-write, so two concurrent requests can both pass the limit
 * check and overshoot by one. That is deliberate for now: the KV REST client
 * has no atomic compare-and-set, and paying for a Postgres row lock to keep an
 * anonymous free tier exactly at 10 is not worth it yet. If the free tier ever
 * becomes the metered product rather than the funnel, move this to a
 * transactional increment.
 */
export async function bumpQuotaIfFree(
  userId: string,
  now = new Date()
): Promise<{ allowed: boolean; quota: Quota }> {
  const store = requireKv();
  const key = `quota:${userId}`;
  let q = await store.get<Quota>(key);

  if (!q) q = { uses: 0, resetAt: monthResetAt(now) };
  if (new Date(q.resetAt).getTime() <= now.getTime()) {
    q = { uses: 0, resetAt: monthResetAt(now) };
  }

  if (q.uses >= FREE_USES_LIMIT) {
    return { allowed: false, quota: q };
  }

  q.uses += 1;
  await store.set(key, q, { ex: TTL_1Y });
  return { allowed: true, quota: q };
}

export { FREE_USES_LIMIT };

/**
 * Lead capture sink.
 *
 * Leads used to go only to stdout, which meant every lead was written to a log
 * nobody reads and then lost forever. That is the single most expensive bug in
 * this repo: the funnel can be working perfectly and still produce zero
 * contacts, with no signal that anything is wrong.
 *
 * So a lead is now three things: an indexed KV record (queryable, survives
 * restarts), a list key so the whole set can be enumerated for export, and the
 * existing stdout line kept for continuity with 13 rounds of log greps.
 *
 * KV is optional. Without it the route still returns ok and still logs, because
 * losing the record is strictly better than 500-ing a visitor who just gave us
 * their email — a failed lead write must never read as a failed submission.
 */
export type StoredLead = {
  id: string;
  email: string;
  receivedAt: string;
  monthlyTickets?: number;
  ahtMinutes?: number;
  loadedCostPerHour?: number;
  channel?: string;
  agentsRange?: string;
  monthlyNetEffect?: number;
  paybackMonths?: number | null;
  verdict?: string;
  yearOneRoi?: number;
  source?: string;
  /** Corpus page context: which programmatic page the lead converted on. */
  industry?: string;
  band?: string;
  volume?: number;
  scenario?: string;
};

const LEAD_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
const LEAD_INDEX_KEY = "leads:index";
const MAX_LEADS_INDEXED = 2000;

/**
 * Where a lead actually landed.
 *
 * This started life as a boolean "stored", which turned out to be worse than
 * useless: it reported kv:true for a write that had gone to Blob, because the
 * caller could only see that a record came back. A durability report that
 * misnames the store is worse than none, since it sends you to debug the wrong
 * system.
 */
export type LeadSink = "kv" | "blob" | null;

export async function saveLead(
  lead: Omit<StoredLead, "id" | "receivedAt">
): Promise<{ record: StoredLead | null; sink: LeadSink }> {
  if (!isLeadStorageConfigured()) return { record: null, sink: null };
  const id = crypto
    .createHash("sha256")
    .update(`${lead.email}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
  const record: StoredLead = { ...lead, id, receivedAt: new Date().toISOString() };

  if (isKvConfigured()) {
    try {
      const store = kv;
      await store.set(`lead:${id}`, record, { ex: LEAD_TTL_SECONDS });
      // Append to an enumerable index. An expired element simply disappears from
      // reads, so the index self-prunes without a sweeper.
      const index = (await store.get<string[]>(LEAD_INDEX_KEY)) ?? [];
      index.unshift(id);
      await store.set(LEAD_INDEX_KEY, index.slice(0, MAX_LEADS_INDEXED), {
        ex: LEAD_TTL_SECONDS,
      });
      return { record, sink: "kv" };
    } catch {
      // Fall through to Blob rather than dropping the lead on the floor.
    }
  }

  if (isBlobConfigured()) {
    try {
      await blobPut(`${LEAD_PREFIX}${id}.json`, JSON.stringify(record), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return { record, sink: "blob" };
    } catch {
      return { record: null, sink: null };
    }
  }

  return { record: null, sink: null };
}

/** Newest first, for export/inspection. Skips ids that have expired. */
export async function listLeads(limit = 100): Promise<StoredLead[]> {
  const cap = Math.min(Math.max(1, limit), MAX_LEADS_INDEXED);

  if (isKvConfigured()) {
    try {
      const index = (await kv.get<string[]>(LEAD_INDEX_KEY)) ?? [];
      const found = await Promise.all(
        index
          .slice(0, cap)
          .map((id) => kv.get<StoredLead>(`lead:${id}`).catch(() => null))
      );
      return found.filter((v): v is StoredLead => v !== null && v !== undefined);
    } catch {
      // fall through to Blob
    }
  }

  if (isBlobConfigured()) {
    try {
      const { blobs } = await blobList({ prefix: LEAD_PREFIX });
      const newest = blobs
        .filter((b) => b.pathname.endsWith(".json"))
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .slice(0, cap);

      const records = await Promise.all(
        newest.map(async (b) => {
          try {
            const raw = await readBlob(b.pathname);
            if (!raw) return null;
            const rec = JSON.parse(raw) as StoredLead;
            return leadIsFresh(rec.receivedAt, LEAD_TTL_SECONDS) ? rec : null;
          } catch {
            return null;
          }
        })
      );
      return records.filter((v): v is StoredLead => v !== null);
    } catch {
      return [];
    }
  }

  return [];
}
