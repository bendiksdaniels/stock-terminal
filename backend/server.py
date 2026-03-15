import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import requests
import time
from fastapi import FastAPI, HTTPException, UploadFile, File

# Simple in-memory cache: key -> (timestamp, data)
_CACHE: dict = {}
_CACHE_TTL = 3600  # 1 hour

def _cache_get(key):
    entry = _CACHE.get(key)
    if entry and time.time() - entry[0] < _CACHE_TTL:
        return entry[1]
    return None

def _cache_set(key, value):
    _CACHE[key] = (time.time(), value)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from data.stock import get_stock_info
from data.edgar import get_latest_10k_text
from data.parser import extract_relationships

app = FastAPI(title='Stock Terminal API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/api/health')
async def health():
    return {'status': 'ok'}


@app.get('/api/stock/{ticker}')
async def stock_info(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"stock:{t}")
    if cached:
        return cached
    try:
        info = await run_in_threadpool(get_stock_info, t)
        if not info:
            raise HTTPException(status_code=404, detail=f'Ticker {ticker} not found')
        _cache_set(f"stock:{t}", info)
        return info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get('/api/relationships/{ticker}')
async def relationships(ticker: str):
    try:
        text = await run_in_threadpool(get_latest_10k_text, ticker.upper())
        if not text:
            raise HTTPException(status_code=404, detail=f'No 10-K found for {ticker}')
        rels = await run_in_threadpool(extract_relationships, text)
        return rels if rels else []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get('/api/search')
async def search_companies(q: str):
    if len(q) < 1:
        return []
    url = f'https://query2.finance.yahoo.com/v1/finance/search?q={q}&lang=en-US&region=US&quotesCount=8&newsCount=0&enableFuzzyQuery=false'
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers, timeout=5)
    data = resp.json()
    results = []
    for item in data.get('quotes', []):
        if item.get('quoteType') in ('EQUITY', 'ETF'):
            results.append({
                'ticker': item.get('symbol', ''),
                'name': item.get('longname') or item.get('shortname', ''),
                'exchange': item.get('exchange', ''),
                'type': item.get('quoteType', '')
            })
    return results


@app.get('/api/history/{ticker}')
async def get_history(ticker: str, period: str = '1mo'):
    def fetch():
        import yfinance as yf
        valid_periods = {'1wk': '1wk', '1mo': '1mo', '3mo': '3mo', '1y': '1y', '5y': '5y'}
        p = valid_periods.get(period, '1mo')
        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(period=p)
        if hist.empty:
            return None
        data = []
        for date, row in hist.iterrows():
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume']),
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
            })
        return data
    result = await run_in_threadpool(fetch)
    if result is None:
        return JSONResponse({'error': 'No history found'}, status_code=404)
    return result


@app.get('/api/insiders/{ticker}')
async def get_insiders(ticker: str):
    def fetch():
        import yfinance as yf
        import pandas as pd
        t = yf.Ticker(ticker)
        
        results = []
        
        try:
            transactions = t.insider_transactions
            if transactions is not None and not transactions.empty:
                for _, row in transactions.iterrows():
                    text = str(row.get('Text', ''))
                    shares = row.get('Shares', 0)
                    value = row.get('Value', None)
                    date = row.get('Start Date', None)
                    insider = row.get('Insider', '')
                    position = row.get('Position', '')
                    
                    tx_type = 'Unknown'
                    text_lower = text.lower()
                    if 'sale' in text_lower or 'sell' in text_lower or 'sold' in text_lower:
                        tx_type = 'Sell'
                    elif 'purchase' in text_lower or 'buy' in text_lower or 'bought' in text_lower or 'acquisition' in text_lower:
                        tx_type = 'Buy'
                    elif 'option' in text_lower:
                        tx_type = 'Option'
                    elif 'gift' in text_lower:
                        tx_type = 'Gift'
                    
                    results.append({
                        'insider': str(insider),
                        'position': str(position),
                        'transaction': tx_type,
                        'shares': int(shares) if pd.notna(shares) else 0,
                        'value': float(value) if value is not None and pd.notna(value) else None,
                        'date': str(date.date()) if hasattr(date, 'date') else str(date) if date else '',
                        'text': text[:120]
                    })
        except Exception:
            pass
        
        holdings = {}
        try:
            holders = t.insider_roster_holders
            if holders is not None and not holders.empty:
                for _, row in holders.iterrows():
                    name = str(row.get('Name', ''))
                    pos = row.get('Position', '')
                    shares_held = row.get('Shares', 0)
                    pct = row.get('% Out', None)
                    holdings[name] = {
                        'position': str(pos),
                        'shares_held': int(shares_held) if pd.notna(shares_held) else 0,
                        'pct_outstanding': float(pct) if pct is not None and pd.notna(pct) else None
                    }
        except Exception:
            pass
        
        for tx in results:
            name = tx['insider']
            if name in holdings:
                tx['shares_held'] = holdings[name]['shares_held']
                tx['pct_outstanding'] = holdings[name]['pct_outstanding']
            else:
                tx['shares_held'] = None
                tx['pct_outstanding'] = None
        
        return {
            'transactions': results[:30],
            'holdings': list(holdings.values())[:20]
        }
    
    from starlette.concurrency import run_in_threadpool
    result = await run_in_threadpool(fetch)
    return result


@app.get('/api/business/{ticker}')
async def get_business_relationships(ticker: str):
    def fetch():
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from data.edgar import get_latest_10k_text
        from data.parser import extract_relationships
        
        text = get_latest_10k_text(ticker)
        if not text:
            return {'error': 'No 10-K found', 'relationships': []}
        
        relationships = extract_relationships(text)
        
        grouped = {
            'customers': [],
            'suppliers': [],
            'partners': [],
            'competitors': [],
            'acquisitions': [],
            'other': []
        }
        
        for r in relationships:
            rel = r.get('relationship', '').lower()
            if rel == 'customer':
                grouped['customers'].append(r)
            elif rel == 'supplier':
                grouped['suppliers'].append(r)
            elif rel == 'partner':
                grouped['partners'].append(r)
            elif rel == 'competitor':
                grouped['competitors'].append(r)
            elif rel == 'acquisition':
                grouped['acquisitions'].append(r)
            else:
                grouped['other'].append(r)
        
        return {
            'relationships': relationships,
            'grouped': grouped,
            'total': len(relationships),
            'filing_length': len(text)
        }
    
    from starlette.concurrency import run_in_threadpool
    result = await run_in_threadpool(fetch)
    return result

@app.get("/api/fundamentals/{ticker}")
async def get_fundamentals(ticker: str):
    def fetch():
        import yfinance as yf
        import pandas as pd
        t = yf.Ticker(ticker)
        
        revenue_data = []
        eps_data = []
        
        try:
            # Annual income statement
            financials = t.income_stmt  # columns are dates, rows are metrics
            if financials is not None and not financials.empty:
                # Revenue
                for col in financials.columns:
                    year = str(col.year) if hasattr(col, 'year') else str(col)[:4]
                    rev_row = None
                    for label in ["Total Revenue", "Revenue"]:
                        if label in financials.index:
                            rev_row = financials.loc[label, col]
                            break
                    net_income = None
                    if "Net Income" in financials.index:
                        net_income = financials.loc["Net Income", col]
                    
                    if rev_row is not None and pd.notna(rev_row):
                        revenue_data.append({
                            "year": year,
                            "revenue": round(float(rev_row) / 1e9, 3),
                            "revenue_raw": float(rev_row)
                        })
                    if net_income is not None and pd.notna(net_income):
                        eps_data.append({
                            "year": year,
                            "net_income": round(float(net_income) / 1e9, 3)
                        })
        except Exception as e:
            pass
        
        # Get EPS per share separately
        eps_per_share = []
        try:
            info = t.info
            shares = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding")
            
            financials = t.income_stmt
            if financials is not None and not financials.empty and shares:
                for col in financials.columns:
                    year = str(col.year) if hasattr(col, 'year') else str(col)[:4]
                    net_income = None
                    if "Net Income" in financials.index:
                        net_income = financials.loc["Net Income", col]
                    if net_income is not None and pd.notna(net_income) and shares:
                        eps = float(net_income) / float(shares)
                        eps_per_share.append({
                            "year": year,
                            "eps": round(eps, 3)
                        })
        except Exception:
            pass
        
        # Sort by year ascending
        revenue_data.sort(key=lambda x: x["year"])
        eps_per_share.sort(key=lambda x: x["year"])
        
        # Merge into one list by year
        year_map = {}
        for r in revenue_data:
            year_map.setdefault(r["year"], {})["revenue"] = r["revenue"]
        for e in eps_per_share:
            year_map.setdefault(e["year"], {})["eps"] = e["eps"]
        
        merged = [
            {"year": y, "revenue": d.get("revenue"), "eps": d.get("eps")}
            for y, d in sorted(year_map.items())
        ]
        
        return {
            "annual": merged,
            "currency": "USD"
        }
    
    from starlette.concurrency import run_in_threadpool
    result = await run_in_threadpool(fetch)
    return result

