"""Offline ingestion pipeline for the MathonGo physics PDFs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from pypdf import PdfReader

from .models import IngestionSummary, QuestionBankRecord, TopicCatalogItem, TopicConfigItem
from .parsed_cache import ParsedCache
from .storage import QuestionBankStore
from .text_utils import clean_question_text, remove_footer_lines, slugify, split_sentences, unique_everseen
from .topic_catalog import load_topic_configs
from .vector_index import LocalVectorIndex


ANSWER_MARKERS = ("ANSWERS AND SOLUTIONS", "Answer Keys", "Answer Key")


@dataclass
class ParsedQuestionBlock:
    question_number: int
    session: str | None
    stem: str
    options: list[str]
    answer_key: str
    solution_text: str


class DifficultyAssessor:
    def assess(self, stem: str, solution_text: str) -> tuple[str, float, list[str], float]:
        score = 35.0
        reasons: list[str] = []

        stem_length = len(stem.split())
        solution_length = len(solution_text.split())
        option_count = stem.count("(1)") + stem.count("(2)") + stem.count("(3)") + stem.count("(4)")
        statement_markers = sum(stem.count(marker) for marker in ("A.", "B.", "C.", "D.", "E."))
        formula_markers = sum(stem.count(marker) for marker in ("=", "sin", "cos", "log", "tan", "π", "sqrt", "∫"))

        score += min(stem_length / 6.0, 15.0)
        score += min(solution_length / 12.0, 20.0)
        score += statement_markers * 5.0
        score += formula_markers * 3.0
        score += max(option_count - 4, 0) * 1.5

        if stem_length > 45:
            reasons.append("longer-than-average stem")
        if solution_length > 80:
            reasons.append("multi-step solution")
        if statement_markers >= 3:
            reasons.append("multi-statement reasoning")
        if formula_markers >= 3:
            reasons.append("equation-heavy setup")

        score = max(0.0, min(score, 100.0))
        if score >= 70:
            label = "hard"
        elif score >= 45:
            label = "medium"
        else:
            label = "easy"

        confidence = min(0.95, 0.45 + (len(reasons) * 0.12))
        return label, round(score, 2), reasons, round(confidence, 2)


class IngestionService:
    def __init__(
        self,
        docs_root: Path,
        question_bank_store: QuestionBankStore,
        vector_index: LocalVectorIndex,
        data_root: Path | None = None,
    ) -> None:
        self.docs_root = docs_root
        self.question_bank_store = question_bank_store
        self.vector_index = vector_index
        self.difficulty_assessor = DifficultyAssessor()
        self.parsed_cache = ParsedCache(data_root or self.question_bank_store.db_path.parent)

    def ingest(self, pilot_only: bool = True) -> IngestionSummary:
        topic_configs = self._build_topic_configs()
        active_topic_configs = [item for item in topic_configs if item.status == "pilot_ready"] if pilot_only else topic_configs
        topics = [
            TopicCatalogItem(
                topic_id=item.topic_id,
                topic_name=item.topic_name,
                aliases=item.aliases,
                source_files=[],
            )
            for item in active_topic_configs
        ]
        topic_by_name = {topic.topic_name: topic for topic in topics}
        questions: list[QuestionBankRecord] = []
        used_source_files: list[str] = []

        for topic_config in active_topic_configs:
            topic = topic_by_name[topic_config.topic_name]
            candidate_files = topic_config.selected_files or topic_config.source_files
            for filename in candidate_files:
                pdf_path = self.docs_root / filename
                if not pdf_path.exists():
                    continue
                topic.source_files.append(str(pdf_path))
                used_source_files.append(str(pdf_path))
                questions.extend(self._parse_chapter_pdf(pdf_path, topic, source_file=filename))

        for topic in topics:
            topic.source_files = unique_everseen(topic.source_files)

        self.question_bank_store.replace_topics(topics)
        self.question_bank_store.replace_questions(questions)
        self.vector_index.build([(question.question_id, question.embedding_text) for question in questions])

        return IngestionSummary(
            topic_count=len(topics),
            question_count=len(questions),
            indexed_count=len(questions),
            source_files=sorted(unique_everseen(used_source_files)),
        )

    def _build_topic_configs(self) -> list[TopicConfigItem]:
        return load_topic_configs()

    def _extract_pdf_text(self, pdf_path: Path) -> str:
        reader = PdfReader(str(pdf_path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)

    def _extract_topic_text(self, pdf_path: Path, topic_id: str, source_file: str) -> str:
        cached = self.parsed_cache.load_normalized_document(topic_id, source_file)
        if cached is not None and cached.content.strip():
            return cached.content
        return self._extract_pdf_text(pdf_path)

    def _parse_chapter_pdf(self, pdf_path: Path, topic: TopicCatalogItem, source_file: str) -> list[QuestionBankRecord]:
        text = self._extract_topic_text(pdf_path, topic.topic_id, source_file)
        marker = next((item for item in ANSWER_MARKERS if item in text), None)
        if marker is None:
            return []
        questions_text, answers_text = text.split(marker, 1)
        answer_map = self._parse_answer_summary(answers_text)
        solution_map = self._parse_solution_sections(answers_text, answer_map)

        blocks = [
            block.strip()
            for block in re.split(r"(?=\bQ\d+\.)", questions_text)
            if re.match(r"^\s*Q\d+\.", block)
        ]

        source_year, source_session = self._infer_source_metadata(pdf_path)
        records: list[QuestionBankRecord] = []
        for block in blocks:
            parsed = self._parse_question_block(block, answer_map, solution_map)
            if parsed is None:
                continue
            difficulty_label, difficulty_score, difficulty_reasons, confidence = self.difficulty_assessor.assess(
                parsed.stem,
                parsed.solution_text,
            )
            question_id = slugify(f"{pdf_path.name}-{parsed.question_number}")
            embedding_text = clean_question_text(
                f"{topic.topic_name}\n{parsed.stem}\n{parsed.solution_text}"
            )
            records.append(
                QuestionBankRecord(
                    question_id=question_id,
                    topic_id=topic.topic_id,
                    topic_name=topic.topic_name,
                    source_file=str(pdf_path),
                    source_year=source_year,
                    source_session=source_session or parsed.session,
                    source_question_number=parsed.question_number,
                    stem=parsed.stem,
                    options=parsed.options,
                    answer_key=parsed.answer_key,
                    solution_text=parsed.solution_text,
                    difficulty_label=difficulty_label,  # type: ignore[arg-type]
                    difficulty_score=difficulty_score,
                    difficulty_reasons=difficulty_reasons,
                    confidence=confidence,
                    embedding_text=embedding_text,
                )
            )
        return records

    def _parse_answer_summary(self, answers_text: str) -> dict[int, str]:
        matches = list(re.finditer(r"(\d+)\.\s*(\([1-4]\)|-?\d+(?:\.\d+)?)", answers_text))
        summary: dict[int, str] = {}
        last_seen = 0
        for match in matches:
            qno = int(match.group(1))
            if summary and qno <= last_seen:
                break
            summary[qno] = match.group(2)
            last_seen = qno
        return summary

    def _parse_solution_sections(self, answers_text: str, answer_map: dict[int, str]) -> dict[int, str]:
        matches = list(re.finditer(r"(\d+)\.\s*(\([1-4]\)|-?\d+(?:\.\d+)?)", answers_text))
        cut_index = 0
        last_seen = 0
        for match in matches:
            qno = int(match.group(1))
            if answer_map and qno <= last_seen:
                cut_index = match.start()
                break
            last_seen = qno
        solution_text = answers_text[cut_index:]

        solutions: dict[int, str] = {}
        ordered_numbers = sorted(answer_map)
        for idx, qno in enumerate(ordered_numbers):
            answer = answer_map[qno]
            pattern = re.compile(
                rf"(?ms)^\s*{qno}\.\s*(?:{re.escape(answer)}|\({re.escape(answer.strip('()'))}\))\s*(.*?)"
                rf"(?=^\s*{ordered_numbers[idx + 1]}\.\s|\\Z)"
                if idx + 1 < len(ordered_numbers)
                else rf"(?ms)^\s*{qno}\.\s*(?:{re.escape(answer)}|\({re.escape(answer.strip('()'))}\))\s*(.*?)\Z"
            )
            match = pattern.search(solution_text)
            if not match:
                continue
            solutions[qno] = clean_question_text(match.group(1))
        return solutions

    def _parse_question_block(
        self,
        block: str,
        answer_map: dict[int, str],
        solution_map: dict[int, str],
    ) -> ParsedQuestionBlock | None:
        match = re.match(r"^\s*Q(\d+)\.\s*(.*)$", block, re.S)
        if not match:
            return None
        qno = int(match.group(1))
        if qno not in answer_map:
            return None
        body = remove_footer_lines(match.group(2))
        lines = [line.strip() for line in body.splitlines() if line.strip()]
        session = lines[0] if lines and lines[0].startswith("JEE Main") else None

        option_matches = re.findall(r"\((\d)\)\s*(.*?)(?=\(\d\)|$)", body, re.S)
        options = [clean_question_text(item[1]) for item in option_matches if clean_question_text(item[1])]

        stem = body
        if session:
            stem = stem[len(session) :].strip()
        stem = re.sub(r"\((1|2|3|4)\)\s*.*", "", stem, flags=re.S)
        stem = clean_question_text(stem)
        if not stem:
            return None

        solution_text = solution_map.get(qno, "")
        if not solution_text:
            sentences = split_sentences(body)
            solution_text = sentences[0] if sentences else "No solution extracted."

        return ParsedQuestionBlock(
            question_number=qno,
            session=session,
            stem=stem,
            options=options[:4],
            answer_key=answer_map[qno],
            solution_text=solution_text,
        )

    def _infer_source_metadata(self, pdf_path: Path) -> tuple[int | None, str | None]:
        if "2026" in pdf_path.name:
            return 2026, "January"
        if "2025" in pdf_path.name:
            session = "January" if "January" in pdf_path.name else "April"
            return 2025, session
        match = re.search(r"cqb_physics_jee_main_(\d{4})", pdf_path.name.lower())
        if match:
            return int(match.group(1)), None
        return None, None
