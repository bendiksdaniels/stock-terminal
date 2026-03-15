"""
10-K Accounting Discrepancy Scanner
Scans SEC 10-K text for accounting red flags using regex pattern matching.
"""

import re

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_context(text: str, start: int, end: int, window: int = 500) -> str:
    """Extract ~2-3 sentences of context around a match."""
    lo = max(0, start - window)
    hi = min(len(text), end + window)
    chunk = text[lo:hi]

    # Find sentence boundaries
    def prev_boundary(s, pos):
        for i in range(pos, -1, -1):
            if s[i] in '.!?' and (i + 1 >= len(s) or s[i+1] in ' \n\t'):
                return i + 1
        return 0

    def next_boundary(s, pos):
        for i in range(pos, len(s)):
            if s[i] in '.!?' and (i + 1 >= len(s) or s[i+1] in ' \n\t'):
                return i + 1
        return len(s)

    # Positions within chunk
    rel_start = start - lo
    rel_end   = end   - lo
    lo2 = prev_boundary(chunk, max(0, rel_start - 1))
    hi2 = next_boundary(chunk, rel_end)

    excerpt = chunk[lo2:hi2].strip()
    # Collapse whitespace
    excerpt = re.sub(r'\s+', ' ', excerpt)
    return excerpt[:600]


def _nearest_heading(text: str, pos: int) -> str:
    """Find the nearest preceding section heading."""
    chunk = text[max(0, pos - 5000):pos]
    matches = list(re.finditer(
        r'(?:Item\s+\d+[A-Z]?\.|NOTE\s+\d+[:\-\.]|PART\s+[IVX]+)[^\n]{0,80}',
        chunk, re.IGNORECASE
    ))
    if matches:
        return re.sub(r'\s+', ' ', matches[-1].group()).strip()[:100]
    return ''


def _extract_number(text: str) -> float | None:
    """Extract first floating-point or integer from a string."""
    m = re.search(r'(\d+(?:\.\d+)?)', text)
    return float(m.group(1)) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# Pattern Registry
# ─────────────────────────────────────────────────────────────────────────────