@app.get("/api/statements/{ticker}")
async def get_statements(ticker: str):
    def fetch():
        import yfinance as yf
        import pandas as pd
        t = yf.Ticker(ticker)
        
        def df_to_json(df):
            if df is None or df.empty:
                return []
            rows = []
            for idx in df.index:
                row = {"metric": str(idx)}
                for col in df.columns:
                    year = str(col.year) if hasattr(col, 'year') else str(col)[:10]
                    val = df.loc[idx, col]
                    row[year] = None if pd.isna(val) else round(float(val) / 1e6, 2)  # in millions
                rows.append(row)
            return rows
        
        years = []
        try:
            cols = t.income_stmt.columns if t.income_stmt is not None else []
            years = [str(c.year) if hasattr(c, 'year') else str(c)[:4] for c in cols]
        except:
            pass
        
        return {
            "years": years,
            "income_statement": df_to_json(t.income_stmt),
            "balance_sheet": df_to_json(t.balance_sheet),
            "cash_flow": df_to_json(t.cashflow),
            "quarterly_income": df_to_json(t.quarterly_income_stmt),
            "currency": "USD (in Millions)"
        }
    
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(fetch)


def _parse_feed(feed_url: str, limit: int = 20) -> list:
    """Parse an RSS/Atom feed and return normalised article dicts."""
    import feedparser
    from bs4 import BeautifulSoup
    import time

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    resp = requests.get(feed_url, headers=headers, timeout=10)
    feed = feedparser.parse(resp.text)
    results = []
    for entry in feed.entries[:limit]:
        title = entry.get("title", "").strip()
        if not title:
            continue
        link = entry.get("link", "")
        publisher = feed.feed.get("title", "")
        # Date
        date = ""
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                date = time.strftime("%Y-%m-%d", entry.published_parsed)
            except Exception:
                pass
        # Summary — strip HTML tags
        raw_summary = entry.get("summary") or entry.get("description") or ""
        summary = BeautifulSoup(raw_summary, "html.parser").get_text(" ", strip=True)[:300]
        # Full content from RSS if available
        content_text = ""
        if hasattr(entry, "content"):
            for c in entry.content:
                ct = BeautifulSoup(c.get("value", ""), "html.parser").get_text(" ", strip=True)
                if len(ct) > len(content_text):
                    content_text = ct
        results.append({
            "title": title,
            "summary": summary,
            "publisher": publisher,
            "url": link,
            "date": date,
            "full_text": content_text,
        })
    return results


# Free financial RSS feeds (verified working, no paywall, no API key)
MARKET_FEEDS = [
    "https://finance.yahoo.com/news/rssindex",               # Yahoo Finance general
    "https://feeds.bbci.co.uk/news/business/rss.xml",        # BBC Business
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", # NYT Business (free)
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",         # WSJ Markets
    "https://www.investing.com/rss/news.rss",                # Investing.com
    "https://www.ft.com/rss/home/uk",                        # FT (headlines free)
]

TICKER_FEEDS = [
    "https://finance.yahoo.com/rss/headline?s={ticker}",     # Yahoo Finance ticker RSS
    "https://finance.yahoo.com/news/rssindex",               # fallback general
]


@app.get("/api/news/{ticker}")
async def get_news(ticker: str):
    def fetch():
        results = []
        seen = set()
        for tpl in TICKER_FEEDS:
            url = tpl.format(ticker=ticker.upper())
            try:
                for item in _parse_feed(url, 20):
                    if item["title"] not in seen:
                        seen.add(item["title"])
                        results.append(item)
            except Exception:
                continue
            if len(results) >= 20:
                break
        return results[:20]
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(fetch)


def _html_to_paragraphs(html_or_text: str, from_text=False) -> list:
    from bs4 import BeautifulSoup
    if from_text:
        # plain text — split by double newlines
        paras = [p.strip() for p in html_or_text.split("\n\n") if len(p.strip()) > 40]
        return [{"type": "paragraph", "text": p} for p in paras]
    soup = BeautifulSoup(html_or_text, "html.parser")
    for tag in soup(["script","style","img","video","iframe","nav","header",
                     "footer","aside","form","button","figure","figcaption",
                     "picture","source","svg","canvas","noscript","meta","link",
                     "advertisement","[class*='ad-']","[class*='promo']"]):
        tag.decompose()
    # Remove paywall / subscription nag elements
    for cls in ["paywall","subscription","subscribe","piano","tp-","overlay","modal","popup","cookie"]:
        for el in soup.find_all(class_=lambda c: c and cls in str(c).lower()):
            el.decompose()
    article = (
        soup.find("article") or
        soup.find(class_=lambda c: c and any(x in str(c).lower() for x in
            ["article-body","article__body","story-body","post-body",
             "entry-content","article-content","content-body","article-text",
             "story-content","body-text","richtext"])) or
        soup.find("main") or
        soup.find("div", {"id": lambda i: i and any(x in str(i).lower() for x in
            ["article","story","content","body","text"])})
    )
    target = article or soup.find("body")
    if not target:
        return []
    paragraphs = []
    for el in target.find_all(["p","h1","h2","h3","h4","blockquote","li"]):
        text = el.get_text(separator=" ", strip=True)
        if len(text) < 35:
            continue
        # Skip paywall/cookie/subscribe noise
        lower = text.lower()
        if any(w in lower for w in ["subscribe to read","sign in to read","create an account",
                                     "cookie policy","privacy policy","already a subscriber",
                                     "to continue reading","unlimited access"]):
            continue
        tag_name = el.name
        if tag_name in ("h1","h2","h3","h4"):
            paragraphs.append({"type": "heading", "text": text})
        elif tag_name == "blockquote":
            paragraphs.append({"type": "quote", "text": text})
        elif tag_name == "li":
            paragraphs.append({"type": "bullet", "text": text})
        else:
            paragraphs.append({"type": "paragraph", "text": text})
    return paragraphs


@app.get("/api/article")
async def get_article(url: str, full_text: str = ""):
    """
    Fetch article content. If full_text is provided (from RSS), use it directly.
    Otherwise try fetching the URL with multiple strategies.
    """
    def fetch():
        from bs4 import BeautifulSoup

        # Strategy 0: RSS already gave us full text
        if full_text and len(full_text) > 200:
            paras = _html_to_paragraphs(full_text)
            if paras:
                return {"title": "", "paragraphs": paras, "url": url, "source": "rss"}

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Cache-Control": "no-cache",
        }

        urls_to_try = [url]

        # Strategy 1: Try Google AMP version
        from urllib.parse import urlparse
        parsed = urlparse(url)
        amp_url = f"{parsed.scheme}://amp.{parsed.netloc}{parsed.path}"
        urls_to_try.append(amp_url)

        # Strategy 2: Try outline.com (reader view proxy)
        urls_to_try.append(f"https://outline.com/{url}")

        for try_url in urls_to_try:
            try:
                resp = requests.get(try_url, headers=headers, timeout=10, allow_redirects=True)
                if resp.status_code != 200:
                    continue
                paras = _html_to_paragraphs(resp.text)
                if len(paras) >= 3:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    title_tag = soup.find("h1") or soup.find("title")
                    title = title_tag.get_text(strip=True) if title_tag else ""
                    return {"title": title, "paragraphs": paras, "url": url, "source": "web"}
            except Exception:
                continue

        return {"error": "Article is behind a paywall or could not be loaded.", "title": "", "paragraphs": [], "url": url}

    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(fetch)


