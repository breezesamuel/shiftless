# x402 Paywall — 2-Minute Demo Video Script

## Goal
Prove: "Any tool becomes a pay-per-call API via x402." Then show agent paying.

## Scene 1 (0:00–0:20) — The problem
- Narration: "Agents need paid APIs without API keys or KYC friction."
- Screen: show `curl -i <PAYWALL>/pay/today` returning `HTTP/1.1 402`.

## Scene 2 (0:20–0:50) — What x402 does
- Screen: show the 402 body:
  ```json
  {"requirements":[{"scheme":"exact","network":"eip155:84532",
    "asset":"0x036C...","amount":"100000","pay_to":"0x12A2...","max_timeout_seconds":300}]}
  ```
- Narration: "server asks for exact USDC; protocol is self-describing."

## Scene 3 (0:50–1:40) — Agent pays & gets result
- Using the `pay` skill (solana-foundation/pay) or x402 MCP client:
  - Agent receives 402 → user approves TouchID-style confirmation → funds move → client retries with payment header → server verifies → returns tool answer.
- Screen: tool output "today analysis complete (demo)".

## Scene 4 (1:40–2:00) — Call-to-action
- "Wrap any CLI/tool/skill in <50 lines. Mainnet-ready." 
- Tag @coinbaseDev, #x402, #agentic-commerce.

## Files to record
- Terminal: `pydemo.py` (full client on testnet wallet: request → 402 → pay → retry → 200).
- Browser: landing page + API response.
- Keep 1 take, 720p.

## Post-requisite
- Publish to X + GitHub; mention micro-grant ask (up to $3k).