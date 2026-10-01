"use client";

import { useEffect, useState } from "react";

/**
 * 免费额度与登录状态。
 *
 * 只显示服务器返回的真实数字。没有登录时显示「10 次免费」，登录后显示
 * 「已用 N / 剩余 M」。绝不会在客户端自行编造剩余次数。
 *
 * 诚实边界：未登录时不扣次数（因为无法可靠地按人计数）。想看到自己的
 * 剩余额度，请用邮箱登录。
 */

type Quota = {
  signedIn: boolean;
  storage?: "ready" | "unconfigured";
  loginReady?: boolean;
  email?: string;
  freeUsesTotal: number;
  used: number | null;
  remaining: number | null;
  resetAt: string | null;
};

export function FreeQuotaCard() {
  const [q, setQ] = useState<Quota | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then(setQ)
      .catch(() => setQ(null));
  }, []);

  const requestLink = async () => {
    setState("busy");
    setErr("");
    try {
      const r = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error || "发送失败，请重试。");
        setState("err");
        return;
      }
      setMsg(j.message || "登录链接已发送。");
      setState("sent");
    } catch {
      setErr("网络错误，请重试。");
      setState("err");
    }
  };

  const total = q?.freeUsesTotal ?? 10;
  const storageBroken = q?.storage === "unconfigured";
  const signedInWithNumbers = q?.signedIn && q.remaining !== null && q.used !== null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-emerald-900">
          {signedInWithNumbers
            ? `剩余免费额度：${q.remaining} / ${total}`
            : `免费 ${total} 次`}
        </h3>
        {q?.signedIn && (
          <span className="text-xs text-emerald-700">已登录 {q.email}</span>
        )}
      </div>

      {storageBroken ? (
        <p className="mt-2 rounded-lg bg-white px-4 py-3 text-sm text-amber-800">
          额度存储服务正在配置，暂时无法显示你的剩余次数。如果你已登录但看不到数字，
          这是我们这边的问题，不是你的操作有误。
        </p>
      ) : signedInWithNumbers ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-emerald-800">
            你已使用 {q.used} 次
            {q.resetAt
              ? `，额度于 ${new Date(q.resetAt).toLocaleDateString("zh-CN")} 重置。`
              : "。"}
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100"
            role="progressbar"
            aria-valuenow={q.used ?? 0}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{
                width: `${Math.min(100, ((q.used ?? 0) / Math.max(1, total)) * 100)}%`,
              }}
            />
          </div>
          {q.remaining === 0 && (
            <p className="mt-2 text-sm font-medium text-emerald-900">
              免费额度已用完。订阅可继续使用：
              <a href="/geo/subscribe" className="ml-1 underline">
                查看订阅方案
              </a>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-emerald-800">
            新用户自动获得 10 次免费审计，覆盖官网根页与 11 项可读性检查。
            免费额度仅含单页审计，不含季度对比与整改建议。
          </p>
          {q?.loginReady ? (
            <>
              <p className="mt-1 text-xs text-emerald-700">
                用邮箱登录即可看到并跟踪你自己的剩余次数。
              </p>
              {state !== "sent" && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    aria-label="邮箱"
                    className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 sm:w-64"
                  />
                  <button
                    type="button"
                    onClick={requestLink}
                    disabled={state === "busy" || !email}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {state === "busy" ? "发送中…" : "获取登录链接"}
                  </button>
                </div>
              )}
              {state === "sent" && (
                <p className="mt-3 rounded-lg bg-white px-4 py-3 text-sm text-emerald-800">
                  {msg}
                </p>
              )}
              {state === "err" && (
                <p className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {err}
                </p>
              )}
            </>
          ) : (
            // Offer nothing rather than a button that can only fail. Claiming
            // login exists while it cannot work is worse than admitting the
            // feature is not live yet.
            <p className="mt-1 text-xs text-emerald-700">
              邮箱登录正在上线。想先聊聊，可以在
              <a href="/geo" className="underline">
                联系我们
              </a>
              。
            </p>
          )}
        </>
      )}
    </div>
  );
}
