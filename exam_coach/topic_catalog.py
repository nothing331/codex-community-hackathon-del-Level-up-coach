"""Helpers for loading the canonical topic catalog."""

from __future__ import annotations

import json
from pathlib import Path

from .models import TopicCatalogItem, TopicConfigItem


PACKAGE_ROOT = Path(__file__).resolve().parent
CONFIG_ROOT = PACKAGE_ROOT / "config"
TOPICS_CONFIG_PATH = CONFIG_ROOT / "topics.json"


def load_topic_configs(config_path: Path = TOPICS_CONFIG_PATH) -> list[TopicConfigItem]:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    return [TopicConfigItem.model_validate(item) for item in payload["topics"]]


def load_topic_catalog(config_path: Path = TOPICS_CONFIG_PATH) -> list[TopicCatalogItem]:
    return [
        TopicCatalogItem(
            topic_id=item.topic_id,
            topic_name=item.topic_name,
            aliases=item.aliases,
            source_files=item.source_files,
        )
        for item in load_topic_configs(config_path)
    ]


def get_pilot_topic_configs(config_path: Path = TOPICS_CONFIG_PATH) -> list[TopicConfigItem]:
    return [item for item in load_topic_configs(config_path) if item.status == "pilot_ready"]
