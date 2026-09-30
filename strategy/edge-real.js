// 尝试让 Playwright 直接以 Edge 真实 profile 启动浏览器（不用 TCP 调试端口）。
// 目的：验证 Edge 152 的"默认 profile 禁远程调试"限制是否同样作用于管道模式。
const { chromium } = require("playwright-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const REAL = process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\User Data";

(async () => {
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(REAL, {
      executablePath: EDGE,
      headless: false,
      args: ["--no-first-run", "--no-default-browser-check"],
      timeout: 60000,
    });
  } catch (e) {
    console.log("LAUNCH FAILED: " + e.message.split("\n")[0]);
    process.exit(2);
  }
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto("https://github.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      loginLink: !!q('a[href="/login"]'),
      avatar: !!q("summary img.avatar"),
      header: (document.querySelector("header") || {}).innerText?.replace(/\s+/g, " ").slice(0, 160) || null,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  console.log("loggedIn = " + (!r.loginLink && r.avatar));
  await ctx.close();
  process.exit(0);
})();
