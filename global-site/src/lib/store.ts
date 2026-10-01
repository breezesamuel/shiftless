import { kv } from "@vercel/kv";
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

function monthResetAt(now = new Date()): string {
  const d = new Date(now.getTime() + MS_PER_MONTH);
  return d.toISOString();
}

export async function getOrCreateUser(email: string): Promise<User> {
  const e = email.toLowerCase();
  const id = crypto
    .createHash("sha256")
    .update("user:" + e)
    .digest("hex")
    .slice(0, 16);
  const key = `user:${id}`;
  const existing = await kv.get<User>(key);
  if (existing) return existing;
  const user: User = { id, email: e, createdAt: new Date().toISOString() };
  await kv.set(key, user, { ex: 60 * 60 * 24 * 365 });
  await kv.set(`email:${e}`, id, { ex: 60 * 60 * 24 * 365 });
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const e = email.toLowerCase();
  const id = await kv.get<string>(`email:${e}`);
  if (!id) return null;
  const u = await kv.get<User>(`user:${id}`);
  return u || null;
}

export async function getQuota(userId: string): Promise<Quota> {
  const q = await kv.get<Quota>(`quota:${userId}`);
  if (q) return q;
  const resetAt = monthResetAt();
  const fresh: Quota = { uses: 0, resetAt };
  await kv.set(`quota:${userId}`, fresh, { ex: 60 * 60 * 24 * 365 });
  return fresh;
}

export async function bumpQuotaIfFree(
  userId: string,
  now = new Date()
): Promise<{ allowed: boolean; quota: Quota }> {
  let q = await getQuota(userId);
  if (new Date(q.resetAt).getTime() <= now.getTime()) {
    q = { uses: 0, resetAt: monthResetAt(now) };
  }
  if (q.uses >= FREE_USES_LIMIT) {
    return { allowed: false, quota: q };
  }
  q.uses += 1;
  await kv.set(`quota:${userId}`, q, { ex: 60 * 60 * 24 * 365 });
  return { allowed: true, quota: q };
}

export const __store = { FREE_USES_LIMIT };
