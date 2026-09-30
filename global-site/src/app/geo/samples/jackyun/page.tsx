import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "吉客云 AI 可见度审计 · 样板",
  robots: { index: false, follow: false },
};

const raw = `# AI 可见度审计 · 样板报告
被测站点: https://www.jackyun.com/
审计时间: 2026-09-30

## 总分 35/100 — 几乎不透明
13 个主流 AI 爬虫全部放行（大门敞开），但没有任何一份能被 AI 结构化读取的资料（货架是空的）。

## 分层明细
- AI 爬虫放行 15/15 ✅
- JSON-LD 0/15 ❌ 无任何结构化数据
- 身份/FAQ 架构 0/10 ❌ 无 Organization、无 FAQPage
- 产品/文章架构 0/5 ❌
- llms.txt 5/5 ✅ 存在且按文本提供
- 标题结构 3/10 ⚠️ 2 个 H1
- 问题式标题 0/10 ❌ 无任何"怎么……？"式标题
- 署名与日期 0/8 ❌
- 内容深度 3/5 ⚠️ 约 499 字
- 引用外链 7/7 ✅ 引用 10 个外部域名
- 社交元数据 OG 0/5 ❌

## 最值得先做三件事
1. 把 6–10 个客户高频问题写成"问题式标题 + FAQPage schema"（极低成本）
2. 首页与核心产品页各补一段 JSON-LD（Organization + Product）
3. 统一单一 H1、补作者署名与更新时间

## 本审计不承诺什么
测量的是可读性，不是排名。排名取决于模型、提示词与竞争对手，无人能保证；
保证排名的服务商卖的是它控制不了的结果。`;

export default function JackyunSample() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 可见度审计 · 样板
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/geo" className="hover:text-slate-900">← 返回</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">吉客云官网 AI 可读性实测</h1>
            <span className="whitespace-nowrap text-3xl font-bold text-slate-900">35/100</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            首页单页实测 · 全站 6 页扫描聚合 41/100（见正式版）· 机器扫描，可复现
          </p>
          <pre className="mt-6 overflow-x-auto rounded-xl bg-slate-900 p-5 text-xs leading-relaxed text-slate-100">
{raw}
          </pre>
          <p className="mt-6 text-sm text-slate-500">
            这是付款前免费送你的样板。若需全站版（6–8 页逐项 + 竞品对照 + 整改提议），
            回 <Link href="/geo#order" className="underline">购买页</Link> 下单，¥1999 起。
          </p>
        </div>
      </main>
    </div>
  );
}