#!/usr/bin/env python3
"""Run the local FastAPI server for Exam Coach."""

from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn


if __name__ == "__main__":
    uvicorn.run("exam_coach.api:app", host="127.0.0.1", port=8000, reload=False)
