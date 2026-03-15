"""
Financials panel — revenue, gross profit, net income, EPS, etc.
Exposes build_financials_markup() used by app._update_ui().
"""
from __future__ import annotations


def build_financials_markup(stock_info: dict) -> str:
    """Return Rich-markup text for the KEY FINANCIALS section."""
    revenue = stock_info.get("revenue", "N/A")
    gross_profit = stock_info.get("gross_profit", "N/A")
    net_income = stock_info.get("net_income", "N/A")
    eps = stock_info.get("eps")
    eps_str = f"${eps:.2f}" if eps is not None else "N/A"
    dividend_yield = stock_info.get("dividend_yield", "N/A")
    beta = stock_info.get("beta", "N/A")
    avg_volume = stock_info.get("avg_volume", "N/A")
    shares_outstanding = stock_info.get("shares_outstanding", "N/A")

    return (
        f"\n[bold #ffb300]━━━ KEY FINANCIALS ━━━[/bold #ffb300]\n\n"
        f"[#ffb300]Revenue          [/] [white]{revenue}[/white]\n"
        f"[#ffb300]Gross Profit     [/] [white]{gross_profit}[/white]\n"
        f"[#ffb300]Net Income       [/] [white]{net_income}[/white]\n"
        f"[#ffb300]EPS              [/] [white]{eps_str}[/white]\n"
        f"[#ffb300]Dividend Yield   [/] [white]{dividend_yield}[/white]\n"
        f"[#ffb300]Beta             [/] [white]{beta}[/white]\n"
        f"[#ffb300]Avg Volume       [/] [white]{avg_volume}[/white]\n"
        f"[#ffb300]Shares Out.      [/] [white]{shares_outstanding}[/white]\n"
    )
