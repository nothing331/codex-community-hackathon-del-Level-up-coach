"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  AttemptSession,
  AttemptStateResponse,
  buildAttemptDraftKey,
  buildChapterQuizRequest,
  buildEvaluateAttemptRequest,
  buildFullPhysicsMixRequest,
  buildStartAttemptRequest,
  ExamMode,
  EXAM_COACH_ACTIVE_ATTEMPT_KEY,
  EXAM_COACH_STORAGE_KEY,
  formatRemainingTime,
  GenerateResponse,
  getQuestionStatus,
  isExamMode,
  StartAttemptResponse,
  StoredAttemptDraft,
  StoredGeneratedQuiz,
  TimelineEvent,
} from "@/lib/exam-coach-api";

type SubmitState = "idle" | "submitting";

export function QuizWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topic");
  const modeParam = searchParams.get("mode");
  const attemptIdParam = searchParams.get("attempt");

  const [quiz, setQuiz] = useState<StoredGeneratedQuiz | null>(null);
  const [attempt, setAttempt] = useState<AttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestionEnteredAt, setCurrentQuestionEnteredAt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const autoSubmitTriggeredRef = useRef(false);

  const currentQuestion = quiz?.response.question_set.questions[currentQuestionIndex] ?? null;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const remainingSeconds = useMemo(() => {
    if (!attempt) {
      return 0;
    }
    return Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - nowMs) / 1000));
  }, [attempt, nowMs]);
  const isTimeWarning = remainingSeconds > 0 && remainingSeconds <= 60;
  const isLocked = submitState === "submitting" || remainingSeconds === 0;
  const autoSubmitAttempt = useEffectEvent(() => {
    void submitAttempt(true);
  });
  const syncAttemptState = useEffectEvent(async (isActive: () => boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      const storedQuiz = readStoredQuiz();
      const resolvedMode = resolveMode(modeParam, topicId, storedQuiz);
      const resolvedTopicId =
        resolvedMode === "chapter_quiz" ? topicId ?? storedQuiz?.topic?.topic_id ?? null : null;
      const candidateAttemptId =
        attemptIdParam ?? storedQuiz?.attempt?.attempt_id ?? readActiveAttemptId();

      if (candidateAttemptId) {
        const restored = await restoreExistingAttempt(
          candidateAttemptId,
          resolvedMode,
          resolvedTopicId,
          storedQuiz,
        );
        if (isActive()) {
          applyResolvedState(restored);
        }
        return;
      }

      if (resolvedMode === "chapter_quiz" && !resolvedTopicId) {
        throw new Error("Choose a topic from the home screen before opening the quiz page.");
      }

      const generated = await generateQuizAndAttempt(
        {
          mode: resolvedMode,
          topicId: resolvedTopicId,
        },
        storedQuiz,
      );
      if (isActive()) {
        applyResolvedState(generated);
      }
    } catch (loadError) {
      if (isActive()) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load the quiz.";
        setError(message);
      }
    } finally {
      if (isActive()) {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      void syncAttemptState(() => isActive);
    });

    return () => {
      isActive = false;
    };
  }, [attemptIdParam, modeParam, topicId]);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [attempt]);

  useEffect(() => {
    if (!attempt || !quiz) {
      return;
    }

    persistDraft({
      attemptId: attempt.attempt_id,
      topicId: topicId ?? quiz.topic?.topic_id ?? null,
      answers,
      flaggedQuestionIds,
      currentQuestionIndex,
      timelineEvents,
      activeQuestionId: currentQuestion?.question_id ?? null,
      activeQuestionEnteredAt: currentQuestionEnteredAt,
    });
  }, [
    answers,
    attempt,
    currentQuestion?.question_id,
    currentQuestionEnteredAt,
    currentQuestionIndex,
    flaggedQuestionIds,
    quiz,
    timelineEvents,
    topicId,
  ]);

  useEffect(() => {
    if (!attempt || !quiz || submitState !== "idle") {
      return;
    }

    if (remainingSeconds > 0) {
      return;
    }

    if (autoSubmitTriggeredRef.current) {
      return;
    }

    autoSubmitTriggeredRef.current = true;
    autoSubmitAttempt();
  }, [attempt, quiz, remainingSeconds, submitState]);

  function applyResolvedState(resolved: ResolvedQuizState) {
    autoSubmitTriggeredRef.current = false;
    setQuiz(resolved.quiz);
    setAttempt(resolved.attempt);
    setAnswers(resolved.answers);
    setFlaggedQuestionIds(resolved.flaggedQuestionIds);
    setTimelineEvents(resolved.timelineEvents);
    setCurrentQuestionIndex(resolved.currentQuestionIndex);
    setCurrentQuestionEnteredAt(resolved.currentQuestionEnteredAt);
    setNowMs(Date.now());
    persistStoredQuiz(resolved.quiz);
    persistActiveAttemptId(resolved.attempt.attempt_id);
    if (resolved.redirectToReport) {
      router.replace(`/report?attempt=${resolved.attempt.attempt_id}`);
    } else if (attemptIdParam !== resolved.attempt.attempt_id) {
      router.replace(buildQuizWorkspaceUrl(resolved.quiz, resolved.attempt.attempt_id));
    }
  }

  async function restoreExistingAttempt(
    attemptId: string,
    resolvedMode: ExamMode,
    resolvedTopicId: string | null,
    storedQuiz: StoredGeneratedQuiz | null,
  ): Promise<ResolvedQuizState> {
    const response = await fetch(`/api/exam-coach/attempt/${attemptId}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as AttemptStateResponse | { detail?: string };
    if (!response.ok) {
      throw new Error(readErrorDetail(payload, "Unable to restore the timed attempt."));
    }

    const attemptState = payload as AttemptStateResponse;
    if (attemptState.performance_report) {
      clearAttemptDraft(attemptId);
      clearActiveAttemptId();
      return {
        quiz:
          storedQuiz ??
          buildStoredQuizFromAttemptState(attemptState, resolvedMode, resolvedTopicId),
        attempt: attemptState.attempt,
        answers: {},
        flaggedQuestionIds: [],
        timelineEvents: [],
        currentQuestionIndex: 0,
        currentQuestionEnteredAt: null,
        redirectToReport: true,
      };
    }

    const quizToUse =
      storedQuiz ??
      buildStoredQuizFromAttemptState(attemptState, resolvedMode, resolvedTopicId);
    const draft = readAttemptDraft(attemptId);

    if (!draft) {
      const firstQuestionId = attemptState.question_set?.questions[0]?.question_id ?? null;
      return {
        quiz: quizToUse,
        attempt: attemptState.attempt,
        answers: {},
        flaggedQuestionIds: [],
        timelineEvents: firstQuestionId
          ? [{ type: "question_entered", at: new Date().toISOString(), question_id: firstQuestionId }]
          : [],
        currentQuestionIndex: 0,
        currentQuestionEnteredAt: firstQuestionId ? new Date().toISOString() : null,
      };
    }

    const restoredTimeline = reconcileTimelineOnRestore(draft);
    return {
      quiz: quizToUse,
      attempt: attemptState.attempt,
      answers: draft.answers,
      flaggedQuestionIds: draft.flaggedQuestionIds,
      timelineEvents: restoredTimeline.timelineEvents,
      currentQuestionIndex: clampQuestionIndex(
        draft.currentQuestionIndex,
        quizToUse.response.question_set.questions.length,
      ),
      currentQuestionEnteredAt: restoredTimeline.currentQuestionEnteredAt,
    };
  }

  async function generateQuizAndAttempt(
    launch: QuizLaunch,
    storedQuiz: StoredGeneratedQuiz | null,
  ): Promise<ResolvedQuizState> {
    const workingQuiz =
      storedQuiz &&
      storedQuiz.response.blueprint.mode === launch.mode &&
      (launch.mode === "full_physics_mix" || storedQuiz.topic?.topic_id === launch.topicId)
        ? storedQuiz
        : await regenerateQuiz(launch);

    const attemptResponse = await fetch("/api/exam-coach/start-attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildStartAttemptRequest(workingQuiz.response.question_set.question_set_id)),
    });

    const attemptPayload = (await attemptResponse.json()) as StartAttemptResponse | { detail?: string };
    if (!attemptResponse.ok) {
      throw new Error(readErrorDetail(attemptPayload, "Unable to start the timed attempt."));
    }

    const startedAttempt = (attemptPayload as StartAttemptResponse).attempt;
    const firstQuestionId = workingQuiz.response.question_set.questions[0]?.question_id ?? null;

    return {
      quiz: {
        ...workingQuiz,
        attempt: startedAttempt,
      },
      attempt: startedAttempt,
      answers: {},
      flaggedQuestionIds: [],
      timelineEvents: firstQuestionId
        ? [{ type: "question_entered", at: new Date().toISOString(), question_id: firstQuestionId }]
        : [],
      currentQuestionIndex: 0,
      currentQuestionEnteredAt: firstQuestionId ? new Date().toISOString() : null,
    };
  }

  async function regenerateQuiz(launch: QuizLaunch): Promise<StoredGeneratedQuiz> {
    if (launch.mode === "chapter_quiz" && !launch.topicId) {
      throw new Error("Choose a topic before generating a chapter quiz.");
    }

    const response = await fetch("/api/exam-coach/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        launch.mode === "full_physics_mix"
          ? buildFullPhysicsMixRequest()
          : buildChapterQuizRequest(launch.topicId!),
      ),
    });

    const payload = (await response.json()) as GenerateResponse | { detail?: string };

    if (!response.ok) {
      throw new Error(readErrorDetail(payload, "Unable to regenerate the quiz."));
    }

    return {
      topic:
        launch.mode === "chapter_quiz" && launch.topicId
          ? {
              topic_id: launch.topicId,
              topic_name: launch.topicId.replaceAll("-", " "),
              aliases: [],
              is_ingested: true,
              selected_files: [],
              status: "pilot_ready",
            }
          : null,
      response: payload as GenerateResponse,
    };
  }

  function navigateToQuestion(nextIndex: number) {
    if (!quiz || !currentQuestion) {
      return;
    }
    const safeIndex = clampQuestionIndex(nextIndex, quiz.response.question_set.questions.length);
    if (safeIndex === currentQuestionIndex) {
      return;
    }

    const nextQuestionId = quiz.response.question_set.questions[safeIndex]?.question_id;
    if (!nextQuestionId) {
      return;
    }

    const at = new Date().toISOString();
    setTimelineEvents((currentTimeline) => [
      ...currentTimeline,
      { type: "question_left", at, question_id: currentQuestion.question_id },
      { type: "question_entered", at, question_id: nextQuestionId },
    ]);
    setCurrentQuestionIndex(safeIndex);
    setCurrentQuestionEnteredAt(at);
  }

  function handleAnswerSelect(optionId: string) {
    if (!currentQuestion || isLocked) {
      return;
    }

    const at = new Date().toISOString();
    setAnswers((current) => ({
      ...current,
      [currentQuestion.question_id]: optionId,
    }));
    setTimelineEvents((currentTimeline) => [
      ...currentTimeline,
      {
        type: "answer_selected",
        at,
        question_id: currentQuestion.question_id,
        selected_option_id: optionId,
      },
    ]);
  }

  async function submitAttempt(autoSubmitted: boolean) {
    if (!quiz || !attempt || !currentQuestion || submitState === "submitting") {
      return;
    }

    if (!autoSubmitted) {
      const shouldSubmit = window.confirm(
        "Submit this quiz now? You will be moved to the evaluation screen and answers will lock.",
      );
      if (!shouldSubmit) {
        return;
      }
    }

    setSubmitState("submitting");
    setError(null);

    const submittedAt = new Date().toISOString();
    const finalTimelineEvents = [
      ...timelineEvents,
      { type: "question_left" as const, at: submittedAt, question_id: currentQuestion.question_id },
      {
        type: autoSubmitted ? ("auto_submitted" as const) : ("submitted" as const),
        at: submittedAt,
        question_id: currentQuestion.question_id,
      },
    ];

    setTimelineEvents(finalTimelineEvents);
    setCurrentQuestionEnteredAt(null);

    try {
      const response = await fetch("/api/exam-coach/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          buildEvaluateAttemptRequest(
            quiz.response.question_set,
            attempt.attempt_id,
            answers,
            finalTimelineEvents,
            autoSubmitted,
            submittedAt,
          ),
        ),
      });

      const payload = (await response.json()) as { detail?: string };
      if (!response.ok) {
        throw new Error(readErrorDetail(payload, "Unable to submit the timed attempt."));
      }

      clearAttemptDraft(attempt.attempt_id);
      clearActiveAttemptId();
      router.replace(`/report?attempt=${attempt.attempt_id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to submit the timed attempt.";
      setError(message);
      setSubmitState("idle");
      if (autoSubmitted) {
        autoSubmitTriggeredRef.current = false;
      }
    }
  }

  if (isLoading) {
    return (
      <section className="surface rounded-[28px] p-6 md:p-8">
        <p className="eyebrow text-signal">
          Loading quiz
        </p>
        <h3 className="section-title mt-4 text-foreground">
          Restoring your timed attempt.
        </h3>
      </section>
    );
  }

  if (error || !quiz || !attempt || !currentQuestion) {
    return (
      <section className="surface rounded-[28px] p-6 md:p-8">
        <p className="eyebrow text-[#b38911]">
          Quiz unavailable
        </p>
        <h3 className="section-title mt-4 text-foreground">
          {error ?? "The quiz could not be loaded."}
        </h3>
        <Link
          href="/"
          className="btn-primary mt-6"
        >
          Return to topic selection
        </Link>
      </section>
    );
  }

  const totalQuestions = quiz.response.question_set.questions.length;
  const currentAnswer = answers[currentQuestion.question_id];
  return (
    <section className="grid gap-6">
      <section className="surface rounded-[24px] p-5 md:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="panel-subtle rounded-[16px] p-4">
            <p className="body-compact text-muted">Time remaining</p>
            <p
              className={`metric-value mt-2 ${
                isTimeWarning ? "text-[#b38911]" : "text-foreground"
              }`}
            >
              {formatRemainingTime(remainingSeconds)}
            </p>
            <p className="body-compact mt-2 text-ink-soft">
              {isTimeWarning ? "Last minute. The quiz will auto-submit at zero." : "Backend timer is authoritative."}
            </p>
          </div>
          <div className="panel-subtle rounded-[16px] p-4">
            <p className="body-compact text-muted">Progress</p>
            <p className="metric-value mt-2 text-foreground">
              {answeredCount} / {totalQuestions}
            </p>
            <p className="body-compact mt-2 text-ink-soft">
              {flaggedQuestionIds.length} flagged for review
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <article className="surface rounded-[30px] p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="eyebrow text-signal">
              Question {currentQuestionIndex + 1} / {totalQuestions}
            </p>
            <h3 className="section-title mt-3 text-foreground">
              {currentQuestion.stem}
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* <span className="status-pill text-muted">
              {currentQuestion.difficulty_label}
            </span> */}
            {/* <button
              type="button"
              disabled={isLocked}
              onClick={handleFlagToggle}
              className={`${currentQuestionIsFlagged ? "btn-warm" : "btn-secondary"} ${isLocked ? "cursor-not-allowed opacity-55" : ""}`}
            >
              {currentQuestionIsFlagged ? "Flagged" : "Flag question"}
            </button> */}
          </div>
        </div>

        <div className="grid gap-3">
          {currentQuestion.options.map((option, optionIndex) => {
            const active = currentAnswer === option.option_id;

            return (
              <button
                key={option.option_id}
                type="button"
                onClick={() => handleAnswerSelect(option.option_id)}
                disabled={isLocked}
                className={`rounded-[24px] border px-5 py-4 text-left ${
                  active
                    ? "border-[#335eea] bg-[#335eea] text-white shadow-[0_16px_32px_rgba(51,94,234,0.28)]"
                    : "border-[#506690] bg-[#506690] text-white hover:border-[#335eea] hover:bg-[#5b719c]"
                } ${isLocked ? "cursor-not-allowed opacity-65" : ""}`}
              >
                <span className="mr-3 inline-flex size-8 items-center justify-center rounded-full border border-current/20 font-mono text-[12px] leading-[16px]">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="body-compact">{option.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => navigateToQuestion(currentQuestionIndex - 1)}
            disabled={isLocked || currentQuestionIndex === 0}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void submitAttempt(false)}
              disabled={submitState === "submitting"}
              className="btn-warm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitState === "submitting" ? "Submitting..." : "Submit quiz"}
            </button>
            <button
              type="button"
              onClick={() => navigateToQuestion(currentQuestionIndex + 1)}
              disabled={isLocked || currentQuestionIndex === totalQuestions - 1}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next question
            </button>
          </div>
        </div>
        </article>

        <aside className="grid gap-6 lg:sticky lg:top-6 lg:self-start">
        <section className="surface rounded-[30px] p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="eyebrow text-muted">Question palette</p>
            <span className="body-compact text-ink-soft">Resume-safe</span>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {quiz.response.question_set.questions.map((question, index) => {
              const status = getQuestionStatus(
                question.question_id,
                answers,
                flaggedQuestionIds,
                currentQuestion.question_id,
              );

              return (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => navigateToQuestion(index)}
                  disabled={submitState === "submitting"}
                  className={`min-h-10 rounded-[16px] border px-2 py-2 text-[14px] leading-[20px] font-semibold ${
                    status === "current"
                      ? "border-[#335eea] bg-[#335eea] text-white shadow-[0_12px_24px_rgba(51,94,234,0.24)]"
                      : status === "answered"
                        ? "border-[#335eea] bg-[rgba(51,94,234,0.22)] text-white"
                        : status === "flagged"
                          ? "border-[#335eea] bg-[rgba(51,94,234,0.14)] text-white"
                          : "border-[#506690] bg-[#506690] text-white"
                  } ${submitState === "submitting" ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>

        <section className="surface rounded-[30px] p-6">
          <p className="eyebrow text-[#b38911]">
            Instructions
          </p>
          <p className="body-copy mt-4 text-ink-soft">
            {quiz.response.question_set.instructions}
          </p>
          {error ? <p className="body-compact mt-4 text-[#b38911]">{error}</p> : null}
        </section>
        </aside>
      </div>
    </section>
  );
}

type ResolvedQuizState = {
  quiz: StoredGeneratedQuiz;
  attempt: AttemptSession;
  answers: Record<string, string>;
  flaggedQuestionIds: string[];
  timelineEvents: TimelineEvent[];
  currentQuestionIndex: number;
  currentQuestionEnteredAt: string | null;
  redirectToReport?: boolean;
};

type QuizLaunch = {
  mode: ExamMode;
  topicId: string | null;
};

function readStoredQuiz() {
  const rawValue = sessionStorage.getItem(EXAM_COACH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredGeneratedQuiz;
  } catch {
    sessionStorage.removeItem(EXAM_COACH_STORAGE_KEY);
    return null;
  }
}

function persistStoredQuiz(quiz: StoredGeneratedQuiz) {
  sessionStorage.setItem(EXAM_COACH_STORAGE_KEY, JSON.stringify(quiz));
}

function readActiveAttemptId() {
  return localStorage.getItem(EXAM_COACH_ACTIVE_ATTEMPT_KEY);
}

function persistActiveAttemptId(attemptId: string) {
  localStorage.setItem(EXAM_COACH_ACTIVE_ATTEMPT_KEY, attemptId);
}

function clearActiveAttemptId() {
  localStorage.removeItem(EXAM_COACH_ACTIVE_ATTEMPT_KEY);
}

function readAttemptDraft(attemptId: string) {
  const rawValue = localStorage.getItem(buildAttemptDraftKey(attemptId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAttemptDraft;
  } catch {
    localStorage.removeItem(buildAttemptDraftKey(attemptId));
    return null;
  }
}

function persistDraft(input: {
  attemptId: string;
  topicId: string | null;
  answers: Record<string, string>;
  flaggedQuestionIds: string[];
  currentQuestionIndex: number;
  timelineEvents: TimelineEvent[];
  activeQuestionId: string | null;
  activeQuestionEnteredAt: string | null;
}) {
  const payload: StoredAttemptDraft = {
    attemptId: input.attemptId,
    topicId: input.topicId,
    answers: input.answers,
    flaggedQuestionIds: input.flaggedQuestionIds,
    currentQuestionIndex: input.currentQuestionIndex,
    timelineEvents: input.timelineEvents,
    activeQuestionId: input.activeQuestionId,
    activeQuestionEnteredAt: input.activeQuestionEnteredAt,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(buildAttemptDraftKey(input.attemptId), JSON.stringify(payload));
}

function clearAttemptDraft(attemptId: string) {
  localStorage.removeItem(buildAttemptDraftKey(attemptId));
}

function resolveMode(
  modeParam: string | null,
  topicId: string | null,
  storedQuiz: StoredGeneratedQuiz | null,
): ExamMode {
  if (isExamMode(modeParam)) {
    return modeParam;
  }

  if (isExamMode(storedQuiz?.response.blueprint.mode)) {
    return storedQuiz.response.blueprint.mode;
  }

  return topicId ? "chapter_quiz" : "full_physics_mix";
}

function buildQuizWorkspaceUrl(quiz: StoredGeneratedQuiz, attemptId: string) {
  const params = new URLSearchParams({
    mode: quiz.response.blueprint.mode,
    attempt: attemptId,
  });

  if (quiz.response.blueprint.mode === "chapter_quiz" && quiz.topic?.topic_id) {
    params.set("topic", quiz.topic.topic_id);
  }

  return `/test?${params.toString()}`;
}

function buildStoredQuizFromAttemptState(
  attemptState: AttemptStateResponse,
  resolvedMode: ExamMode,
  fallbackTopicId: string | null,
): StoredGeneratedQuiz {
  const attemptMode = isExamMode(attemptState.question_set?.meta.mode)
    ? attemptState.question_set.meta.mode
    : resolvedMode;
  const selectedTopicIds =
    attemptState.question_set?.questions.map((question) => question.topic_id) ??
    (fallbackTopicId ? [fallbackTopicId] : []);
  const chapterTopicId =
    fallbackTopicId ??
    attemptState.question_set?.questions[0]?.topic_id ??
    (selectedTopicIds[0] ?? "physics");

  return {
    topic:
      attemptMode === "chapter_quiz"
        ? {
            topic_id: chapterTopicId,
            topic_name: chapterTopicId.replaceAll("-", " "),
            aliases: [],
            is_ingested: true,
            selected_files: [],
            status: "pilot_ready",
          }
        : null,
    response: {
      blueprint: {
        blueprint_id: attemptState.question_set?.blueprint_id ?? "blueprint-restored",
        mode: attemptMode,
        subject: "JEE Physics",
        selected_topic_ids: attemptMode === "chapter_quiz" ? [chapterTopicId] : selectedTopicIds,
        total_questions: attemptState.question_set?.questions.length ?? 0,
        time_limit_minutes: Math.max(1, Math.round(attemptState.attempt.duration_seconds / 60)),
        question_type: "mcq",
        created_at: attemptState.attempt.started_at,
      },
      question_set:
        attemptState.question_set ?? {
          question_set_id: attemptState.attempt.question_set_id,
          blueprint_id: "blueprint-restored",
          instructions: "",
          questions: [],
          meta: {
            mode: attemptMode,
            total_questions: 0,
            ordering_rule: "hard_to_easy",
            generation_mode: "fallback",
          },
        },
    },
    attempt: attemptState.attempt,
  };
}

function reconcileTimelineOnRestore(draft: StoredAttemptDraft) {
  const now = new Date().toISOString();
  if (!draft.activeQuestionId || !draft.activeQuestionEnteredAt) {
    return {
      timelineEvents: draft.timelineEvents,
      currentQuestionEnteredAt: null,
    };
  }

  const timelineEvents = [...draft.timelineEvents];
  const lastEvent = timelineEvents.at(-1);
  if (lastEvent?.type !== "question_left" && lastEvent?.type !== "submitted" && lastEvent?.type !== "auto_submitted") {
    timelineEvents.push({
      type: "question_left",
      at: draft.savedAt,
      question_id: draft.activeQuestionId,
    });
  }
  timelineEvents.push({
    type: "question_entered",
    at: now,
    question_id: draft.activeQuestionId,
  });

  return {
    timelineEvents,
    currentQuestionEnteredAt: now,
  };
}

function clampQuestionIndex(index: number, questionCount: number) {
  if (questionCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), questionCount - 1);
}

function readErrorDetail(
  payload:
    | GenerateResponse
    | StartAttemptResponse
    | AttemptStateResponse
    | { detail?: string },
  fallback: string,
) {
  if ("detail" in payload && payload.detail) {
    return payload.detail;
  }

  return fallback;
}
