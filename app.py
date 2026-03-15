from datetime import datetime

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Container, Horizontal, ScrollableContainer
from textual import work
from textual.widgets import (
    DataTable,
    Footer,
    Input,
    Static,
    TabbedContent,
    TabPane,
)
from rich.text import Text

from data.stock import get_stock_info
from data.edgar import get_latest_10k_text
from data.parser import extract_relationships
from components.overview import build_overview_markup
from components.financials import build_financials_markup
from components.relationships import build_relationship_rows, empty_row


class StockTerminalApp(App):
    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("/", "focus_search", "Search"),
    ]

    CSS = """
    Screen {
        background: #0a0a0a;
    }

    #top-bar {
        layout: horizontal;
        background: #111111;
        padding: 1;
        height: 5;
        align: left middle;
    }

    #app-title {
        color: #ffb300;
        text-style: bold;
        width: 30;
        content-align: left middle;
        padding: 0 2 0 0;
    }

    #search-input {
        background: #1a1a1a;
        border: tall #ffb300;
        color: white;
        width: 40;
    }

    #status-label {
        color: #888888;
        padding: 0 0 0 2;
        content-align: left middle;
    }

    #main-content {
        layout: horizontal;
        height: 1fr;
    }

    #left-panel {
        width: 40%;
        background: #0d0d0d;
        border: tall #333333;
        padding: 1;
        overflow-y: scroll;
    }

    #right-panel {
        width: 60%;
        background: #0d0d0d;
        border: tall #333333;
        padding: 1;
    }

    .panel-title {
        color: #ffb300;
        text-style: bold;
    }

    .label-key {
        color: #ffb300;
    }

    .label-value {
        color: white;
    }

    .positive {
        color: #00ff88;
    }

    .negative {
        color: #ff4444;
    }

    DataTable {
        background: #0d0d0d;
        color: white;
        height: 1fr;
    }

    DataTable > .datatable--header {
        background: #1a1a1a;
        color: #ffb300;
    }

    DataTable > .datatable--cursor {
        background: #2a2a2a;
    }

    TabbedContent TabPane {
        background: #0d0d0d;
        padding: 1;
    }

    Tabs Tab {
        background: #111111;
        color: #888888;
    }

    Tabs Tab.-active {
        background: #1a1a1a;
        color: #ffb300;
    }

    Footer {
        background: #111111;
        color: #ffb300;
    }

    #about-scroll {
        height: 1fr;
    }
    """

    # ------------------------------------------------------------------ layout

    def compose(self) -> ComposeResult:
        with Container(id="top-bar"):
            yield Static("STOCK TERMINAL", id="app-title")
            yield Input(placeholder="Enter ticker symbol (e.g. AAPL)", id="search-input")
            yield Static("Ready", id="status-label")

        with Horizontal(id="main-content"):
            with ScrollableContainer(id="left-panel"):
                yield Static("", id="overview-content")
                yield Static("", id="financials-content")

            with Container(id="right-panel"):
                with TabbedContent():
                    with TabPane("10-K RELATIONSHIPS", id="tab-rel"):
                        yield DataTable(id="relationships-table")
                    with TabPane("ABOUT", id="tab-about"):
                        with ScrollableContainer(id="about-scroll"):
                            yield Static(
                                "Enter a ticker symbol above to load company information.",
                                id="about-content",
                            )

        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#relationships-table", DataTable)
        table.add_columns("Company", "Relationship", "Contract/Value", "Context")
        table.cursor_type = "row"

    # --------------------------------------------------------------- search

    def on_input_submitted(self, event: Input.Submitted) -> None:
        ticker = event.value.strip().upper()
        if not ticker:
            return

        self.query_one("#status-label", Static).update(f"Fetching data for {ticker}...")
        self.query_one("#overview-content", Static).update("")
        self.query_one("#financials-content", Static).update("")
        self.query_one("#about-content", Static).update("Loading…")
        self.query_one("#relationships-table", DataTable).clear()

        self._fetch_data(ticker)

    # ----------------------------------------------------------- background IO

    @work(thread=True)
    def _fetch_data(self, ticker: str) -> None:
        stock_info = get_stock_info(ticker)

        # Detect a complete fetch failure (only "error" + "name" keys returned)
        if set(stock_info.keys()) == {"error", "name"}:
            self.app.call_from_thread(
                self._update_ui_error,
                ticker,
                stock_info.get("error", "Unknown error"),
            )
            return

        tenk_text = get_latest_10k_text(ticker)

        relationships: list[dict] = []
        if tenk_text:
            try:
                relationships = extract_relationships(tenk_text)
            except Exception:
                relationships = []

        self.app.call_from_thread(
            self._update_ui, ticker, stock_info, relationships, tenk_text
        )

    # ----------------------------------------------------------- UI updates

    def _update_ui_error(self, ticker: str, error: str) -> None:
        self.query_one("#status-label", Static).update(f"[red]Error loading {ticker}[/red]")
        self.query_one("#overview-content", Static).update(
            f"[red]Ticker '[bold]{ticker}[/bold]' not found or data unavailable.\n\n{error}[/red]"
        )

    def _update_ui(
        self,
        ticker: str,
        stock_info: dict,
        relationships: list[dict],
        tenk_text: str | None,
    ) -> None:
        now = datetime.now().strftime("%H:%M:%S")

        # Left panel
        self.query_one("#overview-content", Static).update(
            build_overview_markup(ticker, stock_info)
        )
        self.query_one("#financials-content", Static).update(
            build_financials_markup(stock_info)
        )

        # Relationships table
        table = self.query_one("#relationships-table", DataTable)
        table.clear()
        rows = build_relationship_rows(relationships) if relationships else [empty_row()]
        for row in rows:
            table.add_row(*row)

        # About tab
        name = stock_info.get("name", ticker)
        description = stock_info.get("description", "No description available.")
        if tenk_text:
            tenk_note = (
                f"\n\n[dim #ffb300]10-K filing loaded — "
                f"{len(relationships)} relationship(s) extracted.[/dim #ffb300]"
            )
        else:
            tenk_note = "\n\n[dim #888888]10-K not available for this ticker.[/dim #888888]"

        self.query_one("#about-content", Static).update(
            f"[bold #ffb300]{name}[/bold #ffb300]\n\n[white]{description}[/white]{tenk_note}"
        )

        # Status bar
        self.query_one("#status-label", Static).update(
            f"[#00ff88]{ticker}[/] · Updated {now}"
        )

    # ----------------------------------------------------------- key actions

    def action_focus_search(self) -> None:
        self.query_one("#search-input", Input).focus()
