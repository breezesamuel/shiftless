/**
 * IndexNow key verification file — served at /{INDEXNOW_KEY}.txt.
 *
 * IndexNow only accepts a submission if the submitting host proves it owns the
 * key by hosting it at a public URL. Until this route existed the key was in
 * env and in .secrets/, hosted nowhere, so every push would have been rejected
 * and the site would have kept waiting for Bing to re-crawl on its own
 * schedule — weeks for a low-authority site.
 *
 * A one-segment dynamic route is used (rather than a literal folder named
 * df83…txt) because route segments with dots are unreliable across Next
 * versions; this handler answers 200 only for the exact configured key and 404
 * for every other single segment, which is what the router would have returned
 * anyway.
 */

const EXPECTED = /^[0-9a-f]{32}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ keyfile: string }> }) {
  const { keyfile } = await params;
  const key = process.env.INDEXNOW_KEY;

  // The hosted file is /{key}.txt — the segment carries the extension, the
  // env var does not. Comparing the raw segment to the key (the obvious first
  // write) 404s every real request while looking correct in review.
  if (!key || !EXPECTED.test(key) || keyfile !== `${key}.txt`) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(key, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
