#!/usr/bin/env python3
"""Validate the canonical topic catalog against files present in docs/mathongo/physics."""

from __future__ import annotations

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from exam_coach.topic_catalog import get_pilot_topic_configs, load_topic_configs

DOCS_ROOT = PROJECT_ROOT / "docs" / "mathongo" / "physics"


def main() -> None:
    configs = load_topic_configs()
    pilot = get_pilot_topic_configs()

    missing: list[str] = []
    for config in configs:
        for filename in config.source_files:
            if not (DOCS_ROOT / filename).exists():
                missing.append(f"{config.topic_name}: {filename}")

    print(f"Configured topics: {len(configs)}")
    print(f"Pilot topics: {len(pilot)}")
    print("Pilot selection:")
    for item in pilot:
        print(f"- {item.topic_name}")
        for filename in item.selected_files:
            print(f"  - {filename}")

    if missing:
        print("\nMissing files:")
        for item in missing:
            print(f"- {item}")
        raise SystemExit(1)

    print("\nCatalog validation passed.")


if __name__ == "__main__":
    main()
