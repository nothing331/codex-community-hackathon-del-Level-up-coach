# Exam Coach API Integration

This document describes the backend API that powers the v1 Exam Coach flow.

The backend is a FastAPI server that exposes:

- `GET /health`
- `GET /api/topics`
- `POST /api/exam-coach/generate`
- `POST /api/exam-coach/evaluate`

Base URL during local development:

```text
http://127.0.0.1:8000
```

## Backend Purpose

The backend supports two user flows:

1. `chapter_quiz`
   - user selects one topic
   - backend generates a topic-specific MCQ quiz

2. `full_physics_mix`
   - user does not need to select a specific topic
   - backend generates a mixed Physics quiz across currently ingested topics

Important v1 constraints:

- no user PDF uploads
- only pre-ingested Physics topics are supported
- current runtime question type is `mcq`
- the safest frontend flow is:
  1. fetch topics from `/api/topics`
  2. let the user choose a valid topic id
  3. call `/api/exam-coach/generate`
  4. collect answers
  5. call `/api/exam-coach/evaluate`

## 1. Health Check

### Request

```http
GET /health
```

### Response

```json
{
  "status": "ok"
}
```

Use this for:

- backend readiness checks
- frontend startup diagnostics
- retry / offline UI state

## 2. Topics Endpoint

### Request

```http
GET /api/topics
```

### Response Shape

```json
{
  "topics": [
    {
      "topic_id": "electrostatics",
      "topic_name": "Electrostatics",
      "aliases": ["Electrostatics and Charges"],
      "status": "pilot_ready",
      "is_ingested": true,
      "selected_files": [
        "Electrostatics - JEE Main 2026 (Jan) - MathonGo.pdf",
        "Electrostatics - JEE Main 2024 January Question Bank - MathonGo.pdf",
        "Electrostatics - JEE Main 2023 January Chapter wise Questions by MathonGo.pdf"
      ]
    }
  ]
}
```

### Field Meaning

- `topic_id`
  - use this value in `selected_topic_ids`
- `topic_name`
  - display label in the UI
- `aliases`
  - optional extra labels if you want search support
- `status`
  - `pilot_ready`, `queued`, or `archived`
- `is_ingested`
  - only `true` topics are safe to use for generation in the current environment
- `selected_files`
  - source PDFs currently chosen for that topic in the content pipeline

### Frontend Rule

For v1, the frontend should only allow selection of topics where:

- `is_ingested === true`

You can optionally also filter to:

- `status === "pilot_ready"`

### Current Pilot Topic IDs

At the moment, the backend is prepared around these topic ids:

- `electrostatics`
- `current-electricity`
- `laws-of-motion`
- `ray-optics`
- `thermodynamics`
- `atomic-physics`

Do not hardcode this list in the UI long-term. Use `/api/topics`.

## 3. Generate Quiz

### Request

```http
POST /api/exam-coach/generate
Content-Type: application/json
```

### Request Body

```json
{
  "mode": "chapter_quiz",
  "subject": "JEE Physics",
  "selected_topic_ids": ["electrostatics"],
  "total_questions": 9,
  "time_limit_minutes": 20,
  "question_type": "mcq",
  "difficulty_preference": "balanced",
  "student_level": "intermediate"
}
```

### Request Fields

- `mode`
  - `"chapter_quiz"` or `"full_physics_mix"`
- `subject`
  - keep as `"JEE Physics"` for v1
- `selected_topic_ids`
  - required for `chapter_quiz`
  - should contain a valid topic id from `/api/topics`
  - ignored or optional for `full_physics_mix`
- `total_questions`
  - optional
  - recommended:
    - `chapter_quiz`: `9`
    - `full_physics_mix`: `15`
- `time_limit_minutes`
  - optional
- `question_type`
  - use `"mcq"`
- `difficulty_preference`
  - currently safe to send `"balanced"`
- `student_level`
  - optional free text for future personalization

### Response Shape

```json
{
  "blueprint": {
    "blueprint_id": "blueprint-123",
    "mode": "chapter_quiz",
    "subject": "JEE Physics",
    "selected_topic_ids": ["electrostatics"],
    "difficulty_plan": [
      { "difficulty_label": "hard", "question_count": 3 },
      { "difficulty_label": "medium", "question_count": 3 },
      { "difficulty_label": "easy", "question_count": 3 }
    ],
    "ordering_rule": "hard_to_easy",
    "total_questions": 9,
    "time_limit_minutes": 20,
    "question_type": "mcq",
    "retrieval_criteria": {
      "topic_ids": ["electrostatics"],
      "difficulty_labels": ["hard", "medium", "easy"],
      "source_years": [],
      "max_candidates_per_slot": 8
    },
    "created_at": "2026-04-18T09:00:00Z"
  },
  "question_set": {
    "question_set_id": "qset-123",
    "blueprint_id": "blueprint-123",
    "instructions": "Answer all questions in sequence...",
    "questions": [
      {
        "question_id": "electrostatics-derived-01",
        "topic_id": "electrostatics",
        "stem": "Which of the following statements...",
        "options": [
          { "option_id": "option-1", "text": "..." },
          { "option_id": "option-2", "text": "..." },
          { "option_id": "option-3", "text": "..." },
          { "option_id": "option-4", "text": "..." }
        ],
        "difficulty_label": "hard",
        "difficulty_score": 76.0
      }
    ],
    "meta": {
      "mode": "chapter_quiz",
      "total_questions": 9,
      "ordering_rule": "hard_to_easy",
      "generation_mode": "agentic"
    }
  }
}
```

