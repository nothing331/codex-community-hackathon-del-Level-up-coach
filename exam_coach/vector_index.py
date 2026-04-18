"""Local vector index backed by deterministic hash embeddings."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from .text_utils import tokenize


class LocalVectorIndex:
    def __init__(self, root: Path, dimension: int = 256) -> None:
        self.root = root
        self.dimension = dimension
        self.root.mkdir(parents=True, exist_ok=True)
        self.ids_path = self.root / "ids.json"
        self.matrix_path = self.root / "matrix.npy"
        self._ids: list[str] = []
        self._matrix: np.ndarray | None = None
        self._load()

    def _load(self) -> None:
        if self.ids_path.exists() and self.matrix_path.exists():
            self._ids = json.loads(self.ids_path.read_text(encoding="utf-8"))
            self._matrix = np.load(self.matrix_path)

    def build(self, items: list[tuple[str, str]]) -> None:
        self._ids = [item_id for item_id, _ in items]
        vectors = [self.embed_text(text) for _, text in items]
        if vectors:
            self._matrix = np.vstack(vectors)
        else:
            self._matrix = np.zeros((0, self.dimension), dtype=np.float32)
        self.ids_path.write_text(json.dumps(self._ids, indent=2), encoding="utf-8")
        np.save(self.matrix_path, self._matrix)

    def embed_text(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dimension, dtype=np.float32)
        tokens = tokenize(text)
        if not tokens:
            return vector
        grams = tokens + [f"{tokens[idx]}::{tokens[idx + 1]}" for idx in range(len(tokens) - 1)]
        for gram in grams:
            bucket = hash(gram) % self.dimension
            vector[bucket] += 1.0
        norm = float(np.linalg.norm(vector))
        if norm:
            vector /= norm
        return vector

    def search(
        self,
        *,
        query_text: str,
        allowed_ids: list[str],
        top_k: int,
        exclude_ids: set[str] | None = None,
    ) -> list[str]:
        if self._matrix is None or not self._ids:
            return []
        exclude_ids = exclude_ids or set()
        query_vector = self.embed_text(query_text)
        if not np.any(query_vector):
            return []
        id_to_idx = {item_id: idx for idx, item_id in enumerate(self._ids)}
        candidate_indices = [id_to_idx[item_id] for item_id in allowed_ids if item_id in id_to_idx and item_id not in exclude_ids]
        if not candidate_indices:
            return []
        candidate_matrix = self._matrix[candidate_indices]
        similarities = candidate_matrix @ query_vector
        ranked = sorted(
            zip(candidate_indices, similarities.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
        return [self._ids[idx] for idx, _ in ranked[:top_k]]

    def has_index(self) -> bool:
        return self._matrix is not None and len(self._ids) > 0
