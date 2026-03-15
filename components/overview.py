"""
Overview panel — left-hand price / metadata block.
Renders a Rich-markup string produced by app._update_ui() into a
ScrollableContainer that already exists in the DOM.  This module also
exposes a standalone helper so callers can build the markup string
without coupling to the widget tree.
"""
from __future__ import annotations


def build_overview_markup(ticker: str, stock_info: dict) -> str:
    """Return Rich-markup text for the OVERVIEW section."""
    name = stock_info.get("name", ticker)
    price = stock_info.get("price")
    change_pct = stock_info.get("change_pct", 0.0)
    market_cap = stock_info.get("market_cap", "N/A")
    volume = stock_info.get("volume", "N/A")
    pe_ratio = stock_info.get("pe_ratio", "N/A")
    high_52w = stock_info.get("52w_high")
    low_52w = stock_info.get("52w_low")
    sector = stock_info.get("sector", "N/A")
    industry = stock_info.get("industry", "N/A")

    price_str = f"${price:.2f}" if price is not None else "N/A"

    if change_pct > 0:
        change_color = "#00ff88"
        change_arrow = "▲"
    elif change_pct < 0:
        change_color = "#ff4444"
        change_arrow = "▼"
    else:
        change_color = "#888888"
        change_arrow = "■"

    range_str = "N/A"
    if high_52w is not None and low_52w is not None:
        range_str = f"${low_52w:.2f} — ${high_52w:.2f}"

    return (
        f"[bold #ffb300]━━━ OVERVIEW ━━━[/bold #ffb300]\n\n"
        f"[bold white]{name}[/bold white]  [dim]({ticker})[/dim]\n\n"
        f"[#ffb300]Price        [/] [bold white]{price_str}[/bold white]  "
        f"[bold {change_color}]{change_arrow} {change_pct:+.2f}%[/bold {change_color}]\n"
        f"[#ffb300]Market Cap   [/] [white]{market_cap}[/white]\n"
        f"[#ffb300]Volume       [/] [white]{volume}[/white]\n"
        f"[#ffb300]P/E Ratio    [/] [white]{pe_ratio}[/white]\n"
        f"[#ffb300]52W Range    [/] [white]{range_str}[/white]\n"
        f"[#ffb300]Sector       [/] [white]{sector}[/white]\n"
        f"[#ffb300]Industry     [/] [white]{industry}[/white]\n"
    )
