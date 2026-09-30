"use client";

/**
 * Fire-and-forget analytics. Never throws, never blocks, never queues work the
 * user is waiting on. If the endpoint is down the product still works.
 */
export function track(name: string, props?: Record<string, number | boolean>, path?: string) {
  try {
    const body = JSON.stringify({ name, props, path: path ?? window.location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* analytics must never break the product */
  }
}
