import type {
  AttemptAnswer,
  AttemptEvent,
  AttemptSubmission,
  QuestionVisitWindow,
} from "../ai/schemas";

interface MutableQuestionState {
  questionId: string;
  selectedAnswer: string | null;
  visitedCount: number;
  answerChangedCount: number;
  firstAnswerAtMs: number | null;
  lastAnswerAtMs: number | null;
  activeEnteredAtMs: number | null;
  visitWindows: QuestionVisitWindow[];
}

export interface AttemptTracker {
  attemptId: string;
  startedAtMs: number;
  questionOrder: string[];
  timeline: AttemptEvent[];
  currentQuestionId: string | null;
  lastQuestionLeftAtMs: number | null;
  questionState: Map<string, MutableQuestionState>;
}

export function createAttemptTracker(input: {
  attemptId: string;
  questionOrder: string[];
  startedAtMs?: number;
}): AttemptTracker {
  const state = new Map<string, MutableQuestionState>();

  input.questionOrder.forEach((questionId) => {
    state.set(questionId, {
      questionId,
      selectedAnswer: null,
      visitedCount: 0,
      answerChangedCount: 0,
      firstAnswerAtMs: null,
      lastAnswerAtMs: null,
      activeEnteredAtMs: null,
      visitWindows: [],
    });
  });

  return {
    attemptId: input.attemptId,
    startedAtMs: input.startedAtMs ?? Date.now(),
    questionOrder: input.questionOrder,
    timeline: [],
    currentQuestionId: null,
    lastQuestionLeftAtMs: null,
    questionState: state,
  };
}

export function enterQuestion(
  tracker: AttemptTracker,
  questionId: string,
  atMs = Date.now(),
): void {
  if (tracker.currentQuestionId === questionId) {
    return;
  }

  if (tracker.currentQuestionId) {
    leaveQuestion(tracker, tracker.currentQuestionId, atMs, "navigator");
  }

  const question = getQuestionState(tracker, questionId);
  const gapBeforeEnterSec = tracker.lastQuestionLeftAtMs !== null
    ? roundToSeconds((atMs - tracker.lastQuestionLeftAtMs) / 1000)
    : 0;

  question.visitedCount += 1;
  question.activeEnteredAtMs = atMs;
  question.visitWindows.push({
    enteredAtMs: atMs,
    leftAtMs: atMs,
    activeTimeSec: 0,
    gapBeforeEnterSec,
  });

  tracker.currentQuestionId = questionId;
  tracker.timeline.push({
    type: "question_entered",
    atMs,
    questionId,
  });
}

export function selectAnswer(
  tracker: AttemptTracker,
  questionId: string,
  selectedAnswer: string,
  atMs = Date.now(),
): void {
  const question = getQuestionState(tracker, questionId);

  if (question.selectedAnswer && question.selectedAnswer !== selectedAnswer) {
    question.answerChangedCount += 1;
  }

  if (question.firstAnswerAtMs === null) {
    question.firstAnswerAtMs = atMs;
  }

  question.lastAnswerAtMs = atMs;
  question.selectedAnswer = selectedAnswer;

  tracker.timeline.push({
    type: "answer_selected",
    atMs,
    questionId,
    selectedAnswer,
  });
}

export function leaveQuestion(
  tracker: AttemptTracker,
  questionId: string,
  atMs = Date.now(),
  transitionReason: AttemptEvent["transitionReason"] = "next",
): void {
  const question = getQuestionState(tracker, questionId);

  if (question.activeEnteredAtMs === null || question.visitWindows.length === 0) {
    return;
  }

  const lastVisit = question.visitWindows[question.visitWindows.length - 1];
  lastVisit.leftAtMs = atMs;
  lastVisit.activeTimeSec = roundToSeconds((atMs - question.activeEnteredAtMs) / 1000);

  question.activeEnteredAtMs = null;
  tracker.currentQuestionId = null;
  tracker.lastQuestionLeftAtMs = atMs;

  tracker.timeline.push({
    type: "question_left",
    atMs,
    questionId,
    transitionReason,
  });
}

export function submitAttempt(tracker: AttemptTracker, submittedAtMs = Date.now()): AttemptSubmission {
  if (tracker.currentQuestionId) {
    leaveQuestion(tracker, tracker.currentQuestionId, submittedAtMs, "submit");
  }

  tracker.timeline.push({
    type: "submitted",
    atMs: submittedAtMs,
  });

  const answers = tracker.questionOrder.map((questionId) => {
    const question = getQuestionState(tracker, questionId);
    return finalizeAnswer(question);
  });

  return {
    attemptId: tracker.attemptId,
    startedAtMs: tracker.startedAtMs,
    submittedAtMs,
    questionOrder: tracker.questionOrder,
    answers,
    timeline: tracker.timeline.slice(),
  };
}

function finalizeAnswer(question: MutableQuestionState): AttemptAnswer {
  const totalTimeSpentSec = roundToSeconds(
    question.visitWindows.reduce((sum, window) => sum + window.activeTimeSec, 0),
  );
  const gaps = question.visitWindows.map((window) => window.gapBeforeEnterSec);
  const firstVisit = question.visitWindows[0];
  const lastVisit = question.visitWindows[question.visitWindows.length - 1];

  const timeToFirstAnswerSec =
    question.firstAnswerAtMs !== null && firstVisit
      ? roundToSeconds((question.firstAnswerAtMs - firstVisit.enteredAtMs) / 1000)
      : null;

  const timeAfterLastAnswerSec =
    question.lastAnswerAtMs !== null && lastVisit
      ? roundToSeconds((lastVisit.leftAtMs - question.lastAnswerAtMs) / 1000)
      : null;

  return {
    questionId: question.questionId,
    selectedAnswer: question.selectedAnswer,
    timeSpentSec: totalTimeSpentSec,
    visitedCount: question.visitedCount,
    answerChangedCount: question.answerChangedCount,
    timeToFirstAnswerSec,
    timeAfterLastAnswerSec,
    averageGapBeforeVisitSec: gaps.length ? roundToSeconds(average(gaps)) : 0,
    maxGapBeforeVisitSec: gaps.length ? Math.max(...gaps) : 0,
    visitWindows: question.visitWindows,
  };
}

function getQuestionState(tracker: AttemptTracker, questionId: string): MutableQuestionState {
  const question = tracker.questionState.get(questionId);
  if (!question) {
    throw new Error(`Unknown question id: ${questionId}`);
  }

  return question;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}
