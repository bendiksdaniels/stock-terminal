import re
import spacy
from collections import defaultdict

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess
    subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], capture_output=True)
    nlp = spacy.load("en_core_web_sm")

nlp.select_pipes(enable=["ner"])

CUSTOMER_WORDS = ["customer", "client", "purchaser", "buyer", "end user", "consumer", "sold to", "sells to", "revenue from"]
SUPPLIER_WORDS = ["supplier", "vendor", "manufactur", "provider", "source", "procure", "purchase from", "supply", "subcontract"]
PARTNER_WORDS  = ["partner", "partnership", "joint venture", "collaborat", "alliance", "agreement with", "contract with", "work with"]
ACQUISITION_WORDS = ["acqui", "merger", "acquired", "acquisition of", "purchase of"]
COMPETITOR_WORDS  = ["compet", "rival", "market share", "industry peer"]
LICENSEE_WORDS    = ["licens", "royalt", "intellectual property"]

DOLLAR_RE  = re.compile(r'\$\s*(\d+(?:\.\d+)?)\s*(million|billion|thousand|M|B|K)\b', re.IGNORECASE)
PERCENT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*%\s*of\s*(revenue|net revenue|total revenue|sales)', re.IGNORECASE)

ORDER = {"Customer": 0, "Supplier": 1, "Partner": 2, "Acquisition": 3, "Licensee": 4, "Competitor": 5}


def _classify(context: str):
    cl = context.lower()
    if any(w in cl for w in CUSTOMER_WORDS):   return "Customer"
    if any(w in cl for w in SUPPLIER_WORDS):   return "Supplier"
    if any(w in cl for w in PARTNER_WORDS):    return "Partner"
    if any(w in cl for w in ACQUISITION_WORDS):return "Acquisition"
    if any(w in cl for w in COMPETITOR_WORDS): return "Competitor"
    if any(w in cl for w in LICENSEE_WORDS):   return "Licensee"
    return None


def _extract_section(text: str, start_pattern: str, end_pattern: str, max_chars=120000):
    m = re.search(start_pattern, text[:max_chars], re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    start = m.start()
    end_m = re.search(end_pattern, text[start + 100:start + max_chars], re.IGNORECASE)
    end = start + end_m.start() if end_m else start + 60000
    return text[start:end]


def extract_relationships(text: str) -> list:
    sections = []

    s = _extract_section(text, r'item\s+1[.\s]+business', r'item\s+1a', 150000)
    if s:
        sections.append(s)

    for kw in ["customer", "supplier", "partner", "vendor", "competitor"]:
        idx = text.lower().find(kw)
        if idx != -1:
            chunk = text[max(0, idx - 200):idx + 8000]
            sections.append(chunk)

    if not sections:
        sections.append(text[:80000])

    seen = set()
    results = []

    for section in sections:
        if not section:
            continue
        for i in range(0, min(len(section), 200000), 90000):
            chunk = section[i:i + 90000]
            try:
                doc = nlp(chunk)
            except Exception:
                continue

            for ent in doc.ents:
                if ent.label_ != "ORG":
                    continue
                company = ent.text.strip()
                if len(company) < 3 or company in seen:
                    continue
                if company.lower() in {"the", "sec", "gaap", "u.s.", "u.s", "fasb", "iasb", "irs", "ebitda"}:
                    continue

                ctx_start = max(0, ent.start_char - 300)
                ctx_end   = min(len(chunk), ent.end_char + 300)
                context   = chunk[ctx_start:ctx_end]

                rel_type = _classify(context)
                if rel_type is None:
                    continue

                dm = DOLLAR_RE.findall(context)
                pm = PERCENT_RE.findall(context)
                if dm:
                    amount, unit = dm[0]
                    value = f"${amount} {unit.capitalize()}"
                elif pm:
                    pct, rev_type = pm[0]
                    value = f"{pct}% of {rev_type}"
                else:
                    value = "\u2014"

                seen.add(company)
                results.append({
                    "company": company,
                    "relationship": rel_type,
                    "value": value,
                    "context": context[:200].replace("\n", " ").strip(),
                })

                if len(results) >= 60:
                    return sorted(results, key=lambda x: ORDER.get(x["relationship"], 99))

    return sorted(results, key=lambda x: ORDER.get(x["relationship"], 99))
