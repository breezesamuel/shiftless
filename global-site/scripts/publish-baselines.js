#!/usr/bin/env node
/**
 * Publish quarterly baselines as static files served by the site.
 *
 * WHY THIS EXISTS
 * A Vercel function has no filesystem, so it cannot remember last quarter. It
 * can, however, fetch a file from its own domain. So the baseline is published
 * as a static asset at /baselines/<host>.json, and the cron function reads it
 * back to compute the quarter-over-quarter delta.
 *
 * This turns "no baseline store" from a limitation into a working comparison.
 * The honest caveat: the baseline only advances when someone redeploys, which
 * happens after a local run of geo/quarterly.js. The delta is therefore real and
 * correct; its refresh cadence is tied to deploys, not to the cron itself.
 *
 * Usage: node scripts/publish-baselines.js [--dry]
 */
const fs = require("fs");
const path = require("path");

const SNAP_ROOT = path.resolve(__dirname, "..", "..", "geo", "subscriptions");
const OUT_ROOT = path.resolve(__dirname, "..", "public", "baselines");
const dry = process.argv.includes("--dry");

/** 2026-Q3-r2 sorts after 2026-Q3; plain quarter strings sort naturally. */
function quarterRank(q) {
  const m = /^(\d{4})-Q([1-4])(?:-r(\d+))?$/.exec(String(q || ""));
  if (!m) return -1;
  return Number(m[1]) * 1000 + Number(m[2]) * 10 + Number(m[3] || 0);
}

function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(SNAP_ROOT)) {
    console.log("no snapshots at " + SNAP_ROOT + " — nothing to publish");
    return;
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const published = [];
  const skipped = [];

  for (const dir of fs.readdirSync(SNAP_ROOT)) {
    const subDir = path.join(SNAP_ROOT, dir);
    if (!fs.statSync(subDir).isDirectory()) continue;
    const snapDir = path.join(subDir, "snapshots");
    if (!fs.existsSync(snapDir)) continue;

    const files = fs.readdirSync(snapDir).filter((f) => f.endsWith(".json"));
    if (!files.length) {
      skipped.push(dir + ": no snapshots");
      continue;
    }

    // Latest quarter wins; within a quarter the highest revision wins.
    let best = null;
    for (const f of files) {
      const rank = quarterRank(f.replace(/\.json$/, ""));
      if (rank < 0) continue;
      if (!best || rank > best.rank) best = { rank, file: f };
    }
    if (!best) {
      skipped.push(dir + ": no quarter-named snapshots");
      continue;
    }

    let snap;
    try {
      snap = JSON.parse(fs.readFileSync(path.join(snapDir, best.file), "utf8"));
    } catch (e) {
      skipped.push(dir + ": " + best.file + " unparseable (" + e.message + ")");
      continue;
    }
    if (!snap || !Array.isArray(snap.pages) || !snap.pages.length) {
      skipped.push(dir + ": " + best.file + " has no pages");
      continue;
    }

    const host = hostOf(snap.url || "");
    if (!host) {
      skipped.push(dir + ": cannot derive host from url " + snap.url);
      continue;
    }

    const payload = {
      host,
      url: snap.url,
      quarter: snap.quarter,
      createdAt: snap.createdAt,
      overall: snap.overall,
      pages: snap.pages.map((p) => ({
        url: p.url,
        ok: p.ok !== false,
        score: p.score,
        checks: (p.checks || []).map((c) => ({
          id: c.id,
          label: c.label,
          weight: c.weight,
          score: c.score,
        })),
      })),
    };

    const outFile = path.join(OUT_ROOT, host + ".json");
    if (dry) {
      console.log("would write " + outFile);
    } else {
      fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
      console.log("wrote " + host + ".json  quarter=" + payload.quarter + " overall=" + payload.overall + " pages=" + payload.pages.length);
    }
    published.push(host + " (" + payload.quarter + ")");
  }

  console.log("\npublished " + published.length + ", skipped " + skipped.length);
  for (const s of skipped) console.log("  skipped: " + s);
  if (published.length === 0) {
    console.log("\nnothing published — a missing baseline is a real state, not a failure to hide.");
  }
}

main();
