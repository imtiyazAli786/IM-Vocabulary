#!/usr/bin/env python3
"""Parse the vocabulary document into a CSV of word/sentence entries."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


NOISE_PATTERN = re.compile(r"^(\d+|\.+|\-|—|\_)$")
NUMBER_PREFIX = re.compile(r"^\s*\d+[\.)]?\s*")


def sanitize_line(line: str) -> str | None:
    text = line.strip()
    if not text:
        return None
    text = NUMBER_PREFIX.sub("", text)
    text = text.strip()
    if not text:
        return None
    if NOISE_PATTERN.fullmatch(text):
        return None
    return text


def split_entry(text: str) -> tuple[str, str]:
    if "=" in text:
        left, right = text.split("=", 1)
        return clean_field(left), clean_field(right)
    return clean_field(text), ""


def clean_field(field: str) -> str:
    value = field.strip()
    value = value.replace("  ", " ")
    return value


def parse_pdf(pdf_path: Path, include_empty: bool = False) -> list[dict[str, str]]:
    import pdfplumber

    records: list[dict[str, str]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            for line_index, raw_line in enumerate(text.splitlines(), start=1):
                cleaned = sanitize_line(raw_line)
                if cleaned is None:
                    continue
                front, explanation = split_entry(cleaned)
                if not front and (not include_empty):
                    continue
                records.append(
                    {
                        "page": str(page_index),
                        "line": str(line_index),
                        "front": front,
                        "explanation": explanation,
                    }
                )
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract word/sentence pairs into CSV.")
    parser.add_argument("input", type=Path, help="Path to the vocabulary PDF (or other text file).")
    parser.add_argument("output", type=Path, help="CSV file that receives the cleaned entries.")
    parser.add_argument("--include-empty", action="store_true", help="Include entries that only have explanations.")
    args = parser.parse_args()

    if not args.input.exists():
        parser.error(f"Input file not found: {args.input}")

    entries = parse_pdf(args.input, include_empty=args.include_empty)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as out_csv:
        writer = csv.DictWriter(out_csv, fieldnames=["page", "line", "front", "explanation"])
        writer.writeheader()
        writer.writerows(entries)

    print(f"Extracted {len(entries)} entries from {args.input.name} into {args.output}")


if __name__ == "__main__":
    main()
