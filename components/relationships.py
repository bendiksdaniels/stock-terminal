"""
Relationships panel — helpers for populating the 10-K DataTable.
build_relationship_rows() converts the list produced by parser.extract_relationships()
into (Text, Text, Text, Text) tuples ready for DataTable.add_row().
"""
from __future__ import annotations

from rich.text import Text

REL_COLORS: dict[str, str] = {
    "Customer": "#00ff88",
    "Supplier": "#4fc3f7",
    "Partner": "#ce93d8",
    "Acquisition": "#ffb300",
    "Licensee": "#80cbc4",
    "Competitor": "#ff4444",
}


def build_relationship_rows(relationships: list[dict]) -> list[tuple]:
    """
    Convert a list of relationship dicts into DataTable row tuples.

    Each returned tuple is (company, relationship, value, context) where
    every element is a rich.text.Text instance with appropriate styling.
    """
    rows = []
    for rel in relationships:
        company = rel.get("company", "")
        relationship = rel.get("relationship", "")
        value = rel.get("value", "—")
        context = rel.get("context", "")[:100]
        color = REL_COLORS.get(relationship, "white")
        rows.append(
            (
                Text(company, style="white"),
                Text(relationship, style=color),
                Text(value, style="dim white"),
                Text(context, style="#666666"),
            )
        )
    return rows


def empty_row() -> tuple:
    """Single placeholder row shown when no relationships are found."""
    return (
        Text("No relationships found", style="dim"),
        Text("—", style="dim"),
        Text("—", style="dim"),
        Text("10-K data not available or no relationships extracted.", style="dim"),
    )