REGISTRY = [

    # ── 1. Useful Life / Depreciation Changes ─────────────────────────────
    ("useful_life", [
        r'(?:extend(?:ed|ing)?|increas(?:ed|ing)?|revis(?:ed|ing)?|chang(?:ed|ing)?)\s+'
        r'(?:the\s+)?(?:estimated\s+)?useful\s+li(?:fe|ves)'
        r'(?:\s+[\w\s,]{0,40})?\s+(?:from\s+\d+\s+to\s+\d+|\bto\s+\d+(?:\s*[-–]\s*\d+)?\s+years?)',

        r'(?:server|data\s*center|network|infrastructure|equipment|building|aircraft|vehicle)'
        r'[\w\s]{0,30}useful\s+li(?:fe|ves)\s+(?:of\s+|from\s+|to\s+)?\d+(?:\s*[-–]\s*\d+)?\s+years?',

        r'(?:chang(?:ed|ing)?|revis(?:ed|ing)?|adopt(?:ed|ing)?)\s+'
        r'(?:our\s+|the\s+|its\s+)?depreciation\s+(?:method|policy|approach)',

        r'(?:straight[- ]line|accelerated|double[- ]declining)\s+(?:depreciation|method)'
        r'[\w\s,]{0,80}(?:chang(?:ed|ing)?|revis(?:ed|ing)?|adopt(?:ed|ing)?)',
    ],
    "MEDIUM",
    "Depreciation / Useful Life Change",
    "Companies can boost reported earnings by extending the useful lives of assets — the same asset generates less annual depreciation expense. Watch for servers, data centers, or buildings getting extended lives vs. prior disclosures."
    ),

    # ── 2. Lease Accounting ───────────────────────────────────────────────
    ("lease", [
        r'(?:data\s*center|colocation|server|facility|warehouse|distribution|campus)'
        r'[\w\s,]{0,60}(?:operating\s+lease|short[- ]term\s+lease|lease\s+term\s+of\s+\d+)',

        r'lease\s+(?:agreement|term)s?\s+[\w\s,]{0,60}'
        r'(?:renewal|extension)\s+option[\w\s,]{0,80}(?:critical|primary|principal|key|significant)',

        r'(?:initial|base)\s+(?:lease\s+term|term)\s+of\s+(?:one|two|three|1|2|3)\s+years?'
        r'[\w\s,]{0,120}(?:renew|extend|option)',

        r'short[- ]term\s+lease\s+(?:exception|practical\s+expedient|election)',

        r'classified?\s+(?:these|the|our|certain)\s+leases?\s+as\s+operating'
        r'[\w\s,]{0,60}(?:rather\s+than\s+finance|not\s+finance)',
    ],
    "MEDIUM",
    "Lease Accounting / Off-Balance Sheet Obligations",
    "Short-term leases with renewal options on critical infrastructure (data centers, factories) avoid appearing as liabilities on the balance sheet. Under ASC 842, only committed lease terms count — renewal options are excluded even if the company always renews."
    ),

    # ── 3. Revenue Recognition ────────────────────────────────────────────
    ("revenue", [
        r'(?:chang(?:ed|ing)?|revis(?:ed|ing)?|adopt(?:ed|ing)?|modif(?:ied|ying)?)\s+'
        r'(?:our\s+|the\s+|its\s+)?revenue\s+recognition\s+(?:policy|method|approach|timing|criteria)',

        r'(?:accelerat(?:ed|ing?)|earlier|sooner)\s+'
        r'(?:revenue\s+recognition|recognition\s+of\s+(?:deferred\s+)?revenue)',

        r'(?:sell[- ]?in|sell[- ]?through|point[- ]of[- ]sale)\s+'
        r'[\w\s,]{0,40}(?:chang(?:ed|ing)?|revis(?:ed|ing)?|adopt(?:ed|ing)?)',

        r'variable\s+consideration\s+[\w\s,]{0,80}'
        r'(?:probable|significant\s+revenue\s+reversal|constrain)',

        r'(?:percentage[- ]of[- ]completion|proportional\s+performance)\s+method'
        r'[\w\s,]{0,100}(?:estimated?|judgment|significant)',
    ],
    "MEDIUM",
    "Revenue Recognition Change",
    "Changes to how or when revenue is recognized can significantly inflate near-term earnings. Shifting from sell-through to sell-in, or aggressive use of percentage-of-completion, can pull forward revenue that hasn't truly been earned."
    ),

    # ── 4. Off-Balance Sheet / VIEs ───────────────────────────────────────
    ("off_balance", [
        r'variable\s+interest\s+entit(?:y|ies)',
        r'special\s+purpose\s+(?:entit(?:y|ies)|vehicle|acquisition)',
        r'off[- ]balance[- ]sheet\s+(?:arrangement|commitment|obligation|financing|liability|exposure)',
        r'(?:primary\s+beneficiary|not\s+the\s+primary\s+beneficiary)\s+'
        r'[\w\s,]{0,80}(?:consolidat|VIE|variable\s+interest)',
        r'unconsolidated\s+(?:entit(?:y|ies)|affiliates?|joint\s+ventures?)'
        r'[\w\s,]{0,120}(?:\$[\d,.]+\s+(?:million|billion)|liabilit)',
    ],
    "MEDIUM",
    "Off-Balance Sheet / Variable Interest Entity",
    "VIEs and special purpose entities can hide significant liabilities off the balance sheet. The key question is whether the company is the 'primary beneficiary' — if not, the obligations don't appear in the consolidated financials even if the company bears economic risk."
    ),

    # ── 5. Goodwill & Impairment Risk ─────────────────────────────────────
    ("goodwill", [
        r'(?:performed?|conducted?|completed?)\s+(?:a\s+)?qualitative\s+'
        r'(?:assessment|evaluation|test)\s+[\w\s,]{0,120}'
        r'(?:not\s+more\s+likely\s+than\s+not|no\s+further\s+testing)',

        r'goodwill\s+impairment\s+[\w\s,]{0,150}'
        r'(?:significant\s+judgment|key\s+assumption|discount\s+rate|terminal\s+(?:growth\s+)?rate)',

        r'indicators?\s+of\s+(?:potential\s+)?impairment',
        r'triggering\s+event[\w\s,]{0,80}(?:impairment|goodwill)',

        r'goodwill\s+(?:of\s+|totaling?\s+|represents?\s+)?\$[\d,.]+\s+(?:million|billion)',
    ],
    "MEDIUM",
    "Goodwill Impairment Risk",
    "Using qualitative-only ('step zero') goodwill impairment tests allows companies to avoid writing down goodwill even when underlying businesses deteriorate. Large goodwill balances combined with qualitative-only testing and sensitive discount rate assumptions are a warning sign."
    ),

    # ── 6. Aggressive Capitalization ──────────────────────────────────────
    ("capitalization", [
        r'capitaliz(?:es?|ed?|ing?)\s+(?:internal[- ]use\s+software|software\s+development\s+costs?)'
        r'[\w\s,]{0,100}(?:application\s+development|coding|implementation)',

        r'capitaliz(?:es?|ed?|ing?)\s+'
        r'(?:customer\s+acquisition\s+costs?|sales\s+commission|contract\s+acquisition)',

        r'(?:chang(?:ed|ing)?|revis(?:ed|ing)?|increas(?:ed|ing)?|rais(?:ed|ing)?)\s+'
        r'(?:the\s+)?(?:capitalization\s+threshold|threshold\s+for\s+capitaliz)',

        r'capitaliz(?:es?|ed?|ing?)\s+(?:certain\s+)?(?:research\s+and\s+development|R&D)\s+costs?',

        r'capitaliz(?:es?|ed?|ing?)\s+(?:website|cloud\s+computing|hosting\s+arrangement|implementation\s+costs?)',
    ],
    "MEDIUM",
    "Aggressive Cost Capitalization",
    "Capitalizing costs that should be expensed (software development, customer acquisition, R&D) moves expenses from the income statement to the balance sheet, boosting near-term profits. Raising capitalization thresholds has the same effect."
    ),

    # ── 7. Related Party Transactions ─────────────────────────────────────
    ("related_party", [
        r'(?:loan|advance|note\s+receivable)\s+(?:to|from)\s+'
        r'(?:officers?|directors?|executives?|named\s+executive|founder)',

        r'(?:CEO|CFO|chairman|founder|officer|director|executive)\s+[\w\s,]{0,80}'
        r'(?:personal\s+aircraft|charter\s+flight|private\s+(?:jet|plane)|consulting\s+agreement)',

        r'(?:transaction|arrangement|agreement)\s+[\w\s,]{0,40}'
        r'(?:affiliated?\s+(?:compan|entit)|related\s+part)'
        r'[\w\s,]{0,80}(?:not\s+(?:necessarily|arm[\'s]*\s+length)|may\s+not\s+be)',

        r'related[- ]party\s+(?:transaction|arrangement|balance|receivable|payable)',
    ],
    "LOW",
    "Related Party Transaction",
    "Transactions with insiders, affiliates, or related parties may not be conducted at arm's length. Loans to executives, personal aircraft use, or consulting fees paid to founders are common disclosure areas to scrutinize."
    ),

    # ── 8. Auditor Red Flags ──────────────────────────────────────────────
    ("auditor", [
        r'(?:substantial\s+doubt|going\s+concern)\s+[\w\s,]{0,200}'
        r'(?:ability\s+to\s+continue|continue\s+as\s+a\s+going\s+concern)',

        r'material\s+weakness(?:es)?\s+[\w\s,]{0,200}'
        r'(?:identified?|existed?|reported?|disclosed?|remediat)',

        r'significant\s+deficienc(?:y|ies)\s+[\w\s,]{0,120}'
        r'(?:identified?|existed?|reported?)',

        r'(?:restat(?:ed?|ing?|ement)|restat(?:e|ing)\s+(?:our|the|its|previously)?\s+'
        r'(?:financial\s+statements?|reported\s+results?))',

        r'(?:internal\s+control|disclosure\s+control)\s+[\w\s,]{0,80}'
        r'(?:not\s+effective|were\s+not\s+effective|was\s+not\s+effective)',
    ],
    "HIGH",
    "Auditor / Internal Control Flag",
    "Going concern doubts, material weaknesses, and restatements are the most serious signals in a 10-K. A material weakness means the company's financial statements may be unreliable. Restatements mean they already were."
    ),

    # ── 9. Pension Assumptions ────────────────────────────────────────────
    ("pension", [
        r'(?:discount\s+rate|weighted[- ]average\s+discount\s+rate)\s+'
        r'(?:of\s+|used\s+was\s+|assumption\s+of\s+)?\d+(?:\.\d+)?\s*%',

        r'(?:expected\s+(?:long[- ]term\s+)?return|assumed?\s+(?:rate\s+of\s+)?return)\s+'
        r'(?:on\s+plan\s+assets?|on\s+assets?)\s+(?:of\s+)?\d+(?:\.\d+)?\s*%',

        r'(?:increas(?:ed|ing)?|decreas(?:ed|ing)?|revis(?:ed|ing)?|chang(?:ed|ing)?)\s+'
        r'(?:our\s+|the\s+)?(?:discount\s+rate|expected\s+return|pension\s+assumption)',

        r'(?:underfunded?|unfunded?\s+(?:pension|obligation)|pension\s+(?:deficit|shortfall))',
    ],
    "LOW",
    "Pension Assumption",
    "Pension accounting relies on key assumptions: discount rate (lower = larger liability) and expected return on assets (higher = lower annual expense). Companies can use aggressive assumptions to reduce reported pension costs. Underfunded pensions represent real future cash obligations."
    ),

    # ── 10. Inventory / COGS ──────────────────────────────────────────────
    ("inventory", [
        r'(?:chang(?:ed|ing)?|adopt(?:ed|ing)?|elect(?:ed|ing)?|switch(?:ed|ing)?)\s+'
        r'(?:from\s+)?(?:LIFO|FIFO|first[- ]in\s*,?\s*first[- ]out|last[- ]in\s*,?\s*first[- ]out|weighted[- ]average\s+cost)\s+'
        r'(?:to|method|basis|inventory)',

        r'LIFO\s+(?:reserve|liquidation|decrement|layer)',

        r'(?:inventory\s+)?(?:write[- ]?down|write[- ]?off|impairment)\s+'
        r'(?:of\s+)?(?:inventory|inventories)\s+[\w\s,]{0,80}\$[\d,.]+\s+(?:million|billion)',

        r'(?:increas(?:ed|ing)?|decreas(?:ed|ing)?|revis(?:ed|ing)?)\s+'
        r'(?:inventory\s+)?(?:obsolescence|shrinkage)\s+(?:reserve|allowance|provision)',
    ],
    "MEDIUM",
    "Inventory / COGS Accounting",
    "Switching between FIFO and LIFO inventory methods, LIFO liquidations, and changes to obsolescence reserves all directly affect reported gross margins. These changes can make profitability look better without any actual operational improvement."
    ),
]

