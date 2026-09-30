#!/usr/bin/env node
/**
 * CLI wrapper around the shared audit engine.
 *
 * The scoring logic now lives in ../global-site/src/lib/geo-audit.js so the
 * Vercel Cron function can import the exact same engine — one copy, no drift
 * between what the customer gets and what the scheduled recheck measures.
 *
 * Usage:
 *   node audit.js https://example.com
 *   node audit.js https://example.com --json
 */
const { auditPage, renderMarkdown } = require("../global-site/src/lib/geo-audit.js");

const args = process.argv.slice(2);
const target = args.find((a) => /^https?:\/\//.test(a));
const asJson = args.includes("--json");
if (!target) {
  console.error("usage: node audit.js <url> [--json]");
  process.exit(2);
}

(async () => {
  let result;
  try {
    result = await auditPage(target);
  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    process.exit(1);
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(renderMarkdown(result));
})();
