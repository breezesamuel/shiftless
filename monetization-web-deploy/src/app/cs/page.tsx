import type { Metadata } from "next";
import { CSCalculator } from "@/components/CSCalculator";

export const metadata: Metadata = {
  title: "客服团队 ROI 测算器 · AI 客服降本增效",
  description: "按工单量测算跨境电商/SaaS/物流客服团队用 AI 替代人力的投资回报、年省金额与回收期。",
  keywords: ["AI客服", "客服降本", "ROI测算", "跨境电商客服", "工单自动化"],
  openGraph: {
    title: "客服团队 ROI 测算器 · AI 客服降本增效",
    description: "按工单量测算 AI 客服替代人力的 ROI、年省金额与回收期",
    type: "website",
  },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <main className="flex-1">
        <CSCalculator />
      </main>
    </div>
  );
}
