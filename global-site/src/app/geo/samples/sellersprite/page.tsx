import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "卖家精灵 AI 可见度审计 · 样板",
  robots: { index: false, follow: false },
};

const raw = `# AI 可见度审计 · 样板报告
被测站点: https://www.sellersprite.com/cn
审计时间: 2026-09-30

## 总分 52/100 — 几乎不透明
全站差异明显：/cn/ 52、/en/ 67、/jp/ 76。市场分站差距就是整改清单的起点。

## 分层明细（/cn/ 首页）
- AI 爬虫放行 15/15 ✅
- JSON-LD 6/15 ⚠️ 有 WebSite + Organization（全站唯一有身份 schema 的）
- 身份/FAQ 架构 5/10 ⚠️ 有 Organization、无 FAQPage
- 产品/文章架构 0/5 ❌ 会员/API 价目页最该有 Product schema
- llms.txt 0/5 ❌
- 标题结构 6/10 ⚠️ 1 H1、11 H2、10 H3 层级健康
- 问题式标题 0/10 ❌
- 署名与日期 0/8 ❌
- 内容深度 5/5 ✅ 约 1054 字
- 引用外链 7/7 ✅ 引用 23 个外部域名
- 社交元数据 OG 5/5 ✅

## 最值得先做三件事
1. 选品/关键词高频问题写成"问题式标题 + FAQPage schema"（70 万用户社区，素材现成）
2. 会员/API 价目页补 Product(Offer) schema——公开价目是最大的结构化资产
3. 博客/教程补作者署名与更新时间

## 你的差异化优势
你是所测站点里唯一做了 Organization schema 的——认知已到位，缺的是
模型最爱引用的 FAQ 问答对格式。整改动作比从零开始的对手少一半。`;

export default function SellerSpriteSample() {
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">卖家精灵官网 AI 可读性实测</h1>
            <span className="whitespace-nowrap text-3xl font-bold text-slate-900">52/100</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            /cn/ 首页单页实测 · 全站聚合 62/100（/en/ 67、/jp/ 76）· 机器扫描，可复现
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