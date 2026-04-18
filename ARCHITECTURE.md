# AI Exam Intelligence System for JEE / Boards

## Architecture and Demo Build Plan

This document defines the technical architecture, product scope, UI direction, and implementation strategy for a hackathon-ready demo of:

**AI Exam Intelligence System for JEE / Boards**

Working product positioning:

**"AI Exam Coach"**

Not just a quiz generator, but an exam strategy system that:

- generates a test from a subject, syllabus, or PDF
- evaluates answers and time behavior
- identifies weak topics and exam habits
- produces a targeted improvement plan

This architecture is optimized for:

- a strong 5-hour demo build
- clear separation of AI and non-AI logic
- low implementation risk
- a UI that feels premium and intentional

---

## 1. Product Goal

The core product problem is not "students need more questions."

The real problem is:

- students do not know where they are weak
- students do not know how their exam behavior affects score
- students do not have a strategy loop after taking a test

So the product must move from:

**Upload PDF -> Generate questions -> Show score**

to:

**Input study context -> Generate realistic mock -> Capture attempt behavior -> Diagnose weaknesses -> Recommend action plan**

That shift is what makes the product demo-worthy.

---

## 2. Demo Goal

In the first version, the app should convincingly demonstrate one complete coaching cycle.

### Demo Input

The user can:

- select `JEE Physics`
- optionally choose a chapter like `Mechanics` or `Electrostatics`
- optionally upload a syllabus/PDF for topic extraction

### Demo Output

The system should:

1. generate a short JEE-style mock test
2. allow the user to attempt questions with timing
3. score the attempt
4. identify topic weakness and timing patterns
5. generate a coaching report and next-step action plan

### What must feel impressive

The wow moment is not question generation.

The wow moment is when the report says things like:

- "You are strong in Mechanics but weak in Electrostatics."
- "Accuracy drops after the sixth question."
- "You spend too much time on high-difficulty problems."
- "You should skip after 2 minutes and revisit later."

---

## 3. System Design Principle

The architecture should use AI where reasoning and language help, and use normal code where determinism is important.

### AI should handle

- parsing a syllabus or subject into structured exam context
- producing a test blueprint
- generating questions and explanations
- converting analytics into a coaching narrative

### Code should handle

- timing
- answer capture
- scoring
- topic aggregation
- accuracy calculation
- difficulty analysis
- performance trend detection
- rendering UI state

This split is critical because fully AI-driven scoring and analytics will feel unstable and harder to trust.

---

## 4. Recommended Stack

The project should be built as a single Next.js application with server-side AI orchestration.

| Part | Recommended Stack | Why It Is Needed |
|---|---|---|
| App framework | Next.js App Router + TypeScript | One codebase for UI, server routes, and orchestration. Fastest path to ship a full-stack demo. |
| Styling | Tailwind CSS | Fast iteration, consistent spacing system, easy responsive design. |
| UI primitives | shadcn/ui | Good base components when needed, but still editable and easy to customize. |
| AI layer | OpenAI Responses API | Best fit for structured generation, reasoning, and future agent-like workflows. |
| Structured outputs | JSON schema validation with Zod | Keeps agent outputs predictable and safe to render. |
| PDF processing | PDF.js or extracted plain text | Useful for syllabus ingestion in demo scope without heavy backend complexity. |
| Charts | Recharts | Fast and clean visualizations for topic accuracy and timing trends. |
| State | Local React state first, Zustand only if needed | Keeps the first build simple and avoids unnecessary architecture. |
| Deployment | Vercel | Fastest deployment path for a Next.js demo. |
| Persistence | None initially, optional Supabase later | Avoids spending demo time on auth/database work. |

### Deliberate non-choices for v1

Do not use these in the first 5-hour version unless a real need appears:

- LangChain
- LangGraph
- separate Express or FastAPI backend
- vector database or RAG
- authentication
- multi-user account system
- background job infrastructure

These may sound "advanced," but they reduce demo speed and increase failure points.

---

## 5. High-Level Architecture

The application should be a monolith with clear internal modules.

