"""
Multi-agent AI market simulation engine using Ollama (llama3.2:3b).
"""

import random
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

PERSONAS = [
    {"id": "value_hunter",    "name": "Warren Blake",  "role": "Value Investor",      "emoji": "🏦", "bias": "bear"},
    {"id": "growth_bull",     "name": "Priya Sharma",  "role": "Growth Analyst",      "emoji": "📈", "bias": "bull"},
    {"id": "quant_trader",    "name": "Alex Chen",     "role": "Quantitative Trader", "emoji": "🤖", "bias": "neutral"},
    {"id": "macro_bear",      "name": "David Volkov",  "role": "Macro Strategist",    "emoji": "🌐", "bias": "bear"},
    {"id": "sector_spec",     "name": "Linda Torres",  "role": "Sector Specialist",   "emoji": "🔬", "bias": "neutral"},
    {"id": "momentum",        "name": "Jake Rivers",   "role": "Momentum Trader",     "emoji": "⚡", "bias": "bull"},
    {"id": "short_seller",    "name": "Marcus Reed",   "role": "Short Seller",        "emoji": "🐻", "bias": "bear"},
    {"id": "options_trader",  "name": "Sofia Nolan",   "role": "Options Trader",      "emoji": "🎯", "bias": "neutral"},
    {"id": "hedge_fund",      "name": "Richard Kwan",  "role": "Hedge Fund PM",       "emoji": "💼", "bias": "neutral"},
    {"id": "activist",        "name": "Rachel Stone",  "role": "Activist Investor",   "emoji": "✊", "bias": "bull"},
    {"id": "retail_bull",     "name": "Tyler Brooks",  "role": "Retail Investor",     "emoji": "🚀", "bias": "bull"},
    {"id": "contrarian",      "name": "Mia Lawson",    "role": "Contrarian",          "emoji": "🔄", "bias": "bear"},
    {"id": "esg_analyst",     "name": "Elena Park",    "role": "ESG Analyst",         "emoji": "🌱", "bias": "neutral"},
    {"id": "credit_analyst",  "name": "Omar Hassan",   "role": "Credit Analyst",      "emoji": "📊", "bias": "bear"},
    {"id": "tech_analyst",    "name": "Sara Kim",      "role": "Technical Analyst",   "emoji": "📉", "bias": "neutral"},
]

ROUND_LABELS = {1: "INITIAL REACTIONS", 2: "CROSS-EXAMINATION", 3: "FINAL VERDICTS"}


def _fmt_market_cap(n):
    if not n:
        return "N/A"
    if n >= 1e12:
        return f"${n/1e12:.1f}T"
    if n >= 1e9:
        return f"${n/1e9:.1f}B"
    return f"${n/1e6:.1f}M"


def _call_ollama(prompt: str) -> str:
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.75,
                    "num_predict": 90,
                    "top_p": 0.9,
                    "stop": ["\n\n", "---", "Note:", "Note "],
                },
            },
            timeout=45,
        )
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as e:
        return f"STANCE: neutral\nCONFIDENCE: 5\nREASON: Unable to connect to AI model ({e})."


def _parse_response(text: str, raw_fallback: str = "") -> dict:
    stance = "neutral"
    confidence = 5
    reason = ""
    for line in text.strip().splitlines():
        line = line.strip()
        upper = line.upper()
        if upper.startswith("STANCE:"):
            val = line.split(":", 1)[1].strip().lower()
            stance = "bullish" if "bull" in val else "bearish" if "bear" in val else "neutral"
        elif upper.startswith("CONFIDENCE:"):
            try:
                confidence = max(1, min(10, int(line.split(":", 1)[1].strip().split()[0])))
            except (ValueError, IndexError):
                confidence = 5
        elif upper.startswith("REASON:"):
            reason = line.split(":", 1)[1].strip()
    if not reason:
        # fallback: use raw text truncated
        reason = text.strip().replace("\n", " ")[:180] or raw_fallback
    return {"stance": stance, "confidence": confidence, "reason": reason}


def _build_round1_prompt(persona: dict, ticker: str, stock: dict, headlines: list) -> str:
    price = f"${stock.get('price', 'N/A')}"
    pe = stock.get("pe_ratio") or "N/A"
    mcap = _fmt_market_cap(stock.get("market_cap"))
    chg = stock.get("change_percent")
    chg_str = f"{chg:+.2f}%" if chg is not None else "N/A"
    news_lines = "\n".join(f"- {h}" for h in (headlines or ["No recent news"])[:3])
    bias_hint = {"bull": "lean bullish", "bear": "lean bearish", "neutral": "stay objective"}[persona["bias"]]

    return f"""You are {persona['name']}, a {persona['role']} on Wall Street. You {bias_hint}.

Stock: {ticker}
Price: {price} ({chg_str} today)
P/E Ratio: {pe}
Market Cap: {mcap}
News:
{news_lines}

Give your reaction. Reply in EXACTLY this format, nothing else:
STANCE: bullish
CONFIDENCE: 7
REASON: Your two sentence analysis here."""


