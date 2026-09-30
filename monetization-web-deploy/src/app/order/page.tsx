import type { Metadata } from "next";
import { OrderClient } from "./OrderClient";

export const metadata: Metadata = {
  title: "提交采购订单 · AI 数字员工",
  description: "选择 AI 数字员工岗位与席位数，提交采购订单，顾问将在 1 个工作日内联系确认并发送正式合同与付款指引。",
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <OrderClient />
    </div>
  );
}