```text
User Interface (Next.js App)
    ->
Route Handler / Server Action
    ->
Exam Flow Orchestrator
    ->
    1. Curriculum Agent
    2. Blueprint Agent
    3. Question Agent
    4. Evaluation Engine
    5. Coach Agent
    ->
Structured JSON response
    ->
UI report rendering
```

### Why this architecture works

- simple enough for a hackathon
- still feels agentic
- each step can be tested independently
- fallback content can be inserted if any AI step fails

---

## 6. What "Agentic" Means in This Project

For this demo, "agents" should not mean a complex autonomous multi-tool framework.

It should mean:

- separate reasoning steps
- each step has a narrow responsibility
- each step returns structured output
- an orchestrator stitches them together

This is the right level of agentic complexity for a demo.

### Proposed agents

#### 1. Curriculum Agent

Purpose:

- read selected subject, chapter, or syllabus text
- extract topics and exam context

Input:

- subject selection
- optional chapter
- optional PDF text

Output:

- normalized subject
- exam type
- topic list
- inferred focus areas
- source confidence

#### 2. Blueprint Agent

Purpose:

- design the test before questions are written

Output:

- number of questions
- topic distribution
- difficulty distribution
- total expected time
- JEE-style pattern notes

#### 3. Question Agent

Purpose:

- generate question set from the blueprint

Output:

- MCQs with topic, difficulty, explanation, correct option, expected solve time

#### 4. Evaluation Engine

Purpose:

- calculate all deterministic metrics from user attempt data

This is not an LLM. This should be pure code.

#### 5. Coach Agent

Purpose:

- convert evaluation metrics into a personalized improvement report

Output:

- strengths
- weaknesses
- time-management observations
- next-step practice plan
- short motivational summary

---

## 7. Core Application Flows

## 7.1 Test Creation Flow

```text
User selects subject or uploads syllabus
    ->
Curriculum Agent extracts topics
    ->
Blueprint Agent defines the exam structure
    ->
Question Agent generates structured MCQs
    ->
Questions are shown in the test UI
```

## 7.2 Attempt Evaluation Flow

```text
User submits answers and timing data
    ->
Evaluation Engine computes metrics
    ->
Coach Agent explains the results
    ->
Report page renders performance + strategy + action plan
```

## 7.3 Fallback Flow

If AI generation fails:

- use prebuilt question bank for `JEE Physics`
- continue scoring and reporting normally

This fallback is important because the demo should never fail at the question generation step.

---

## 8. Project Folder Structure

Recommended structure:

```text
app/
  page.tsx
  generate/page.tsx
  test/page.tsx
  report/page.tsx
  api/
    exam/
      generate/route.ts
    exam/
      evaluate/route.ts

components/
  layout/
  exam/
  report/
  charts/
  ui/

lib/
  ai/
    client.ts
    prompts.ts
    schemas.ts
    curriculum-agent.ts
    blueprint-agent.ts
    question-agent.ts
    coach-agent.ts
  exam/
    exam-flow.ts
    evaluation-engine.ts
    fallback-bank.ts
    topic-utils.ts
  pdf/
    extract-text.ts
  utils/
    format.ts
    constants.ts

public/
  demo-assets/

styles/
  globals.css
```

### Why this structure is useful

- AI logic is isolated
- evaluation logic remains clean and testable
- UI can evolve without breaking backend flow
- fallback content is easy to maintain

---

## 9. Data Contracts

The first thing to define in implementation should be the JSON contracts between modules.

Without stable schemas, agent outputs become hard to trust.

## 9.1 Curriculum Output

```json
{
  "subject": "JEE Physics",
  "examType": "JEE Main",
  "topics": [
    {
      "name": "Mechanics",
      "weight": 0.4
    },
    {
      "name": "Electrostatics",
      "weight": 0.35
    },
    {
      "name": "Modern Physics",
      "weight": 0.25
    }
  ],
  "focusArea": "Electrostatics",
  "notes": "Derived from user-selected subject and syllabus hints"
}
```

