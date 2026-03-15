import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "StockTerminal research@stockterminal.com"}

_cache = {}


def get_cik(ticker: str) -> str | None:
    tickers_url = "https://www.sec.gov/files/company_tickers.json"
    try:
        resp = requests.get(tickers_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for entry in data.values():
            if entry["ticker"].upper() == ticker.upper():
                return str(entry["cik_str"]).zfill(10)
    except Exception:
        pass
    return None


def get_latest_10k_text(ticker: str) -> str | None:
    cache_key = ticker.upper()
    if cache_key in _cache:
        return _cache[cache_key]

    cik = get_cik(ticker)
    if not cik:
        return None

    try:
        sub_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        resp = requests.get(sub_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        filings = data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        accessions = filings.get("accessionNumber", [])

        for i, form in enumerate(forms):
            if form == "10-K":
                accession_clean = accessions[i].replace("-", "")
                accession_dashed = accessions[i]
                index_url = (
                    f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
                    f"{accession_clean}/{accession_dashed}-index.htm"
                )

                try:
                    idx_resp = requests.get(index_url, headers=HEADERS, timeout=10)
                    idx_resp.raise_for_status()
                    soup = BeautifulSoup(idx_resp.text, "html.parser")

                    doc_url = None

                    def _to_full_url(href):
                        if href.startswith("/"):
                            return "https://www.sec.gov" + href
                        return href

                    # Priority 1: inline XBRL viewer link (most modern 10-Ks)
                    for link in soup.find_all("a", href=True):
                        href = link["href"]
                        if "/ix?doc=" in href and "/Archives/" in href:
                            inner = href.split("/ix?doc=", 1)[1]
                            doc_url = _to_full_url(inner)
                            break

                    # Priority 2: direct /Archives/.htm link that isn't an exhibit
                    if not doc_url:
                        skip_words = ["exhibit", "ex-", "ex10", "ex21", "ex23", "ex31", "ex32",
                                      "companysearch", "searchedgar", "index"]
                        for link in soup.find_all("a", href=True):
                            href = link["href"]
                            href_lower = href.lower()
                            if "/Archives/" in href and ".htm" in href_lower and not any(s in href_lower for s in skip_words):
                                doc_url = _to_full_url(href)
                                break

                    if doc_url:
                        doc_resp = requests.get(doc_url, headers=HEADERS, timeout=30)
                        doc_resp.raise_for_status()
                        text = BeautifulSoup(doc_resp.text, "html.parser").get_text(separator=" ", strip=True)
                        text = text[:500000]
                        _cache[cache_key] = text
                        return text
                except Exception:
                    continue
    except Exception:
        pass

    return None
