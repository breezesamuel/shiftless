import os

from flask import Flask, request, jsonify

from x402 import x402ResourceServer, ResourceConfig
from x402.http import HTTPFacilitatorClient
from x402.mechanisms.evm.exact import ExactEvmServerScheme

app = Flask(__name__)

PAY_TO = os.getenv("PAY_TO", "0x0000000000000000000000000000000000000000")
NETWORK = os.getenv("X402_NETWORK", "eip155:84532")  # Base-Sepolia USDC by default
PRICE = os.getenv("PRICE", "0.10 USD")
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

facilitator = HTTPFacilitatorClient({"url": FACILITATOR_URL})
server = x402ResourceServer(facilitator)
server.register(NETWORK, ExactEvmServerScheme())
server.initialize()

config = ResourceConfig(
    scheme="exact",
    network=NETWORK,
    pay_to=PAY_TO,
    price=PRICE,
)


def serialize_req(req) -> dict:
    return {
        "scheme": req.scheme,
        "network": req.network,
        "asset": req.asset,
        "amount": req.amount,
        "pay_to": req.pay_to,
        "max_timeout_seconds": req.max_timeout_seconds,
        "extra": req.extra,
    }


@app.route("/", methods=["GET"])
def home():
    return (
        "x402 Paywall API\n"
        "GET /pay/:tool  -> protected resource (requires x402 payment)\n"
        "Pay with USDC on Base-Sepolia via x402 facilitator.\n"
    ), 200


@app.route("/pay/<tool>", methods=["GET"])
def pay(tool):
    quota = request.headers.get("x402-payment", "")
    if not quota:
        reqs = server.build_payment_requirements(config)
        return jsonify(
            {
                "error": "Payment required",
                "requirements": [serialize_req(r) for r in reqs],
            }
        ), 402, {
            "x402-payment-required": "true",
            "x402-scheme": reqs[0].scheme,
            "x402-network": reqs[0].network,
            "x402-price": PRICE,
        }
    # Verify the provided payment
    try:
        from x402.schemas import PaymentPayload
        payload = PaymentPayload.model_validate_json(quota)
        reqs = server.build_payment_requirements(config)
        from x402.util import validate_payment_result
        resp = server.verify_payment(payload, reqs[0])
        ok = bool(getattr(resp, "valid", resp))
    except Exception as exc:
        return jsonify({"error": f"verify failed: {exc!r}"}), 400
    if not ok:
        return jsonify({"error": "Payment not valid"}), 402
    return jsonify(
        {
            "tool": tool,
            "model": "decision-assist-v1",
            "answer": f"{tool} analysis complete (demo). Paid via x402: {config.price} on {NETWORK}.",
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765)