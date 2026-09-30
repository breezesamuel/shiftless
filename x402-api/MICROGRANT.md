# x402 Micro-Grant Application — Paywall API

## Project: x402 Paywall API (Decision-Assist)

**One-liner:** A pay-per-call decision-assist API monetized via x402 (HTTP 402).

## Status
- **Live:** https://x402-paywall-bgl2ek1ck-solmount.vercel.app
- **Demo endpoint:** `GET /pay/today` → 402 with x402 payment requirements (USDC on Base-Sepolia)
- **Payment flow proven:** server correctly issues `402 Payment Required` with scheme/network/asset/amount/pay_to per x402 spec.

## What it does
- Wraps a small "decision-assist" tool (oracle) behind a x402 paywall.
- On unpaid request: returns **HTTP 402** + machine-readable payment requirements (`x402-payment-required`, `scheme=exact`, network `eip155:84532`, USDC, `pay_to`).
- Client pays via x402 facilitator → retries with payment header → server verifies → returns tool output.

## Built with x402
- `x402ResourceServer` + `ExactEvmServerScheme` (Base-Sepolia USDC).
- Python SDK (`x402[flask]`), Vercel serverless deployment.
- Payment verification path implemented (`PaymentPayload.model_validate_json` → `verify_payment`).

## Live proof
```bash
curl -i https://x402-paywall-bgl2ek1ck-solmount.vercel.app/pay/today
# -> HTTP/1.1 402 Payment Required
# -> x402-payment-required: true
# -> body: {"requirements":[{"scheme":"exact","network":"eip155:84532",...}]}
```

## Roadmap
1. Switch to **Base mainnet** (eip155:8453) with real USDC + a funded `pay_to` wallet.
2. Add more payable tools (forecast, prices, translation) behind same paywall.
3. Open an MCP wrapper so agents can discover + pay programmatically.

## Ask
- Impact micro-grant (up to $3k) to fund mainnet deployment + marketing, per
  `PROJECT-IDEAS.md`: "micro-grants up to $3k available for projects that
  unlock new demand or supply and are live on mainnet."
- Contact: X @murrlincoln / Coinbase devs via @coinbaseDev.

---

### Why this unlocks new supply/demand
- Turn any CLI/tool/agent skill into a **metered, paid HTTP endpoint** in <50 lines.
- Agents pay $0.10/call in stablecoin without KYC friction — fits x402's
  "pay-as-you-go agent economy" thesis.