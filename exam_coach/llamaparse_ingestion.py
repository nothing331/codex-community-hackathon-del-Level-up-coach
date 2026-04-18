"""LlamaParse-backed offline ingestion into the local parsed cache."""

from __future__ import annotations

import json
from pathlib import Path

from llama_parse import LlamaParse

from .env import get_required_env, load_local_env
from .models import ParseCacheSummary, ParsedDocument, TopicConfigItem
from .parsed_cache import ParsedCache
from .topic_catalog import load_topic_configs


class LlamaParseIngestionService:
    def __init__(self, docs_root: Path, data_root: Path) -> None:
        self.docs_root = docs_root
        self.cache = ParsedCache(data_root)

    def ingest(
        self,
        pilot_only: bool = True,
        force: bool = False,
        topic_ids: list[str] | None = None,
    ) -> ParseCacheSummary:
        topic_configs = load_topic_configs()
        active_topics = [item for item in topic_configs if item.status == "pilot_ready"] if pilot_only else topic_configs
        if topic_ids:
            requested = set(topic_ids)
            active_topics = [item for item in active_topics if item.topic_id in requested]
        parser = self._build_parser()

        parsed_count = 0
        skipped_count = 0
        failed_count = 0
        touched_files: list[str] = []

        print("injest start")

        for topic in active_topics:
            candidate_files = topic.selected_files or topic.source_files
            for source_file in candidate_files:
                source_path = self.docs_root / source_file
                raw_path = self.cache.raw_document_path(topic.topic_id, source_file)
                normalized_path = self.cache.normalized_document_path(topic.topic_id, source_file)
                touched_files.append(str(source_path))

                if not source_path.exists():
                    failed_count += 1
                    continue
                if raw_path.exists() and normalized_path.exists() and not force:
                    skipped_count += 1
                    continue

                raw_result = parser.get_json_result(str(source_path))[0]
                markdown_content = self._extract_markdown(raw_result)
                page_count = self._extract_page_count(raw_result)

                raw_document = ParsedDocument(
                    topic_id=topic.topic_id,
                    topic_name=topic.topic_name,
                    source_file=str(source_path),
                    parser="llamaparse",
                    content_format="json",
                    page_count=page_count,
                    content=json.dumps(raw_result, ensure_ascii=False),
                    metadata=self._build_metadata(raw_result),
                )
                normalized_document = ParsedDocument(
                    topic_id=topic.topic_id,
                    topic_name=topic.topic_name,
                    source_file=str(source_path),
                    parser="llamaparse",
                    content_format="markdown",
                    page_count=page_count,
                    content=markdown_content,
                    metadata=self._build_metadata(raw_result),
                )

                raw_path = self.cache.ensure_raw_document_path(topic.topic_id, source_file)
                normalized_path = self.cache.ensure_normalized_document_path(topic.topic_id, source_file)
                raw_path.write_text(raw_document.model_dump_json(indent=2), encoding="utf-8")
                normalized_path.write_text(normalized_document.model_dump_json(indent=2), encoding="utf-8")
                parsed_count += 1

        return ParseCacheSummary(
            parsed_count=parsed_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            source_files=touched_files,
        )

    def _build_parser(self) -> LlamaParse:
        load_local_env()
        print("API call")
        api_key = get_required_env("LLAMA_CLOUD_API_KEY")
        return LlamaParse(
            api_key=api_key,
            result_type="markdown",
            split_by_page=False,
            verbose=True,
            language="en",
        )

    def _extract_markdown(self, raw_result: dict) -> str:
        if isinstance(raw_result.get("markdown"), str) and raw_result["markdown"].strip():
            return raw_result["markdown"]
        pages = raw_result.get("pages") or []
        page_markdown = []
        for page in pages:
            text = page.get("md") or page.get("markdown") or page.get("text") or ""
            if text:
                page_markdown.append(text)
        return "\n\n".join(page_markdown).strip()

    def _extract_page_count(self, raw_result: dict) -> int | None:
        pages = raw_result.get("pages")
        if isinstance(pages, list):
            return len(pages)
        job_pages = raw_result.get("job_pages")
        if isinstance(job_pages, int):
            return job_pages
        return None

    def _build_metadata(self, raw_result: dict) -> dict[str, str | int | float | bool | list | dict | None]:
        metadata: dict[str, str | int | float | bool | list | dict | None] = {}
        for key in ("job_id", "file_path", "file_name", "job_is_cache_hit"):
            if key in raw_result:
                metadata[key] = raw_result[key]
        return metadata
