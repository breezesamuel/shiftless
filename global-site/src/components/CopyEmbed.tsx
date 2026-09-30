"use client";

import { useState } from "react";

/**
 * One-click copy for the embed snippet.
 *
 * A code block that has to be hand-selected and copied gets used maybe a tenth
 * as often as a button. The embed outreach motion is the main link-building
 * channel this site has, so the two seconds of friction here are worth removing.
 */
export function CopyEmbed({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  const snippet = `<iframe
  src="https://shiftless.vercel.app/embed"
  width="100%" height="620" frameborder="0"
  title="Support headcount and automation ROI calculator"
  loading="lazy"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setState("ok");
    } catch {
      setState("err");
    }
    setTimeout(() => setState("idle"), 2200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={
        "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 " +
        className
      }
    >
      {state === "ok" ? "Copied — paste it in" : "Copy embed code"}
    </button>
  );
}