@app.get("/api/market-news")
async def get_market_news():
    def fetch():
        results = []
        seen = set()
        for feed_url in MARKET_FEEDS:
            try:
                for item in _parse_feed(feed_url, 15):
                    if item["title"] not in seen:
                        seen.add(item["title"])
                        results.append(item)
            except Exception:
                continue
            if len(results) >= 25:
                break
        return results[:25]
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(fetch)


@app.post("/api/import-portfolio")
async def import_portfolio(file: UploadFile = File(...)):
    """
    Parse an uploaded Excel (.xlsx/.xls) or CSV file and return
    a list of portfolio positions: {ticker, shares, avg_price, name_hint}.
    Columns are auto-detected by name — flexible header matching.
    """
    import io, pandas as pd

    content = await file.read()
    filename = file.filename.lower()

    HEADER_KEYWORDS = {"symbol", "ticker", "name", "quantity", "shares", "price", "cost", "qty"}

    def find_header_row(raw_df):
        """Scan first 10 rows to find which one contains column headers."""
        for i, row in raw_df.head(10).iterrows():
            vals = [str(v).strip().lower() for v in row if str(v).strip().lower() not in ("nan", "none", "")]
            if sum(1 for v in vals if any(k in v for k in HEADER_KEYWORDS)) >= 2:
                return i
        return None

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
            # Check if headers got lost
            raw = pd.read_csv(io.BytesIO(content), header=None)
            hr = find_header_row(raw)
            if hr is not None and hr > 0:
                df = pd.read_csv(io.BytesIO(content), header=hr)
        elif filename.endswith((".xlsx", ".xls")):
            raw = pd.read_excel(io.BytesIO(content), header=None)
            hr = find_header_row(raw)
            header_row = hr if hr is not None else 0
            df = pd.read_excel(io.BytesIO(content), header=header_row)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Upload .xlsx, .xls, or .csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    # Normalise column names for matching
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Ticker/symbol — "symbol", "ticker", "name" (when it looks like a ticker)
    TICKER_COLS = [
        "symbol", "ticker", "stock symbol", "stock", "code",
        "security", "instrument", "asset", "scrip",
    ]
    # Shares/quantity
    SHARES_COLS = [
        "quantity", "qty", "shares", "units", "position",
        "no. of shares", "num shares", "number of shares",
        "holdings", "amount", "volume",
    ]
    # Avg buy price — prefer "price(bought)", "cost basis" over "price(current)"
    PRICE_COLS = [
        "price(bought)", "price bought", "buy price", "bought price",
        "avg price", "average price", "avg. price", "avg cost",
        "average cost", "entry price", "entry", "cost basis",
        "cost/share", "purchase price", "paid", "cost",
        "price",  # generic fallback — only after specific ones
    ]
    # Name column (optional — used to supplement ticker detection)
    NAME_COLS = ["name", "company", "company name", "security name", "description"]

    def find_col(candidates):
        for c in candidates:
            if c in df.columns:
                return c
            for col in df.columns:
                if c in col or col in c:
                    return col
        return None

    ticker_col = find_col(TICKER_COLS)
    shares_col = find_col(SHARES_COLS)
    price_col  = find_col(PRICE_COLS)
    name_col   = find_col(NAME_COLS)

    # If no symbol column found but there's a "name" column, use it as ticker
    if not ticker_col and name_col:
        ticker_col = name_col
        name_col = None

    found_cols = list(df.columns)
    if not ticker_col:
        return JSONResponse({"error": f"Could not find a symbol/ticker column. Found: {found_cols}"}, status_code=422)
    if not shares_col:
        return JSONResponse({"error": f"Could not find a quantity/shares column. Found: {found_cols}"}, status_code=422)
    if not price_col:
        # Price is optional — positions without price will have avg_price=None
        pass

    def clean_number(val):
        return float(str(val).replace(",", "").replace("$", "").replace("%", "").strip())

    # raw_lots: list of {ticker, shares, cost (shares*price), name}
    raw_lots = []
    for _, row in df.iterrows():
        ticker = str(row[ticker_col]).strip().upper()
        if not ticker or ticker in ("NAN", "NONE", "", "TICKER", "SYMBOL"):
            continue
        # Tickers are short (≤6 chars); skip cells that look like company names or summary rows
        if len(ticker) > 6 or " " in ticker:
            continue
        try:
            shares = clean_number(row[shares_col])
        except (ValueError, TypeError):
            continue
        if shares <= 0:
            continue
        try:
            price = clean_number(row[price_col]) if price_col else 0
        except (ValueError, TypeError):
            price = 0

        name_val = None
        if name_col and name_col in df.columns:
            nv = str(row[name_col]).strip()
            if nv and nv.upper() not in ("NAN", "NONE", ""):
                name_val = nv

        raw_lots.append({
            "ticker": ticker,
            "shares": shares,
            "cost":   shares * price if price > 0 else None,
            "name":   name_val,
        })

    # Merge multiple lots of the same ticker using weighted average price
    merged = {}
    for lot in raw_lots:
        t = lot["ticker"]
        if t not in merged:
            merged[t] = {"ticker": t, "shares": 0.0, "total_cost": 0.0, "has_price": False, "name": lot["name"]}
        merged[t]["shares"] += lot["shares"]
        if lot["cost"] is not None:
            merged[t]["total_cost"] += lot["cost"]
            merged[t]["has_price"] = True
        # Keep the first non-null name
        if merged[t]["name"] is None and lot["name"]:
            merged[t]["name"] = lot["name"]

    positions = []
    for t, m in merged.items():
        pos = {
            "ticker":    t,
            "shares":    round(m["shares"], 6),
            "avg_price": round(m["total_cost"] / m["shares"], 4) if m["has_price"] and m["shares"] > 0 else None,
        }
        if m["name"]:
            pos["name"] = m["name"]
        positions.append(pos)

    return {
        "positions": positions,
        "total": len(positions),
        "detected_columns": {
            "ticker": ticker_col,
            "shares": shares_col,
            "price":  price_col,
        }
    }


@app.get("/api/contracts/{ticker}")
async def get_contracts(ticker: str):
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(_fetch_contracts, ticker)

def _fetch_contracts(ticker: str):
    import requests, yfinance as yf
    info = yf.Ticker(ticker).info
    company_name = info.get('shortName') or info.get('longName') or ticker
    url = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
    payload = {
        "filters": {
            "recipient_search_text": [company_name.split()[0]],
            "award_type_codes": ["A","B","C","D"]
        },
        "fields": ["Award ID", "Recipient Name", "Award Amount", "Description", "Awarding Agency", "Start Date", "Award Type"],
        "sort": "Award Amount",
        "order": "desc",
        "limit": 25,
        "page": 1
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        data = r.json()
        results = data.get("results", [])
        contracts = []
        for item in results:
            contracts.append({
                "date": item.get("Start Date", ""),
                "agency": item.get("Awarding Agency", ""),
                "description": item.get("Description", "") or "N/A",
                "amount": item.get("Award Amount") or 0,
                "type": item.get("Award Type", "")
            })
        total = sum(c["amount"] for c in contracts)
        return {"contracts": contracts, "total": total, "company": company_name}
    except Exception as e:
        return {"contracts": [], "total": 0, "error": str(e)}


@app.get("/api/options/{ticker}")
async def get_options(ticker: str, expiry: str = None):
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(_fetch_options, ticker, expiry)

def _fetch_options(ticker: str, expiry: str = None):
    import yfinance as yf
    try:
        tk = yf.Ticker(ticker)
        expirations = tk.options
        if not expirations:
            return {"calls": [], "puts": [], "expirations": [], "put_call_ratio": None}
        target = expiry if expiry and expiry in expirations else expirations[0]
        chain = tk.option_chain(target)
        calls_df = chain.calls
        puts_df = chain.puts
        def df_to_list(df):
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "strike": float(row.get("strike", 0)),
                    "bid": float(row.get("bid", 0) or 0),
                    "ask": float(row.get("ask", 0) or 0),
                    "volume": int(row.get("volume", 0) or 0),
                    "openInterest": int(row.get("openInterest", 0) or 0),
                    "impliedVolatility": round(float(row.get("impliedVolatility", 0) or 0) * 100, 1),
                    "inTheMoney": bool(row.get("inTheMoney", False)),
                })
            return rows
        calls = df_to_list(calls_df)
        puts = df_to_list(puts_df)
        total_call_vol = sum(c["volume"] for c in calls)
        total_put_vol = sum(p["volume"] for p in puts)
        pcr = round(total_put_vol / total_call_vol, 2) if total_call_vol > 0 else None
        return {
            "calls": calls,
            "puts": puts,
            "expirations": list(expirations[:8]),
            "selected_expiry": target,
            "put_call_ratio": pcr,
            "total_call_volume": total_call_vol,
            "total_put_volume": total_put_vol,
        }
    except Exception as e:
        return {"calls": [], "puts": [], "expirations": [], "error": str(e)}


