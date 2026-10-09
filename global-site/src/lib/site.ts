/**
 * Canonical site URL — the single source of truth for every absolute link,
 * sitemap entry, structured-data node and outbound redirect in the app.
 *
 * This used to be hardcoded to the Vercel deployment URL in a dozen files; if
 * they ever drift apart, Google sees duplicate content (two hosts serving the
 * same pages, neither canonical). Everything now reads these two constants so
 * the canonical host changes in exactly one place.
 */

export const SITE_URL = "https://app.highkingflower.com";
/** Host only, no scheme — used in IndexNow payloads and host checks. */
export const SITE_HOST = "app.highkingflower.com";