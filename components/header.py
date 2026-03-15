"""
Header component — top bar containing the app title, ticker search input,
and a live status label.  Imported and used by app.py via compose().
"""
from textual.app import ComposeResult
from textual.containers import Container
from textual.widgets import Input, Static


class AppHeader(Container):
    """Amber Bloomberg-style header bar."""

    DEFAULT_CSS = """
    AppHeader {
        layout: horizontal;
        background: #111111;
        padding: 1;
        height: 5;
        align: left middle;
    }
    AppHeader #app-title {
        color: #ffb300;
        text-style: bold;
        width: 30;
        content-align: left middle;
        padding: 0 2 0 0;
    }
    AppHeader #search-input {
        background: #1a1a1a;
        border: tall #ffb300;
        color: white;
        width: 40;
    }
    AppHeader #status-label {
        color: #888888;
        padding: 0 0 0 2;
        content-align: left middle;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("STOCK TERMINAL", id="app-title")
        yield Input(placeholder="Enter ticker symbol (e.g. AAPL)", id="search-input")
        yield Static("Ready", id="status-label")