## 9.2 Test Blueprint

```json
{
  "examType": "JEE Main",
  "subject": "Physics",
  "questionCount": 10,
  "durationMinutes": 18,
  "difficultyMix": {
    "easy": 3,
    "medium": 5,
    "hard": 2
  },
  "topicDistribution": [
    {
      "topic": "Mechanics",
      "count": 4
    },
    {
      "topic": "Electrostatics",
      "count": 4
    },
    {
      "topic": "Modern Physics",
      "count": 2
    }
  ]
}
```

## 9.3 Question Set

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "A charged particle moves in a uniform electric field...",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswer": "B",
      "explanation": "The correct approach applies electric force and kinematics.",
      "topic": "Electrostatics",
      "difficulty": "medium",
      "expectedTimeSec": 90
    }
  ]
}
```

## 9.4 Attempt Submission

```json
{
  "attemptId": "demo-attempt-1",
  "answers": [
    {
      "questionId": "q1",
      "selectedAnswer": "C",
      "timeSpentSec": 124,
      "visitedCount": 2
    }
  ]
}
```

## 9.5 Evaluation Output

```json
{
  "score": 5,
  "totalQuestions": 10,
  "accuracy": 0.5,
  "topicBreakdown": [
    {
      "topic": "Mechanics",
      "attempted": 4,
      "correct": 3,
      "accuracy": 0.75
    },
    {
      "topic": "Electrostatics",
      "attempted": 4,
      "correct": 1,
      "accuracy": 0.25
    }
  ],
  "difficultyBreakdown": [
    {
      "difficulty": "hard",
      "attempted": 2,
      "correct": 0,
      "averageTimeSec": 168
    }
  ],
  "timeMetrics": {
    "averageTimePerQuestionSec": 92,
    "slowestQuestionId": "q7",
    "lateStageAccuracyDrop": true
  },
  "behaviorFlags": [
    "overinvests_in_hard_questions",
    "accuracy_drops_late",
    "strong_in_mechanics",
    "weak_in_electrostatics"
  ]
}
```

## 9.6 Coach Report

```json
{
  "headline": "Strong conceptual base, but weak conversion under pressure",
  "strengths": [
    "You are solving Mechanics questions accurately."
  ],
  "weaknesses": [
    "Electrostatics needs more medium-level practice."
  ],
  "timeStrategy": [
    "Do not spend more than 2 minutes on hard questions in the first pass."
  ],
  "actionPlan": [
    "Practice 10 Electrostatics questions daily for 3 days.",
    "Revise core formulas before mock attempts.",
    "Use a skip-and-return strategy during timed sections."
  ],
  "motivation": "Your fundamentals are present. Better selection and pacing can raise your score quickly."
}
```

---

## 10. Evaluation Engine Design

This is the most important non-AI system in the product.

The evaluation engine should calculate reliable metrics that the coach agent can explain.

### Metrics to compute

- total score
- attempted vs unattempted
- accuracy by topic
- accuracy by difficulty
- average time per question
- time spent on wrong answers
- time spent on hard questions
- first-half vs second-half accuracy
- slowest topic
- most error-prone topic

### Behavior signals to infer

- spends too long on hard questions
- gets easier questions wrong late in the test
- has strong accuracy in one topic
- skips too little
- revisits too often without improvement

### Why this matters

This converts the product from a quiz app into a performance intelligence tool.

The coach agent should not invent these patterns. It should receive them from code.

---

## 11. Prompt Strategy

Each AI step should be narrow and structured.

## 11.1 Curriculum Agent Prompt Goal

Extract exam context and topics from:

- subject selection
- optional chapter
- optional syllabus text

Rules:

- normalize topic names
- keep output concise
- return only structured JSON

## 11.2 Blueprint Agent Prompt Goal

Create a test plan from curriculum data.

Rules:

- honor question count
- honor difficulty mix
- honor exam pattern
- distribute topics logically

## 11.3 Question Agent Prompt Goal

Generate questions from the blueprint.

Rules:

- one correct option only
- clear wording
- topic and difficulty tags required
- explanation required
- avoid duplicates

## 11.4 Coach Agent Prompt Goal

Transform analytics into feedback a student can act on.

Rules:

- mention strong topic
- mention weak topic
- mention time behavior
- give a short action plan
- avoid generic advice

---

## 12. Fallback and Reliability Strategy

Hackathon demos fail when they depend on perfect live AI generation.

So the architecture must include fallback behavior.

### Required fallback

Maintain a small hardcoded question bank for:

- JEE Physics
- Mechanics
- Electrostatics
- Modern Physics

### Fallback triggers

Use fallback if:

- AI response is invalid JSON
- schema validation fails
- request takes too long
- duplicate or low-quality questions are produced

### Why it matters

If question generation fails and the demo stops, the product feels fragile.

If fallback silently loads a usable test, the demo still succeeds.

---

## 13. UI Direction

This section uses the `frontend-skill` design thinking so the app feels distinctive and demo-ready.

The product should not look like:

- a generic dashboard made of many cards
- a white page with random gradients
- a quiz app template

The product should feel like:

**an exam command center**

calm, focused, high-stakes, intelligent

## 13.1 Visual Thesis

A disciplined "exam war-room" interface with restrained dark graphite surfaces, one sharp signal color, strong typography, and a central workspace that makes performance analysis feel serious and high-value.

## 13.2 Content Plan

The product flow should have four main surfaces:

1. entry surface
2. test workspace
3. live attempt state
4. performance intelligence report

Each screen should have one job.

### Entry Surface

Job:

- choose subject or upload syllabus/PDF
- establish exam mode fast

### Test Workspace

Job:

- focus on questions
- show time clearly
- reduce distractions

### Submission Transition

Job:

- create anticipation
- briefly show that the system is evaluating strategy, not just score

### Report Surface

Job:

- make the diagnosis unforgettable
- show weakness, time behavior, and next steps clearly

## 13.3 Interaction Thesis

The UI should use 3 intentional motions:

1. a measured entrance reveal for the initial workspace
2. a progress/timer motion that reinforces exam pressure
3. a staged report reveal where strengths, weaknesses, and action plan appear in sequence

Motion should feel controlled, not playful.

---

## 14. UI Layout Recommendations

## 14.1 Entry Screen

The first screen should not be a marketing landing page.

It should behave like a product surface.

### Layout

- left or top section: product identity and short promise
- main center: subject selector and upload action
- lower support: exam modes or chapters

### Messaging

Keep copy short:

- Product name: `Level Up Coach`
- Headline: `Turn mock tests into score strategy.`
- Support line: `Generate a JEE-style test, measure your decisions, and get a plan for what to fix next.`

### Visual direction

- dominant heading
- one strong accent line or divider
- no stat-strip clutter
- no row of decorative feature cards

## 14.2 Test Screen

This is the most important workspace screen.

### Layout recommendation

- left: question text and options
- right: timer, progress, topic label, navigation list

On mobile:

- timer fixed at top
- question area below
- navigation collapses into a sheet or compact strip

### Important UX elements

- visible countdown or elapsed time
- progress indicator like `Question 4 / 10`
- clear selected option state
- next/previous navigation
- submit button with confirmation

### Style rules

- keep the question region open and spacious
- avoid boxing every region
- use dividers and spacing instead of many cards
- use the accent color only for active and critical states

## 14.3 Evaluation Transition Screen

This can be a short in-between state after submission.

Example copy:

- `Analyzing topic accuracy`
- `Checking time-pressure patterns`
- `Building your strategy report`

This helps the product feel deeper than "score instantly generated."

## 14.4 Report Screen

This is the signature screen.

### Structure

- top hero statement: one diagnostic headline
- next: score and exam summary
- next: topic strength/weakness chart
- next: time behavior insights
- next: coaching recommendations
- final: next test CTA

### Strong layout idea

The report should open with a large statement such as:

`Mechanics is carrying you. Electrostatics is costing you marks.`

That headline creates emotional clarity immediately.

### Report sections

#### Section 1: Diagnostic headline

One sentence that summarizes the student's state.

#### Section 2: Performance snapshot

- score
- attempted count
- average time
- strongest topic
- weakest topic

#### Section 3: Topic intelligence

- horizontal bars or radar-like view
- topic accuracy comparison

#### Section 4: Exam behavior

- late-stage drop
- hard-question time waste
- pacing suggestions

#### Section 5: Action plan

- what to practice
- how much to practice
- what exam behavior to change

#### Section 6: Retake CTA

- `Generate next mock`
- `Focus on Electrostatics`

---

## 15. UI Design Tokens

These are starting design recommendations, not strict final values.

## 15.1 Color Direction

- Background: near-black graphite
- Surface: slightly lifted charcoal
- Primary text: warm off-white
- Secondary text: muted gray
- Accent: electric cyan or acid lime, choose one only
- Danger/weakness: muted red-orange
- Success/strength: muted teal

Recommended principle:

- one primary accent only
- charts can use strength/weakness colors, but the interface should not become rainbow-heavy

## 15.2 Typography

Use two type styles max:

- Display/headline: `Space Grotesk` or `Sora`
- UI/body: `Inter` or `IBM Plex Sans`

This gives the app a sharper identity while keeping readability high.

## 15.3 Spacing

The app should feel intentional through spacing, not decoration.

- wide page margins on desktop
- dense but readable content zones
- generous question text line height
- clear vertical rhythm between report sections

## 15.4 Surfaces

Avoid cards by default.

Prefer:

- sections
- subtle separators
- soft background planes
- sticky side context in the test screen

Cards should only exist when they support one focused action.

---

## 16. Feature Prioritization for a 5-Hour Build

## Must Have

- subject selection
- hardcoded or AI-generated 8-10 question test
- answer capture
- time tracking
- scoring
- topic-wise analysis
- coaching report

## Good to Have

- PDF upload and topic extraction
- charts
- staged animated report reveal
- fallback question bank

## Skip for Now

- authentication
- saved history
- leaderboard
- real adaptive difficulty engine
- multi-subject dashboard
- advanced analytics persistence

---

## 17. 5-Hour Build Order

## Hour 1

Create the app shell and core schemas.

Build:

- project setup
- Tailwind and base theme
- schema definitions
- route structure

## Hour 2

Build the test generation flow.

Build:

- curriculum step
- blueprint step
- question generation or fallback bank

## Hour 3

Build the test-taking flow.

Build:

- question UI
- timer
- answer state
- submit flow

## Hour 4

Build deterministic evaluation.

Build:

- score logic
- topic analysis
- time analysis
- behavior flags

## Hour 5

Build the report UI and polish the demo.

Build:

- report narrative
- charts or bars
- action plan
- transitions
- final copy cleanup

---

## 18. Future Expansion After Demo

After the demo, the architecture can grow into:

- persistent student profiles
- mock history and trend tracking
- chapter mastery graph
- adaptive test generation
- spaced revision plans
- weekly coaching reports
- RAG over full syllabus and previous papers
- teacher dashboard

These should be phase-two features, not part of the first demo scope.

---

## 19. Final Architecture Decision

### Final stack choice

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenAI Responses API
- Zod schemas
- PDF.js for basic PDF text handling
- Recharts for report visuals
- Vercel for deployment

### Final product structure

Build the project as one full-stack app with:

- a clean orchestration layer for AI steps
- a deterministic evaluation engine
- a premium report-first UI

### Final product positioning

The product should be presented as:

**AI Exam Coach**

not:

**AI Quiz Generator**

That difference should be visible in both the architecture and the UI.

---

## 20. Implementation Note

When coding starts, the first files to create should be:

1. `lib/ai/schemas.ts`
2. `lib/ai/prompts.ts`
3. `lib/exam/evaluation-engine.ts`
4. `lib/exam/exam-flow.ts`
5. `app/page.tsx`
6. `app/test/page.tsx`
7. `app/report/page.tsx`

These will establish the backbone of the project before any optional complexity is added.