def _build_round2_prompt(persona: dict, ticker: str, price_str: str, prev_summary: str) -> str:
    return f"""You are {persona['name']}, a {persona['role']}.

Stock: {ticker} at {price_str}

Other analysts said:
{prev_summary}

Do you agree or disagree? Has your view changed? Reply in EXACTLY this format:
STANCE: bearish
CONFIDENCE: 6
REASON: Your two sentence response here."""


def _build_round3_prompt(persona: dict, ticker: str, price_str: str, prev_summary: str) -> str:
    return f"""You are {persona['name']}, a {persona['role']}.

Stock: {ticker} at {price_str}. This is your final verdict after debate.

Key views from the group:
{prev_summary}

Give your final position. Reply in EXACTLY this format:
STANCE: neutral
CONFIDENCE: 8
REASON: Your final two sentence verdict here."""


def _build_prev_summary(round_results: list, n: int = 5) -> str:
    sample = random.sample(round_results, min(n, len(round_results)))
    lines = []
    for r in sample:
        a = r["agent"]
        resp = r["response"]
        lines.append(f"{a['name']} ({a['role']}): {resp['stance']}, conf {resp['confidence']}: {resp['reason'][:100]}")
    return "\n".join(lines)


def _build_narrative(round3: list) -> str:
    total = len(round3)
    counts = {"bullish": 0, "bearish": 0, "neutral": 0}
    for r in round3:
        counts[r["response"]["stance"]] += 1
    dominant = max(counts, key=counts.get)
    dominant_count = counts[dominant]
    avg_conf = round(sum(r["response"]["confidence"] for r in round3) / total, 1)
    conf_label = "high" if avg_conf >= 7 else "moderate" if avg_conf >= 5 else "low"

    tone = {
        "bullish": "bullish outlook with growth catalysts outweighing risks",
        "bearish": "bearish thesis centered on valuation and macro concerns",
        "neutral": "mixed picture with no clear directional consensus",
    }[dominant]

    return (
        f"{dominant_count} of {total} analysts settled on a {dominant} final verdict "
        f"with {conf_label} average conviction ({avg_conf}/10). "
        f"The group converged on a {tone}."
    )


def run_simulation(ticker: str, stock: dict, headlines: list):
    """Generator yielding SSE event dicts."""

    yield {"type": "status", "message": f"Initializing simulation for {ticker}..."}

    price_str = f"${stock.get('price', '?')}"
    personas = list(PERSONAS)
    random.shuffle(personas)

    round_results = {1: [], 2: [], 3: []}

    for round_num in [1, 2, 3]:
        yield {"type": "round_start", "round": round_num, "label": ROUND_LABELS[round_num]}

        for persona in personas:
            if round_num == 1:
                prompt = _build_round1_prompt(persona, ticker, stock, headlines)
            elif round_num == 2:
                summary = _build_prev_summary(round_results[1])
                prompt = _build_round2_prompt(persona, ticker, price_str, summary)
            else:
                summary = _build_prev_summary(round_results[2])
                prompt = _build_round3_prompt(persona, ticker, price_str, summary)

            raw = _call_ollama(prompt)
            response = _parse_response(raw)

            entry = {"round": round_num, "agent": persona, "response": response}
            round_results[round_num].append(entry)
            yield {"type": "agent", "round": round_num, "agent": persona, "response": response}

    # Synthesis from round 3
    r3 = round_results[3]
    bulls   = [r for r in r3 if r["response"]["stance"] == "bullish"]
    bears   = [r for r in r3 if r["response"]["stance"] == "bearish"]
    neutrals = [r for r in r3 if r["response"]["stance"] == "neutral"]

    top_bulls = sorted(bulls, key=lambda x: x["response"]["confidence"], reverse=True)[:3]
    top_bears = sorted(bears, key=lambda x: x["response"]["confidence"], reverse=True)[:3]

    yield {
        "type": "synthesis",
        "report": {
            "bull_count":      len(bulls),
            "bear_count":      len(bears),
            "neutral_count":   len(neutrals),
            "dominant_stance": max(["bullish", "bearish", "neutral"],
                                   key=lambda s: len([r for r in r3 if r["response"]["stance"] == s])),
            "avg_confidence":  round(sum(r["response"]["confidence"] for r in r3) / len(r3), 1),
            "narrative":       _build_narrative(r3),
            "key_catalysts":   [r["response"]["reason"] for r in top_bulls],
            "key_risks":       [r["response"]["reason"] for r in top_bears],
        },
    }
