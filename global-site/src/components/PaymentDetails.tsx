/**
 * Manual transfer details — the path that actually collects money while the
 * online channels (Alipay open-platform, WeChat merchant) are unconfigured.
 *
 * Every order API responds with "请按下方支付方式转账…订单号", but until now no
 * page ever showed the account to transfer to, so the manual path was a dead
 * end: the customer had an order id and nowhere to send the money. This
 * component is that missing block.
 *
 * These details are meant to be public — a customer cannot pay a secret. The
 * secrets (SMTP auth code, MoltsPay/PayPal keys) live in env vars only.
 */

const BANK = {
  bank: "中国工商银行 上海徐汇长桥支行",
  bankEn: "ICBC Shanghai Xuhui Changqiao Sub-branch",
  holder: "廖献云",
  account: "6222031001026162672",
  branchCode: "网点号 2993 · 银行机构代码 102290029937",
  address: "上海市罗香路37号",
  alipay: "supi24@163.com",
  company: "上海丙大山智能科技有限公司",
};

export function PaymentDetails({
  lang = "zh",
  orderId,
}: {
  lang?: "zh" | "en";
  /** Order id to remind the payer to note in the transfer remark. */
  orderId?: string;
}) {
  const en = lang === "en";

  return (
    <div
      data-testid="payment-details"
      className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700"
    >
      <p className="font-semibold text-slate-900">
        {en ? "Bank transfer" : "对公/银行卡转账"}
      </p>
      <dl className="mt-1.5 space-y-0.5">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-500">{en ? "Bank" : "开户行"}</dt>
          <dd>{en ? BANK.bankEn : BANK.bank}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-500">{en ? "Name" : "户名"}</dt>
          <dd>{BANK.holder}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-500">{en ? "Account" : "账号"}</dt>
          <dd className="font-mono">{BANK.account}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-500">{en ? "Branch" : "网点"}</dt>
          <dd>
            {BANK.branchCode}
            {" · "}
            {BANK.address}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-500">Alipay</dt>
          <dd className="font-mono">{BANK.alipay}</dd>
        </div>
      </dl>
      <p className="mt-2 text-slate-600">
        {en
          ? `Transfer to either account, put the order id in the remark${orderId ? ` (${orderId})` : ""}, then send the receipt screenshot to ${BANK.alipay}.`
          : `任选其一转账，备注订单号${orderId ? `（${orderId}）` : ""}，再把转账截图发到 ${BANK.alipay}。`}
      </p>
    </div>
  );
}
