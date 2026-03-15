import yfinance as yf


def get_stock_info(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

        change = 0.0
        change_percent = 0.0
        if price and prev_close and prev_close != 0:
            change = price - prev_close
            change_percent = (change / prev_close) * 100

        return {
            "name":              info.get("longName") or info.get("shortName") or ticker.upper(),
            "price":             price,
            "change":            round(change, 4),
            "change_percent":    round(change_percent, 4),
            "market_cap":        info.get("marketCap"),
            "volume":            info.get("volume") or info.get("regularMarketVolume"),
            "avg_volume":        info.get("averageVolume"),
            "pe_ratio":          info.get("trailingPE"),
            "forward_pe":        info.get("forwardPE"),
            "week52_high":       info.get("fiftyTwoWeekHigh"),
            "week52_low":        info.get("fiftyTwoWeekLow"),
            "sector":            info.get("sector"),
            "industry":          info.get("industry"),
            "description":       info.get("longBusinessSummary"),
            "revenue":           info.get("totalRevenue"),
            "gross_profit":      info.get("grossProfits"),
            "net_income":        info.get("netIncomeToCommon"),
            "eps":               info.get("trailingEps"),
            "forward_eps":       info.get("forwardEps"),
            "dividend_yield":    info.get("trailingAnnualDividendYield"),
            "beta":              info.get("beta"),
            "gross_margin":      info.get("grossMargins"),
            "profit_margin":     info.get("profitMargins"),
            "operating_margin":  info.get("operatingMargins"),
            "roe":               info.get("returnOnEquity"),
            "roa":               info.get("returnOnAssets"),
            "debt_to_equity":    info.get("debtToEquity"),
            "free_cash_flow":    info.get("freeCashflow"),
            "operating_cash":    info.get("operatingCashflow"),
            "shares_outstanding":info.get("sharesOutstanding"),
            "float_shares":      info.get("floatShares"),
            "short_ratio":       info.get("shortRatio"),
            "price_to_book":     info.get("priceToBook"),
            "employees":         info.get("fullTimeEmployees"),
            "country":           info.get("country"),
            "website":           info.get("website"),
            "exchange":          info.get("exchange"),
        }
    except Exception as e:
        return {"error": str(e), "name": ticker.upper()}
