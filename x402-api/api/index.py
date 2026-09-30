import os

from flask import Flask, request, jsonify, Response

from x402 import x402ResourceServerSync, ResourceConfig
from x402.schemas import ResourceInfo, PaymentRequired
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.extensions.bazaar import declare_discovery_extension, OutputConfig

app = Flask(__name__)

PAY_TO = os.getenv("PAY_TO", "0x0000000000000000000000000000000000000000")
NETWORK = os.getenv("X402_NETWORK", "eip155:84532")  # Base-Sepolia USDC by default
PRICE = os.getenv("PRICE", "0.10 USD")
MIME = os.getenv("MIME", "application/json")
SERVICE = os.getenv("SERVICE", "x402 Paywall API")
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServerSync(facilitator)
server.register(NETWORK, ExactEvmServerScheme())
try:
    server.initialize()
except Exception as exc:  # keep serving even if init hiccups
    print("initialize warning:", exc)

config = ResourceConfig(
    scheme="exact",
    network=NETWORK,
    pay_to=PAY_TO,
    price=PRICE,
)

# Machine-readable discovery metadata for the x402 Bazaar
DISCOVERY = declare_discovery_extension(
    input={"tool": "today"},
    input_schema={
        "type": "object",
        "required": ["tool"],
        "properties": {
            "tool": {"type": "string", "description": "Tool name to analyze"},
        },
    },
    output=OutputConfig(
        example={
            "tool": "today",
            "model": "decision-assist-v1",
            "answer": "Daily market decision-assist digest (payment verified).",
            "paid_network": NETWORK,
            "paid_price": PRICE,
        }
    ),
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


def payment_required(url: str) -> PaymentRequired:
    reqs = server.build_payment_requirements(config)
    return PaymentRequired(
        x402_version=2,
        resource=ResourceInfo(url=url, description=SERVICE, mime_type=MIME),
        accepts=reqs,
        extensions={"bazaar": DISCOVERY["bazaar"]},
    )


@app.route("/", methods=["GET"])
def home():
    return (
        "x402 Paywall API (Bazaar-enabled)\n"
        "GET /pay/:tool  -> protected resource (requires x402 payment)\n"
        "PaymentRequired includes a Bazaar discovery extension on the 402.\n"
    ), 200


@app.route("/pay/<tool>", methods=["GET"])
def pay(tool):
    quota = request.headers.get("x402-payment", "")
    url = request.url
    if not quota:
        pr = payment_required(url)
        body = pr.model_dump(exclude_none=True)
        req0 = body["accepts"][0]
        return jsonify(body), 402, {
            "x402-payment-required": "true",
            "x402-scheme": req0["scheme"],
            "x402-network": req0["network"],
            "x402-price": PRICE,
            "Cache-Control": "no-store",
        }
    try:
        from x402.schemas import PaymentPayload

        payload = PaymentPayload.model_validate_json(quota)
        reqs = server.build_payment_requirements(config)
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
            "answer": f"{tool} analysis complete (demo). Paid via x402: {PRICE} on {NETWORK}.",
            "settled_by": FACILITATOR_URL,
        }
    ), 200


@app.route("/llms.txt", methods=["GET"])
def llms_txt():
    text = (
        "# x402 Paywall API\n"
        "Pay-per-call API for AI agents. On HTTP 402, read the JSON body, pay the "
        "advertised requirement in USDC on {} via the x402 facilitator, then retry "
        "with the x402-payment header.\n\n"
        "- Protocol: x402 (v2), Bazaar-enabled\n"
        "- Network: {} · Price: {}\n"
        "- Endpoints: GET /pay/:tool\n"
        "- Example: GET https://{}/pay/today\n"
    ).format(NETWORK, NETWORK, PRICE, request.host)
    return Response(text, mimetype="text/plain")


@app.route("/agents.md", methods=["GET"])
def agents_md():
    text = (
        "Every endpoint under /pay is x402-paid. On HTTP 402, read the PaymentRequired "
        "JSON body, pay the advertised USDC requirement on {}, then retry the same request "
        "with the x402-payment header. Bazaar discovery metadata is included in the 402 "
        "extensions.\n".format(NETWORK)
    )
    return Response(text, mimetype="text/markdown")


@app.route("/.well-known/x402", methods=["GET"])
def wellknown_x402():
    return jsonify(
        {
            "x402Version": 2,
            "name": SERVICE,
            "description": "Pay-per-call decision-assist API for AI agents.",
            "resources": [
                {
                    "url": request.host_url.rstrip("/") + "/pay/today",
                    "method": "GET",
                    "description": f"{SERVICE} — {PRICE} per call on {NETWORK}",
                    "network": NETWORK,
                    "price": PRICE,
                }
            ],
        }
    )


@app.route("/.well-known/agent.json", methods=["GET"])
def wellknown_agent():
    return jsonify(
        {
            "name": SERVICE,
            "description": "Pay-per-call decision-assist API settled via x402.",
            "url": request.host_url.rstrip("/"),
            "documentation": request.host_url.rstrip("/") + "/llms.txt",
            "payments": {"protocol": "x402", "network": NETWORK},
        }
    )


@app.route("/.well-known/agent-card.json", methods=["GET"])
def wellknown_agent_card():
    return jsonify(
        {
            "name": SERVICE,
            "description": "Pay-per-call decision-assist API settled via x402 (Bazaar).",
            "url": request.host_url.rstrip("/"),
            "provider": {"org": SERVICE},
            "skills": [
                {
                    "id": "paywall",
                    "name": "Paid decision-assist",
                    "description": f"{SERVICE} — {PRICE} per call.",
                    "endpoint": "/pay/today",
                }
            ],
        }
    )


@app.route("/.well-known/mcp.json", methods=["GET"])
def wellknown_mcp():
    return jsonify(
        {
            "name": SERVICE,
            "description": "x402 pay-per-call decision-assist API.",
            "mcpServers": {
                "x402-paywall": {
                    "url": request.host_url.rstrip("/") + "/pay",
                    "payments": {"protocol": "x402", "network": NETWORK},
                }
            },
        }
    )


@app.route("/.well-known/ai-plugin.json", methods=["GET"])
def wellknown_aiex():
    return jsonify(
        {
            "schema_version": "v1",
            "name_for_model": "x402_paywall",
            "name_for_human": "x402 Paywall API",
            "description_for_model": f"{SERVICE}: pay-per-call decision-assist. HTTP 402 => read requirements, pay, retry with x402-payment header.",
            "description_for_human": "Pay-per-call decision-assist API.",
            "api": {"type": "openapi", "url": request.host_url.rstrip("/") + "/pay/today"},
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False)