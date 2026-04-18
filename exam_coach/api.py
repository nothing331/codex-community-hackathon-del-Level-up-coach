"""FastAPI application for the Exam Coach backend."""

from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException

from .models import EvaluateRequest, EvaluateResponse, ExamCoachInput, GenerateResponse, TopicsResponse
from .orchestrator import ExamCoachRuntime


@lru_cache(maxsize=1)
def get_runtime() -> ExamCoachRuntime:
    return ExamCoachRuntime()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Exam Coach API",
        version="0.1.0",
        description="Hybrid question-bank and agentic quiz generation backend for JEE Physics.",
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/topics", response_model=TopicsResponse)
    def list_topics() -> TopicsResponse:
        runtime = get_runtime()
        try:
            return runtime.list_topics()
        except Exception as exc:  # pragma: no cover - defensive server boundary
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/exam-coach/generate", response_model=GenerateResponse)
    def generate_exam(exam_input: ExamCoachInput) -> GenerateResponse:
        runtime = get_runtime()
        try:
            response = runtime.run_exam_coach_flow(exam_input)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover - defensive server boundary
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if isinstance(response, GenerateResponse):
            return response

        raise HTTPException(status_code=500, detail="Unexpected response type from generate flow.")

    @app.post("/api/exam-coach/evaluate", response_model=EvaluateResponse)
    def evaluate_exam(request: EvaluateRequest) -> EvaluateResponse:
        runtime = get_runtime()
        try:
            report = runtime.evaluate_existing(request.question_set_id, request.student_answers)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Unknown question_set_id") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover - defensive server boundary
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        return EvaluateResponse(performance_report=report)

    return app


app = create_app()