# Severity overrides based on content analysis
_HIGH_KEYWORDS  = ['material weakness', 'going concern', 'restatement', 'restated', 'not effective']
_UPGRADE_WORDS  = ['changed', 'revised', 'extended', 'increased', 'raised', 'critical', 'primary', 'significant impairment']

def _compute_severity(base: str, excerpt: str, category: str) -> str:
    el = excerpt.lower()
    # Always HIGH for auditor category
    if category == 'auditor':
        return 'HIGH'
    # Upgrade to HIGH if serious keywords present
    for kw in _HIGH_KEYWORDS:
        if kw in el:
            return 'HIGH'
    # Upgrade MEDIUM→HIGH if change/extension explicitly stated
    if base == 'MEDIUM':
        for kw in _UPGRADE_WORDS:
            if kw in el:
                return 'HIGH'
    # Pension: upgrade if expected return > 8%
    if category == 'pension' and 'expected' in el and 'return' in el:
        n = _extract_number(excerpt)
        if n and n > 8.0:
            return 'HIGH'
    return base


MAX_PER_CATEGORY = 6

def scan_accounting_flags(text: str) -> list[dict]:
    findings = []
    category_counts: dict[str, int] = {}
    seen_sigs: set[str] = set()

    for (cat, patterns, base_sev, title, explanation) in REGISTRY:
        for pattern in patterns:
            try:
                for m in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
                    if category_counts.get(cat, 0) >= MAX_PER_CATEGORY:
                        break

                    excerpt = _extract_context(text, m.start(), m.end())
                    sig = re.sub(r'\s+', '', excerpt[:100].lower())
                    if sig in seen_sigs:
                        continue
                    seen_sigs.add(sig)

                    severity  = _compute_severity(base_sev, excerpt, cat)
                    page_hint = _nearest_heading(text, m.start())

                    findings.append({
                        "category":    cat,
                        "severity":    severity,
                        "title":       title,
                        "excerpt":     excerpt,
                        "explanation": explanation,
                        "page_hint":   page_hint,
                    })
                    category_counts[cat] = category_counts.get(cat, 0) + 1
            except re.error:
                continue

    ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    findings.sort(key=lambda f: ORDER.get(f["severity"], 3))
    return findings