### Frontend Notes

- render `question_set.questions`
- do not rely on any answer key from this response
- store:
  - `question_set_id`
  - each `question_id`
  - each selected `option_id`
- use `meta.generation_mode` only for diagnostics or admin UI

### Error Behavior

If the frontend sends an invalid topic id, the backend now returns a `400`.

Example invalid request:

```json
{
  "mode": "chapter_quiz",
  "selected_topic_ids": ["string"],
  "question_type": "mcq"
}
```

Example error shape:

```json
{
  "detail": "Invalid selected_topic_ids: string. Available topic ids: atomic-physics, current-electricity, electrostatics, laws-of-motion, ray-optics, thermodynamics"
}
```

### Frontend Recommendation

Never let the user type raw topic ids. Always use a selection UI fed from `/api/topics`.

## 4. Evaluate Quiz

### Request

```http
POST /api/exam-coach/evaluate
Content-Type: application/json
```

### Request Body

```json
{
  "question_set_id": "qset-123",
  "student_answers": [
    {
      "question_id": "electrostatics-derived-01",
      "selected_option_id": "option-2"
    },
    {
      "question_id": "electrostatics-derived-02",
      "selected_option_id": "option-1"
    }
  ]
}
```

### Request Rules

- `question_set_id`
  - must be the id returned by `/generate`
- `student_answers`
  - array of attempted answers
  - questions omitted from the array are treated as unattempted
- `selected_option_id`
  - should match one of the option ids returned in the original question set

### Response Shape

```json
{
  "performance_report": {
    "report_id": "report-123",
    "question_set_id": "qset-123",
    "score_summary": {
      "attempted": 9,
      "correct": 5,
      "incorrect": 4,
      "unattempted": 0,
      "percentage": 55.56
    },
    "topic_performance": [
      {
        "topic_id": "electrostatics",
        "accuracy": 55.56,
        "attempted": 9,
        "weakness_level": "medium"
      }
    ],
    "difficulty_performance": [
      {
        "difficulty_label": "hard",
        "accuracy": 33.33,
        "attempted": 3
      }
    ],
    "question_review": [
      {
        "question_id": "electrostatics-derived-01",
        "selected_option_id": "option-2",
        "correct_option_id": "option-3",
        "result": "incorrect",
        "explanation": "..."
      }
    ],
    "coaching": {
      "strengths": ["..."],
      "weak_topics": ["..."],
      "next_actions": ["..."],
      "recommended_practice_plan": ["..."]
    },
    "generated_at": "2026-04-18T09:10:00Z"
  }
}
```

### Frontend Rendering Guidance

Recommended result sections:

- score summary card
- topic accuracy section
- difficulty breakdown section
- per-question review with:
  - chosen option
  - correct option
  - explanation
- coaching plan with:
  - strengths
  - weak topics
  - next actions
  - recommended practice plan

## End-to-End Frontend Flow

### Chapter Quiz Flow

1. Call `GET /api/topics`
2. Show available ingested topics
3. User selects one topic
4. Call `POST /api/exam-coach/generate`
5. Render MCQs
6. Collect answers locally
7. Call `POST /api/exam-coach/evaluate`
8. Render performance report

### Full Physics Flow

1. Optionally call `GET /api/topics` for available coverage info
2. Call `POST /api/exam-coach/generate` with `mode = "full_physics_mix"`
3. Render the mixed quiz
4. Submit answers to `/evaluate`
5. Render report

## Example Fetch Code

### Fetch topics

```ts
const response = await fetch("http://127.0.0.1:8000/api/topics");
const data = await response.json();
```

### Generate quiz

```ts
const response = await fetch("http://127.0.0.1:8000/api/exam-coach/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify({
    mode: "chapter_quiz",
    subject: "JEE Physics",
    selected_topic_ids: ["electrostatics"],
    total_questions: 9,
    time_limit_minutes: 20,
    question_type: "mcq",
    difficulty_preference: "balanced",
    student_level: "intermediate"
  })
});

const data = await response.json();
```

### Evaluate quiz

```ts
const response = await fetch("http://127.0.0.1:8000/api/exam-coach/evaluate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify({
    question_set_id: generated.question_set.question_set_id,
    student_answers: answers
  })
});

const data = await response.json();
```

## Important Frontend Caveats

- Always call `/api/topics` first for valid topic ids.
- Do not hardcode `selected_topic_ids: ["string"]`.
- The backend currently uses a pilot topic subset, so not every configured topic may be ingested yet.
- If `generate` returns a `400`, surface the backend message directly in dev mode.
- If `generate` returns a `503`, the likely issue is missing ingested data.
- Keep `question_set_id` after generation; evaluation depends on it.

## Suggested Frontend Types

You can mirror these shapes in TypeScript:

- `TopicApiItem`
- `TopicsResponse`
- `GenerateResponse`
- `EvaluateResponse`
- `GeneratedQuestion`
- `QuestionOption`
- `PerformanceReport`

## Developer Commands

### Start server

```powershell
C:\Users\ayush\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m uvicorn exam_coach.api:app --host 127.0.0.1 --port 8000 --reload
```

### Rebuild parsed cache

```powershell
C:\Users\ayush\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\ingest_llamaparse_cache.py
```

### Rebuild question bank

```powershell
C:\Users\ayush\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\ingest_question_bank.py
```