MARKET_INDEXES = [
    ("SPY",    "S&P 500"),
    ("^DJI",   "DOW"),
    ("^IXIC",  "NASDAQ"),
    ("^VIX",   "VIX"),
    ("QQQ",    "QQQ"),
    ("IWM",    "RUSSELL"),
    ("GLD",    "GOLD"),
    ("TLT",    "BONDS"),
    ("BTC-USD","BTC"),
    ("DX-Y.NYB","USD"),
]

@app.get("/api/market-indexes")
async def get_market_indexes():
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(_fetch_indexes)

def _fetch_indexes():
    import yfinance as yf
    results = []
    for symbol, label in MARKET_INDEXES:
        try:
            tk = yf.Ticker(symbol)
            info = tk.fast_info
            price = info.last_price
            prev  = info.previous_close
            if price and prev:
                change = price - prev
                change_pct = (change / prev) * 100
            else:
                change = change_pct = 0
            results.append({
                "symbol":     symbol,
                "label":      label,
                "price":      round(float(price), 2) if price else None,
                "change":     round(float(change), 2),
                "change_pct": round(float(change_pct), 2),
            })
        except Exception:
            pass
    return results


@app.get("/api/earnings-odds/{ticker}")
async def get_earnings_odds(ticker: str):
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(_fetch_earnings_odds, ticker)

def _fetch_earnings_odds(ticker: str):
    import requests, json, yfinance as yf

    name_words = []
    try:
        info = yf.Ticker(ticker).info
        company = info.get('shortName') or info.get('longName') or ticker
        # Shortened name variants for search
        name_words = [w for w in company.split() if len(w) > 2 and w.lower() not in ('inc.','inc','corp','corp.','ltd','llc','the','and')]
        short_name = name_words[0] if name_words else ticker
    except Exception:
        company = ticker
        short_name = ticker

    hdrs = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
    }

    results = []

    # ── POLYMARKET (Gamma API — no auth required) ──────────────────────────────
    def _parse_poly_price(prices_raw):
        try:
            prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw
            return round(float(prices[0]) * 100, 1) if prices else None
        except Exception:
            return None

    EARN_WORDS = ['earn', 'eps', 'revenue', 'quarterly', 'beat', 'miss', 'profit', 'results']
    COMPANY_WORDS = [ticker.lower(), short_name.lower()] + [w.lower() for w in name_words[:2]]

    searched = set()
    for term in [ticker, short_name, company[:20]]:
        if term in searched:
            continue
        searched.add(term)
        try:
            for offset in [0, 100, 200]:
                r = requests.get(
                    "https://gamma-api.polymarket.com/markets",
                    params={"limit": 100, "offset": offset},
                    headers=hdrs, timeout=10,
                )
                if r.status_code != 200:
                    break
                for m in r.json():
                    if not isinstance(m, dict):
                        continue
                    q = m.get('question', '') or ''
                    q_lower = q.lower()
                    # Must mention company/ticker AND an earnings keyword
                    if (any(cw in q_lower for cw in COMPANY_WORDS) and
                            any(ew in q_lower for ew in EARN_WORDS)):
                        slug = m.get('slug', '')
                        market_id = m.get('id', '')
                        if market_id in [r2.get('id') for r2 in results]:
                            continue
                        yes_prob = _parse_poly_price(m.get('outcomePrices'))
                        end_raw = m.get('endDate', '')
                        results.append({
                            'source': 'Polymarket',
                            'question': q,
                            'yes_prob': yes_prob,
                            'no_prob': round(100 - yes_prob, 1) if yes_prob is not None else None,
                            'volume': round(float(m.get('volume') or 0)),
                            'end_date': end_raw[:10] if end_raw else None,
                            'active': m.get('active', False),
                            'closed': m.get('closed', False),
                            'url': f"https://polymarket.com/event/{slug}",
                            'id': market_id,
                        })
        except Exception:
            pass

    # ── KALSHI (public trading API — requires auth, try gracefully) ───────────
    try:
        r_k = requests.get(
            "https://trading-api.kalshi.com/trade-api/v2/markets",
            params={"limit": 200, "status": "open"},
            headers={**hdrs, 'Authorization': ''},
            timeout=8,
        )
        if r_k.status_code == 200:
            for m in r_k.json().get('markets', []):
                title = (m.get('title') or '') + ' ' + (m.get('subtitle') or '')
                t_lower = title.lower()
                if (any(cw in t_lower for cw in COMPANY_WORDS) and
                        any(ew in t_lower for ew in EARN_WORDS)):
                    yes_bid = m.get('yes_bid', 0) or 0
                    yes_ask = m.get('yes_ask', 0) or 0
                    yes_prob = round((yes_bid + yes_ask) / 2 * 100, 1) if (yes_bid or yes_ask) else None
                    results.append({
                        'source': 'Kalshi',
                        'question': title.strip(),
                        'yes_prob': yes_prob,
                        'no_prob': round(100 - yes_prob, 1) if yes_prob is not None else None,
                        'volume': m.get('volume', 0),
                        'end_date': (m.get('close_time') or '')[:10] or None,
                        'active': True,
                        'closed': False,
                        'url': f"https://kalshi.com/markets/{m.get('ticker_name', '')}",
                        'id': m.get('id', ''),
                    })
    except Exception:
        pass

    # Sort: active markets first, then by volume desc
    results.sort(key=lambda x: (x.get('closed', True), -(x.get('volume') or 0)))

    return {
        'ticker': ticker,
        'company': company,
        'markets': results,
        'count': len(results),
    }


