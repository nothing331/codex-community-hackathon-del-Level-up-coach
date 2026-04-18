#!/usr/bin/env python3
"""Parse configured source PDFs with LlamaParse and cache raw/normalized outputs locally."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from exam_coach.llamaparse_ingestion import LlamaParseIngestionService


def main() -> None:
    parser = argparse.ArgumentParser(description="Cache LlamaParse outputs for the Exam Coach source PDFs.")
    parser.add_argument(
        "--all-topics",
        action="store_true",
        help="Parse all configured topics instead of the smaller pilot-ready subset.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-parse files even if cached outputs already exist.",
    )
    parser.add_argument(
        "--topic-id",
        action="append",
        default=[],
        help="Only parse the specified topic id. Repeat the flag to include multiple topics.",
    )
    args = parser.parse_args()

    service = LlamaParseIngestionService(
        docs_root=PROJECT_ROOT / "docs" / "mathongo" / "physics",
        data_root=PROJECT_ROOT / "data",
    )
    summary = service.ingest(
        pilot_only=not args.all_topics,
        force=args.force,
        topic_ids=args.topic_id or None,
    )
    print(summary.model_dump_json(indent=2))
    print(f"Raw cache root: {PROJECT_ROOT / 'data' / 'parsed' / 'raw'}")
    print(f"Normalized cache root: {PROJECT_ROOT / 'data' / 'parsed' / 'normalized'}")


if __name__ == "__main__":
    main()
