"""Helpers for stable cache paths for raw and normalized parsed documents."""

from __future__ import annotations

from json import loads
from pathlib import Path

from .models import ParsedDocument
from .text_utils import slugify


class ParsedCache:
    def __init__(self, data_root: Path) -> None:
        self.data_root = data_root
        self.raw_root = self.data_root / "parsed" / "raw"
        self.normalized_root = self.data_root / "parsed" / "normalized"
        self.raw_root.mkdir(parents=True, exist_ok=True)
        self.normalized_root.mkdir(parents=True, exist_ok=True)

    def raw_document_path(self, topic_id: str, source_file: str) -> Path:
        return (self.raw_root / topic_id) / f"{slugify(source_file)}.json"

    def normalized_document_path(self, topic_id: str, source_file: str) -> Path:
        return (self.normalized_root / topic_id) / f"{slugify(source_file)}.json"

    def ensure_raw_document_path(self, topic_id: str, source_file: str) -> Path:
        target = self.raw_document_path(topic_id, source_file)
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    def ensure_normalized_document_path(self, topic_id: str, source_file: str) -> Path:
        target = self.normalized_document_path(topic_id, source_file)
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    def load_normalized_document(self, topic_id: str, source_file: str) -> ParsedDocument | None:
        target = self.normalized_document_path(topic_id, source_file)
        if not target.exists():
            return None
        return ParsedDocument.model_validate_json(target.read_text(encoding="utf-8"))