@app.get("/api/earnings-calendar/{ticker}")
async def get_earnings_calendar(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"earnings-calendar:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_earnings_calendar, t)
    _cache_set(f"earnings-calendar:{t}", result)
    return result

def _fetch_earnings_calendar(ticker: str):
    import yfinance as yf
    from datetime import datetime, timezone

    tk = yf.Ticker(ticker)

    # ── Next earnings + estimates ──────────────────────────────────────────────
    next_date = None
    eps_est = eps_low = eps_high = rev_est = rev_low = rev_high = None
    div_date = ex_div_date = None

    try:
        cal = tk.calendar
        dates = cal.get("Earnings Date", [])
        if dates:
            d = dates[0]
            next_date = d.isoformat() if hasattr(d, 'isoformat') else str(d)
        eps_est  = cal.get("Earnings Average")
        eps_low  = cal.get("Earnings Low")
        eps_high = cal.get("Earnings High")
        rev_est  = cal.get("Revenue Average")
        rev_low  = cal.get("Revenue Low")
        rev_high = cal.get("Revenue High")
        dd = cal.get("Dividend Date")
        if dd: div_date = dd.isoformat() if hasattr(dd, 'isoformat') else str(dd)
        xd = cal.get("Ex-Dividend Date")
        if xd: ex_div_date = xd.isoformat() if hasattr(xd, 'isoformat') else str(xd)
    except Exception:
        pass

    # Days until next earnings
    days_until = None
    if next_date:
        try:
            nd = datetime.fromisoformat(next_date)
            now = datetime.now()
            days_until = (nd.date() - now.date()).days
        except Exception:
            pass

    # ── Historical earnings (last 12 quarters) ────────────────────────────────
    history = []
    try:
        ed = tk.earnings_dates
        if ed is not None and not ed.empty:
            ed = ed.sort_index(ascending=False)
            for dt, row in ed.head(12).iterrows():
                eps_e = row.get("EPS Estimate")
                eps_r = row.get("Reported EPS")
                surp  = row.get("Surprise(%)")
                # Skip future (unreported) rows
                if eps_r is None or (hasattr(eps_r, '__class__') and str(eps_r) == 'nan'):
                    if len(history) == 0:
                        # This is the upcoming one — include as upcoming
                        history.append({
                            "date":         dt.strftime("%Y-%m-%d"),
                            "eps_estimate": float(eps_e) if eps_e and str(eps_e) != 'nan' else None,
                            "eps_reported": None,
                            "surprise_pct": None,
                            "beat":         None,
                            "upcoming":     True,
                        })
                    continue
                history.append({
                    "date":         dt.strftime("%Y-%m-%d"),
                    "eps_estimate": float(eps_e) if eps_e and str(eps_e) != 'nan' else None,
                    "eps_reported": float(eps_r) if eps_r and str(eps_r) != 'nan' else None,
                    "surprise_pct": float(surp)  if surp  and str(surp)  != 'nan' else None,
                    "beat":         bool(float(surp) >= 0) if surp and str(surp) != 'nan' else None,
                    "upcoming":     False,
                })
    except Exception:
        pass

    # Beat streak (consecutive beats from most recent)
    beat_streak = 0
    for h in history:
        if h.get("upcoming"):
            continue
        if h.get("beat") is True:
            beat_streak += 1
        else:
            break

    return {
        "ticker":       ticker,
        "next_date":    next_date,
        "days_until":   days_until,
        "eps_estimate": round(float(eps_est), 4)  if eps_est  else None,
        "eps_low":      round(float(eps_low), 4)  if eps_low  else None,
        "eps_high":     round(float(eps_high), 4) if eps_high else None,
        "rev_estimate": int(rev_est)  if rev_est  else None,
        "rev_low":      int(rev_low)  if rev_low  else None,
        "rev_high":     int(rev_high) if rev_high else None,
        "div_date":     div_date,
        "ex_div_date":  ex_div_date,
        "history":      history,
        "beat_streak":  beat_streak,
    }

# ─────────────────────────────────────────────────────────────────
# Market-wide Earnings Week Calendar
# ─────────────────────────────────────────────────────────────────

MARKET_TICKERS = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","JPM","V",
    "UNH","XOM","LLY","JNJ","WMT","MA","PG","AVGO","HD","CVX",
    "MRK","PEP","KO","ABBV","COST","AMD","NFLX","CRM","ORCL","BAC",
    "TMO","ACN","MCD","LIN","CSCO","ABT","TXN","DHR","ADBE","WFC",
    "NEE","NKE","PM","RTX","INTU","AMGN","UPS","SBUX","IBM","QCOM",
    "GE","GS","LOW","ELV","MS","SPGI","CAT","BLK","MDT","PLD",
    "INTC","GILD","MMM","REGN","ZTS","SYK","ISRG","MU","PANW","KLAC",
    "LRCX","SNPS","CDNS","ADI","MRVL","ON","AMAT","ASML","TSM","SHOP",
    "SQ","PYPL","UBER","LYFT","ABNB","DASH","RBLX","COIN","HOOD","PLTR",
    "SOFI","RIVN","LCID","NIO","F","GM","BA","LMT","GD","NOC",
    "DE","CAT","ETN","EMR","HON","ITW","ROK","DOV","PH","IR",
    "DIS","PARA","NFLX","WBD","FOXA","CMCSA","T","VZ","TMUS",
    "PFE","MRNA","BIIB","VRTX","ILMN","IQV","CVS","CI","HUM","MCK",
]

@app.get("/api/earnings-week")
async def get_earnings_week(weeks: int = 4):
    cached = _cache_get(f"earnings-week:{weeks}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_earnings_week, weeks)
    # Only cache if we got actual data
    if result.get("grouped"):
        _cache_set(f"earnings-week:{weeks}", result)
    return result

def _fetch_earnings_week(weeks: int = 4):
    import yfinance as yf
    from datetime import datetime, timedelta
    from concurrent.futures import ThreadPoolExecutor, as_completed

    today = datetime.now().date()
    # Start from most recent Monday
    start = today - timedelta(days=today.weekday())
    end   = start + timedelta(weeks=weeks)

    seen = set()
    tickers = [t for t in MARKET_TICKERS if t not in seen and not seen.add(t)]

    def fetch_one(ticker):
        try:
            tk = yf.Ticker(ticker)
            try:
                name = tk.info.get("shortName") or tk.info.get("longName") or ticker
            except Exception:
                name = ticker
            cal = tk.calendar
            dates = cal.get("Earnings Date", [])
            if not dates:
                return None
            d = dates[0]
            import datetime as _dt
            if isinstance(d, _dt.datetime):
                date_obj = d.date()
            elif isinstance(d, _dt.date):
                date_obj = d
            elif callable(getattr(d, 'date', None)):
                date_obj = d.date()
            else:
                date_obj = None
            if date_obj is None:
                return None
            if date_obj < start or date_obj > end:
                return None
            eps_est = cal.get("Earnings Average")
            return {
                "ticker": ticker,
                "company": name,
                "date": date_obj.isoformat(),
                "eps_estimate": round(float(eps_est), 2) if eps_est else None,
            }
        except Exception:
            return None

    results = []
    # Process in small batches with a pause to avoid Yahoo rate limits
    batch_size = 10
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        with ThreadPoolExecutor(max_workers=5) as ex:
            for r in ex.map(fetch_one, batch):
                if r:
                    results.append(r)
        if i + batch_size < len(tickers):
            time.sleep(1)

    # Group by date
    grouped = {}
    for r in results:
        grouped.setdefault(r["date"], []).append(r)
    for date in grouped:
        grouped[date].sort(key=lambda x: x["ticker"])

    return {
        "start": start.isoformat(),
        "end":   end.isoformat(),
        "weeks": weeks,
        "grouped": grouped,
    }


# ─────────────────────────────────────────────────────────────────
# 10-K Accounting Flags
# ─────────────────────────────────────────────────────────────────

@app.get("/api/accounting-flags/{ticker}")
async def get_accounting_flags(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"acct_flags:{t}")
    if cached:
        return cached
    return await run_in_threadpool(_fetch_accounting_flags, t)

def _fetch_accounting_flags(ticker: str):
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from data.edgar import get_latest_10k_text
    from data.accounting_scanner import scan_accounting_flags

    text = get_latest_10k_text(ticker)
    if not text:
        return {"ticker": ticker, "findings": [], "summary": {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "total": 0}, "error": "No 10-K filing found"}

    findings = scan_accounting_flags(text)
    summary = {
        "HIGH":   sum(1 for f in findings if f["severity"] == "HIGH"),
        "MEDIUM": sum(1 for f in findings if f["severity"] == "MEDIUM"),
        "LOW":    sum(1 for f in findings if f["severity"] == "LOW"),
        "total":  len(findings),
    }
    result = {
        "ticker":         ticker,
        "findings":       findings,
        "summary":        summary,
        "filing_length":  len(text),
    }
    _cache_set(f"acct_flags:{ticker}", result)
    return result


# ─────────────────────────────────────────────────────────────────
# AI Market Simulation (Ollama / llama3.2:3b)
# ─────────────────────────────────────────────────────────────────

@app.get("/api/simulate/{ticker}")
async def simulate_market(ticker: str):
    import json as _json
    import sys as _sys, os as _os
    _sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), '..'))
    from data.simulation import run_simulation

    t = ticker.upper()

    # Reuse cached stock data if available
    stock = _cache_get(f"stock:{t}") or {}

    # Grab up to 3 news headlines
    headlines = []
    try:
        news_items = _parse_feed(
            f"https://finance.yahoo.com/rss/headline?s={t}", 5
        )
        headlines = [n["title"] for n in news_items[:3]]
    except Exception:
        pass

    def event_stream():
        try:
            for event in run_simulation(t, stock, headlines):
                yield f"data: {_json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────────
# Congressional Trading
# ─────────────────────────────────────────────────────────────────

@app.get("/api/congress/{ticker}")
async def get_congress_trades(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"congress:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_congress_trades, t)
    if result.get("trades"):
        _cache_set(f"congress:{t}", result)
    return result

def _parse_congress_politician(text: str):
    """Parse 'Julia Letlow Republican House LA' into parts."""
    import re as _re
    for party_word, party_code in [("Republican", "R"), ("Democrat", "D"), ("Independent", "I")]:
        if party_word in text:
            parts = text.split(party_word, 1)
            name = parts[0].strip()
            rest = parts[1].strip().split()
            chamber = rest[0].lower() if rest else ""
            state = rest[1] if len(rest) > 1 else ""
            return name, party_code, chamber, state
    return text.strip(), "", "", ""


def _parse_congress_table(soup, ticker: str, include_asset_col: bool = True):
    """Parse a Capitol Trades HTML table into trade dicts."""
    import re as _re
    table = soup.find("table")
    if not table:
        return []
    trades = []
    for row in table.find_all("tr")[1:]:
        cells = [td.get_text(separator=" ", strip=True) for td in row.find_all("td")]
        if len(cells) < 5:
            continue
        if include_asset_col:
            # Columns: Politician | Issued | Published | Traded | Filed | Owner | Type | Size | Price
            pol, asset_text = cells[0], cells[1]
            published, tx_date = cells[2], cells[3]
            tx_type = cells[6].strip().lower() if len(cells) > 6 else ""
            amount   = cells[7].strip()          if len(cells) > 7 else ""
            price    = cells[8].strip()          if len(cells) > 8 else ""
            company  = _re.sub(r'\s*[A-Z]{1,5}:\w+.*$', '', asset_text).strip()
        else:
            # Issuer page: Politician | Published | Traded | Filed | Type | Size
            pol = cells[0]
            asset_text = ticker
            published, tx_date = cells[1], cells[2]
            tx_type = cells[4].strip().lower() if len(cells) > 4 else ""
            amount   = cells[5].strip()          if len(cells) > 5 else ""
            price    = ""
            company  = ticker

        name, party, chamber, state = _parse_congress_politician(pol)
        trades.append({
            "chamber":    chamber,
            "name":       name,
            "party":      party,
            "state":      state,
            "tx_date":    tx_date.strip(),
            "disclosure": published.strip(),
            "tx_type":    tx_type,
            "amount":     amount,
            "price":      price,
            "asset":      company or ticker,
        })
    return trades


def _fetch_congress_trades(ticker: str):
    """Scrape Capitol Trades for congressional trading data."""
    import requests as _req
    import re as _re
    try:
        from bs4 import BeautifulSoup as _BS
    except ImportError:
        return {"ticker": ticker, "trades": [], "error": "beautifulsoup4 not installed"}

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

    # Step 1: find the issuer page ID from the trades index
    try:
        r = _req.get(
            f"https://www.capitoltrades.com/trades?assetTicker={ticker}&pageSize=96",
            timeout=20, headers=headers
        )
        r.raise_for_status()
        soup = _BS(r.text, "html.parser")
        # Find the issuer link for this ticker  e.g. /issuers/429789
        issuer_id = None
        for a in soup.find_all("a", href=_re.compile(r"/issuers/\d+")):
            # The link text or nearby text should contain the ticker
            row = a.find_parent("tr")
            if row and ticker in row.get_text():
                m = _re.search(r"/issuers/(\d+)", a["href"])
                if m:
                    issuer_id = m.group(1)
                    break
    except Exception as e:
        return {"ticker": ticker, "trades": [], "error": str(e)}

    if not issuer_id:
        return {"ticker": ticker, "trades": []}

    # Step 2: fetch issuer-specific page which lists only this stock's trades
    try:
        r2 = _req.get(
            f"https://www.capitoltrades.com/issuers/{issuer_id}",
            timeout=20, headers=headers
        )
        r2.raise_for_status()
        soup2 = _BS(r2.text, "html.parser")
        trades = _parse_congress_table(soup2, ticker, include_asset_col=False)
    except Exception as e:
        return {"ticker": ticker, "trades": [], "error": str(e)}

    return {"ticker": ticker, "trades": trades}


# ─────────────────────────────────────────────────────────────────
# Short Interest
# ─────────────────────────────────────────────────────────────────

@app.get("/api/short-interest/{ticker}")
async def get_short_interest(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"short:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_short_interest, t)
    _cache_set(f"short:{t}", result)
    return result

def _fetch_short_interest(ticker: str):
    import yfinance as yf
    try:
        info = yf.Ticker(ticker).info
        shares_short       = info.get("sharesShort")
        shares_outstanding = info.get("sharesOutstanding")
        short_ratio        = info.get("shortRatio")
        short_pct_float    = info.get("shortPercentOfFloat")
        shares_short_prior = info.get("sharesShortPriorMonth")
        float_shares       = info.get("floatShares")

        change_pct = None
        if shares_short and shares_short_prior and shares_short_prior > 0:
            change_pct = round((shares_short - shares_short_prior) / shares_short_prior * 100, 2)

        return {
            "ticker":                 ticker,
            "shares_short":           shares_short,
            "shares_short_prior":     shares_short_prior,
            "short_ratio":            round(float(short_ratio), 2) if short_ratio else None,
            "short_pct_float":        round(float(short_pct_float) * 100, 2) if short_pct_float else None,
            "float_shares":           float_shares,
            "shares_outstanding":     shares_outstanding,
            "short_change_pct":       change_pct,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Unusual Options Activity
# ─────────────────────────────────────────────────────────────────

@app.get("/api/unusual-options/{ticker}")
async def get_unusual_options(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"unusual_opts:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_unusual_options, t)
    if result.get("unusual"):
        _cache_set(f"unusual_opts:{t}", result)
    return result

def _fetch_unusual_options(ticker: str):
    import yfinance as yf
    try:
        tk = yf.Ticker(ticker)
        expirations = tk.options[:6]
        unusual = []
        for exp in expirations:
            try:
                chain = tk.option_chain(exp)
                for opt_type, df in [("call", chain.calls), ("put", chain.puts)]:
                    for _, row in df.iterrows():
                        vol = row.get("volume") or 0
                        oi  = row.get("openInterest") or 0
                        if vol <= 0:
                            continue
                        is_unusual = (oi > 0 and vol > oi * 3) or (vol > 500 and oi > 0 and vol / oi > 1.5)
                        if not is_unusual:
                            continue
                        unusual.append({
                            "expiry":      exp,
                            "type":        opt_type,
                            "strike":      float(row.get("strike", 0)),
                            "last_price":  float(row.get("lastPrice", 0)),
                            "volume":      int(vol),
                            "open_interest": int(oi),
                            "vol_oi_ratio": round(vol / oi, 2) if oi > 0 else None,
                            "implied_vol": round(float(row.get("impliedVolatility", 0)) * 100, 1),
                            "in_the_money": bool(row.get("inTheMoney", False)),
                        })
            except Exception:
                continue
        unusual.sort(key=lambda x: x["volume"], reverse=True)
        return {"ticker": ticker, "unusual": unusual[:50]}
    except Exception as e:
        return {"ticker": ticker, "unusual": [], "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Analyst Ratings
# ─────────────────────────────────────────────────────────────────

@app.get("/api/analyst/{ticker}")
async def get_analyst_ratings(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"analyst:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_analyst, t)
    if not result.get("error"):
        _cache_set(f"analyst:{t}", result)
    return result

def _fetch_analyst(ticker: str):
    import yfinance as yf
    try:
        tk = yf.Ticker(ticker)
        info = tk.info

        # Consensus counts from info
        buy_count  = info.get("numberOfAnalystOpinions") or 0
        mean_target = info.get("targetMeanPrice")
        high_target = info.get("targetHighPrice")
        low_target  = info.get("targetLowPrice")
        rec_mean    = info.get("recommendationMean")  # 1=Strong Buy .. 5=Sell

        # Derive consensus label
        if rec_mean is None:
            consensus = "N/A"
        elif rec_mean <= 1.5:
            consensus = "STRONG BUY"
        elif rec_mean <= 2.5:
            consensus = "BUY"
        elif rec_mean <= 3.5:
            consensus = "HOLD"
        elif rec_mean <= 4.5:
            consensus = "SELL"
        else:
            consensus = "STRONG SELL"

        # Recent upgrades/downgrades
        upgrades = []
        try:
            recs = tk.upgrades_downgrades
            if recs is not None and not recs.empty:
                recs = recs.reset_index()
                for _, row in recs.head(20).iterrows():
                    upgrades.append({
                        "date":     str(row.get("GradeDate", ""))[:10],
                        "firm":     str(row.get("Firm", "")),
                        "from":     str(row.get("FromGrade", "")),
                        "to":       str(row.get("ToGrade", "")),
                        "action":   str(row.get("Action", "")),
                    })
        except Exception:
            pass

        return {
            "ticker":       ticker,
            "consensus":    consensus,
            "rec_mean":     round(float(rec_mean), 2) if rec_mean else None,
            "buy_count":    buy_count,
            "mean_target":  round(float(mean_target), 2) if mean_target else None,
            "high_target":  round(float(high_target), 2) if high_target else None,
            "low_target":   round(float(low_target), 2) if low_target else None,
            "upgrades":     upgrades,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Institutional Holdings
# ─────────────────────────────────────────────────────────────────

@app.get("/api/institutions/{ticker}")
async def get_institutions(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"institutions:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_institutions, t)
    if not result.get("error"):
        _cache_set(f"institutions:{t}", result)
    return result

def _fetch_institutions(ticker: str):
    import yfinance as yf
    try:
        tk = yf.Ticker(ticker)
        info = tk.info
        total_pct = info.get("heldPercentInstitutions")

        inst = []
        try:
            df = tk.institutional_holders
            if df is not None and not df.empty:
                for _, row in df.head(15).iterrows():
                    shares = row.get("Shares") or row.get("Value")
                    pct    = row.get("% Out") or row.get("pctHeld")
                    inst.append({
                        "holder":  str(row.get("Holder", "")),
                        "shares":  int(shares) if shares and str(shares) != "nan" else None,
                        "pct_out": round(float(pct) * 100, 2) if pct and str(pct) != "nan" else None,
                        "date":    str(row.get("Date Reported", ""))[:10],
                    })
        except Exception:
            pass

        mf = []
        try:
            df2 = tk.mutualfund_holders
            if df2 is not None and not df2.empty:
                for _, row in df2.head(10).iterrows():
                    shares = row.get("Shares") or row.get("Value")
                    pct    = row.get("% Out") or row.get("pctHeld")
                    mf.append({
                        "holder":  str(row.get("Holder", "")),
                        "shares":  int(shares) if shares and str(shares) != "nan" else None,
                        "pct_out": round(float(pct) * 100, 2) if pct and str(pct) != "nan" else None,
                        "date":    str(row.get("Date Reported", ""))[:10],
                    })
        except Exception:
            pass

        return {
            "ticker":           ticker,
            "total_inst_pct":   round(float(total_pct) * 100, 2) if total_pct else None,
            "institutional":    inst,
            "mutual_funds":     mf,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Dividend History
# ─────────────────────────────────────────────────────────────────

@app.get("/api/dividends/{ticker}")
async def get_dividends(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"dividends:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_dividends, t)
    _cache_set(f"dividends:{t}", result)
    return result

def _fetch_dividends(ticker: str):
    import yfinance as yf
    try:
        tk = yf.Ticker(ticker)
        info = tk.info

        div_yield    = info.get("dividendYield")
        payout_ratio = info.get("payoutRatio")
        annual_div   = info.get("dividendRate")
        ex_div_date  = info.get("exDividendDate")

        history = []
        try:
            divs = tk.dividends
            if divs is not None and not divs.empty:
                for date, amount in divs.iloc[-40:].items():
                    history.append({
                        "date":   str(date)[:10],
                        "amount": round(float(amount), 4),
                    })
                history.reverse()
        except Exception:
            pass

        # 5-year growth
        growth_5y = None
        try:
            if len(history) >= 2:
                recent = history[0]["amount"]
                old    = history[min(19, len(history)-1)]["amount"]
                if old > 0:
                    growth_5y = round((recent / old - 1) * 100, 2)
        except Exception:
            pass

        return {
            "ticker":       ticker,
            "yield":        round(float(div_yield) * 100, 2)  if div_yield     else None,
            "payout_ratio": round(float(payout_ratio) * 100, 2) if payout_ratio else None,
            "annual_div":   round(float(annual_div), 4)        if annual_div   else None,
            "ex_div_date":  str(ex_div_date)[:10]              if ex_div_date  else None,
            "growth_approx": growth_5y,
            "history":      history,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "history": []}


# ─────────────────────────────────────────────────────────────────
# Peer Comparison
# ─────────────────────────────────────────────────────────────────

PEER_MAP = {
    "Semiconductors":                  ["NVDA","AMD","INTC","QCOM","AVGO","MU","KLAC","LRCX","AMAT","MRVL"],
    "Software—Application":            ["MSFT","ADBE","CRM","NOW","INTU","WDAY","TEAM","SNOW","DDOG","MDB"],
    "Software—Infrastructure":         ["MSFT","ORCL","CSCO","PANW","FTNT","ZS","CRWD","NET","OKTA","CYBR"],
    "Internet Content & Information":  ["GOOGL","META","SNAP","PINS","TWTR","RDDT","YELP"],
    "Consumer Electronics":            ["AAPL","SONO","GPRO","HEAR"],
    "Internet Retail":                 ["AMZN","EBAY","ETSY","SHOP","W","CHWY","WISH"],
    "Specialty Retail":                ["AMZN","WMT","TGT","COST","HD","LOW","BBY"],
    "Auto Manufacturers":              ["TSLA","F","GM","RIVN","LCID","NIO","TM","STLA","HMC"],
    "Oil & Gas Integrated":            ["XOM","CVX","BP","SHEL","TTE","COP"],
    "Oil & Gas E&P":                   ["COP","PXD","DVN","EOG","OXY","FANG","MRO"],
    "Biotechnology":                   ["MRNA","BIIB","REGN","VRTX","GILD","BMRN","ALNY","RARE"],
    "Drug Manufacturers—General":      ["LLY","PFE","JNJ","ABBV","MRK","BMY","AZN","RHHBY","NVS","SNY"],
    "Diversified Banks":               ["JPM","BAC","WFC","C","USB","TFC","PNC"],
    "Credit Services":                 ["V","MA","AXP","DFS","COF","SYF","ALLY"],
    "Asset Management":                ["BLK","SCHW","MS","GS","BAC","JPM"],
    "Insurance":                       ["BRK-B","MET","PRU","AFL","AIG","TRV","AJG"],
    "Aerospace & Defense":             ["LMT","RTX","BA","GD","NOC","L3H","HII"],
    "Medical Devices":                 ["ABT","MDT","SYK","BSX","EW","ISRG","ZBH","TFX"],
    "Healthcare Plans":                ["UNH","CVS","CI","ELV","HUM","MOH","CNC"],
    "Utilities—Regulated Electric":    ["NEE","DUK","SO","AEP","EXC","XEL","D"],
    "Telecom Services":                ["T","VZ","TMUS","LUMN","DISH"],
    "Entertainment":                   ["DIS","NFLX","WBD","PARA","FOXA","LGF-A"],
    "Restaurants":                     ["MCD","SBUX","CMG","YUM","QSR","DPZ","DNUT"],
    "Airlines":                        ["DAL","UAL","AAL","LUV","JBLU","ALK","SAVE"],
    "REITs":                           ["PLD","AMT","CCI","EQIX","O","SPG","AVB"],
}

@app.get("/api/peers/{ticker}")
async def get_peers(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"peers:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_peers, t)
    if result.get("peers"):
        _cache_set(f"peers:{t}", result)
    return result

def _fetch_peers(ticker: str):
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor
    try:
        tk = yf.Ticker(ticker)
        industry = tk.info.get("industry", "")
        peers_raw = PEER_MAP.get(industry, [])
        # Pick up to 5 peers (exclude self)
        peers_list = [p for p in peers_raw if p != ticker][:5]

        def fetch_peer(sym):
            try:
                i = yf.Ticker(sym).info
                rev = i.get("totalRevenue")
                rev_growth = i.get("revenueGrowth")
                return {
                    "ticker":       sym,
                    "name":         i.get("shortName", sym),
                    "price":        round(float(i.get("currentPrice") or i.get("regularMarketPrice") or 0), 2),
                    "pe":           round(float(i.get("trailingPE") or 0), 1) or None,
                    "fwd_pe":       round(float(i.get("forwardPE") or 0), 1) or None,
                    "ev_ebitda":    round(float(i.get("enterpriseToEbitda") or 0), 1) or None,
                    "rev_growth":   round(float(rev_growth) * 100, 1) if rev_growth else None,
                    "gross_margin": round(float(i.get("grossMargins") or 0) * 100, 1) or None,
                    "net_margin":   round(float(i.get("profitMargins") or 0) * 100, 1) or None,
                    "market_cap":   i.get("marketCap"),
                }
            except Exception:
                return None

        # Include self as first row
        self_data = fetch_peer(ticker)
        peer_data = []
        with ThreadPoolExecutor(max_workers=5) as ex:
            for r in ex.map(fetch_peer, peers_list):
                if r:
                    peer_data.append(r)

        rows = ([self_data] if self_data else []) + peer_data
        return {"ticker": ticker, "industry": industry, "peers": rows}
    except Exception as e:
        return {"ticker": ticker, "peers": [], "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Short Squeeze Score
# ─────────────────────────────────────────────────────────────────

@app.get("/api/squeeze/{ticker}")
async def get_squeeze(ticker: str):
    t = ticker.upper()
    cached = _cache_get(f"squeeze:{t}")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_squeeze, t)
    _cache_set(f"squeeze:{t}", result)
    return result

def _fetch_squeeze(ticker: str):
    import yfinance as yf
    try:
        info = yf.Ticker(ticker).info
        short_pct   = info.get("shortPercentOfFloat") or 0
        short_ratio = info.get("shortRatio") or 0   # days to cover
        float_sh    = info.get("floatShares") or 1e9

        # Normalize each component 0-1
        # short_pct: 0%=0, 30%+=1
        c1 = min(float(short_pct) / 0.30, 1.0)
        # days to cover: 0=0, 10+=1
        c2 = min(float(short_ratio) / 10.0, 1.0)
        # float size: smaller float = higher squeeze potential; 1B+ = 0, 10M = 1
        float_B = float(float_sh) / 1e9
        c3 = max(0, 1.0 - float_B / 1.0) if float_B < 1.0 else 0

        score = round((c1 * 0.40 + c2 * 0.35 + c3 * 0.25) * 100)

        return {
            "ticker":          ticker,
            "score":           score,
            "short_pct_float": round(float(short_pct) * 100, 2) if short_pct else None,
            "days_to_cover":   round(float(short_ratio), 2) if short_ratio else None,
            "float_shares":    float_sh,
            "components": {
                "short_pct_score":   round(c1 * 100),
                "days_cover_score":  round(c2 * 100),
                "float_score":       round(c3 * 100),
            }
        }
    except Exception as e:
        return {"ticker": ticker, "score": 0, "error": str(e)}


# ─────────────────────────────────────────────────────────────────
# Market Pulse — Sector Heatmap + VIX / Fear & Greed
# ─────────────────────────────────────────────────────────────────

SECTOR_ETFS = [
    ("XLK",  "Technology"),
    ("XLF",  "Financials"),
    ("XLV",  "Health Care"),
    ("XLY",  "Cons. Discret."),
    ("XLP",  "Cons. Staples"),
    ("XLE",  "Energy"),
    ("XLI",  "Industrials"),
    ("XLB",  "Materials"),
    ("XLRE", "Real Estate"),
    ("XLC",  "Comm. Services"),
    ("XLU",  "Utilities"),
]

@app.get("/api/market-pulse")
async def get_market_pulse():
    cached = _cache_get("market-pulse")
    if cached:
        return cached
    result = await run_in_threadpool(_fetch_market_pulse)
    if result.get("sectors"):
        _cache_set("market-pulse", result)
    return result

def _fetch_market_pulse():
    import yfinance as yf
    symbols = [s for s, _ in SECTOR_ETFS] + ["^VIX"]
    try:
        data = yf.download(symbols, period="2d", progress=False, auto_adjust=True)
        closes = data["Close"] if "Close" in data.columns else data
    except Exception as e:
        return {"sectors": [], "vix": None, "fear_greed_score": None, "error": str(e)}

    sectors = []
    for sym, name in SECTOR_ETFS:
        try:
            col = closes[sym]
            prev, last = float(col.iloc[-2]), float(col.iloc[-1])
            pct = round((last - prev) / prev * 100, 2) if prev else 0
            sectors.append({"symbol": sym, "name": name, "pct_change": pct, "price": round(last, 2)})
        except Exception:
            sectors.append({"symbol": sym, "name": name, "pct_change": 0, "price": None})

    vix = None
    try:
        col = closes["^VIX"]
        vix = round(float(col.iloc[-1]), 2)
    except Exception:
        pass

    # Fear & Greed: VIX 12=100 (extreme greed), VIX 45=1 (extreme fear), linear
    fear_greed = None
    if vix is not None:
        fear_greed = max(0, min(100, round(100 - (vix - 12) * 2.7)))

    return {"sectors": sectors, "vix": vix, "fear_greed_score": fear_greed}


# ─────────────────────────────────────────────────────────────────
# Economic Calendar (hardcoded FOMC/CPI/NFP/GDP dates)
# ─────────────────────────────────────────────────────────────────

ECONOMIC_EVENTS = [
    # FOMC 2025 (remaining)
    {"date": "2025-03-19", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "4.25-4.50%", "forecast": "4.25-4.50%"},
    {"date": "2025-05-07", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "4.25-4.50%", "forecast": "4.25-4.50%"},
    {"date": "2025-06-18", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "4.25-4.50%", "forecast": ""},
    {"date": "2025-07-30", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-09-17", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-10-29", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-12-10", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    # FOMC 2026
    {"date": "2026-01-28", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-03-18", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-04-29", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-06-17", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-07-29", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-09-16", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-11-04", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-12-16", "event": "FOMC Rate Decision", "importance": "HIGH", "previous": "", "forecast": ""},
    # CPI 2025-2026 (approx 2nd Wed each month)
    {"date": "2025-04-10", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-05-13", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-06-11", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-07-11", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-08-13", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-09-10", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-10-15", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-11-12", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-12-10", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-01-14", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-02-11", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-03-11", "event": "CPI (Inflation)", "importance": "HIGH", "previous": "", "forecast": ""},
    # NFP (Non-Farm Payrolls) — first Friday of each month
    {"date": "2025-04-04", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-05-02", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-06-06", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-07-03", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-08-01", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-09-05", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-10-03", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-11-07", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-12-05", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-01-09", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-02-06", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-03-06", "event": "Non-Farm Payrolls", "importance": "HIGH", "previous": "", "forecast": ""},
    # GDP (advance estimate — last week of Jan, Apr, Jul, Oct)
    {"date": "2025-04-30", "event": "GDP (Advance)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-07-30", "event": "GDP (Advance)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-10-29", "event": "GDP (Advance)", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-01-28", "event": "GDP (Advance)", "importance": "HIGH", "previous": "", "forecast": ""},
    # PCE (Fed's preferred inflation gauge — last business day of each month)
    {"date": "2025-03-28", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-04-30", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-05-30", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-06-27", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-07-31", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-08-29", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-09-26", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-10-31", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-11-26", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2025-12-19", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-01-30", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-02-27", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
    {"date": "2026-03-27", "event": "PCE Price Index", "importance": "HIGH", "previous": "", "forecast": ""},
]

@app.get("/api/economic-calendar")
async def get_economic_calendar():
    from datetime import date as _date
    today = _date.today().isoformat()
    # Return only upcoming events
    upcoming = [e for e in ECONOMIC_EVENTS if e["date"] >= today]
    upcoming.sort(key=lambda x: x["date"])
    return {"events": upcoming}
