// 通过 CDP 接管已登录的真实 Edge 会话。
// 用途：在你自己的登录态里操作，不接触任何账号密码。
// 前置：Edge 需以 --remote-debugging-port=9222 --user-data-dir=<非默认目录> 启动
//       （Edge 136+ 禁止在默认用户目录上开调试端口，这是绕开该限制的办法）
const { chromium } = require("playwright-core");
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const cmd = process.argv[2] || "tabs";

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("no browser context");
  const pages = ctx.pages();
  const page = pages[0] || (await ctx.newPage());

  if (cmd === "tabs") {
    const out = [];
    for (const p of pages) out.push({ url: p.url(), title: await p.title().catch(() => "(unreadable)") });
    console.log(JSON.stringify(out, null, 2));
  }

  if (cmd === "shot") {
    const url = process.argv[3];
    const out = process.argv[4] || "shot.png";
    if (url) { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); await page.waitForTimeout(2500); }
    await page.screenshot({ path: out, fullPage: false });
    console.log("saved " + out + " | " + page.url());
  }

  if (cmd === "text") {
    const url = process.argv[3];
    const sel = process.argv[4] || "body";
    if (url) { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); await page.waitForTimeout(2000); }
    console.log((await page.locator(sel).first().innerText()).slice(0, Number(process.argv[5] || 3000)));
  }

  // GitHub 登录态判定：只读 DOM，不碰任何凭据
  if (cmd === "login") {
    await page.goto("https://github.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      return {
        loginLinkPresent: !!q('a[href="/login"]'),
        joinLinkPresent: !!q('a[href="/join"]'),
        avatarImg: !!q("summary img.avatar"),
        avatarAlt: (q("summary img.avatar") || {}).alt || null,
        headerText: (document.querySelector("header") || {}).innerText?.replace(/\s+/g, " ").slice(0, 200) || null,
      };
    });
    console.log(JSON.stringify(r, null, 2));
    r.loggedIn = !r.loginLinkPresent && !!r.avatarImg;
    console.log("loggedIn = " + r.loggedIn);
  }

  // 打开某个仓库的 Actions 页面并列出工作流
  if (cmd === "actions") {
    const repo = process.argv[3]; // owner/name
    await page.goto(`https://github.com/${repo}/actions`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    console.log("url: " + page.url());
    console.log((await page.locator("body").first().innerText()).slice(0, 2500));
  }

  if (cmd === "eval") {
    const r = await page.evaluate(process.argv[3]);
    console.log(typeof r === "string" ? r : JSON.stringify(r, null, 2));
  }

  if (cmd === "keep") { console.log("holding connection; ctrl-c to exit"); await new Promise(() => {}); }

  await browser.close();
}

main().catch((e) => { console.error("ERR " + e.message); process.exit(1); });
