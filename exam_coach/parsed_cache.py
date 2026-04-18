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
        topic_dir = self.raw_root / topic_id
        topic_dir.mkdir(parents=True, exist_ok=True)
        return topic_dir / f"{slugify(source_file)}.json"

    def normalized_document_path(self, topic_id: str, source_file: str) -> Path:
        topic_dir = self.normalized_root / topic_id
        topic_dir.mkdir(parents=True, exist_ok=True)
        return topic_dir / f"{slugify(source_file)}.json"

    def load_normalized_document(self, topic_id: str, source_file: str) -> ParsedDocument | None:
        target = self.normalized_document_path(topic_id, source_file)
        if not target.exists():
            return None
        return ParsedDocument.model_validate_json(target.read_text(encoding="utf-8"))
