"""Text normalization helpers used across ingestion and generation."""

from __future__ import annotations

import hashlib
import re
from typing import Iterable


FOOTER_PATTERNS = (
    "MathonGo",
    "#PaperPhodnaHai",
    "www.mathongo.com",
    "Questions with Answer Keys",
    "Question Bank",
    "Chapter-wise Question Bank",
    "JEE Main 2025 January",
    "JEE Main 2025 April",
    "JEE Main 2026",
)


def slugify(value: str) -> str:
    sanitized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return sanitized or hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]


def normalize_whitespace(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def remove_footer_lines(text: str) -> str:
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            lines.append("")
            continue
        if any(marker in line for marker in FOOTER_PATTERNS):
            continue
        if re.fullmatch(r"\d+", line):
            continue
        lines.append(line)
    return normalize_whitespace("\n".join(lines))


def clean_question_text(text: str) -> str:
    text = remove_footer_lines(text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    return normalize_whitespace(text)


def split_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", normalize_whitespace(text))
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def unique_everseen(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered
