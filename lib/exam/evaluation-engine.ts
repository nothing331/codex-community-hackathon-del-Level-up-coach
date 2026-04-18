import type {
  AttemptAnswer,
  AttemptSubmission,
  BehaviorSignal,
  Difficulty,
  DifficultyBreakdown,
  EvaluationOutput,
  Question,
  QuestionDiagnostic,
  QuestionSet,
  TimeMetrics,
  TopicBreakdown,
} from "../ai/schemas";

interface EvaluatedQuestion extends QuestionDiagnostic {
  topic: string;
  difficulty: Difficulty;
}

export function evaluateAttempt(questionSet: QuestionSet, attempt: AttemptSubmission): EvaluationOutput {
  const answerMap = new Map<string, AttemptAnswer>(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );

  const diagnostics = questionSet.questions.map((question, index) =>
    buildQuestionDiagnostic(question, answerMap.get(question.id), index),
  );

  const score = diagnostics.filter((item) => item.isCorrect).length;
  const attempted = diagnostics.filter((item) => item.isAttempted).length;
  const unattempted = diagnostics.length - attempted;
  const accuracy = attempted ? round(score / attempted) : 0;

  const topicBreakdown = buildTopicBreakdown(diagnostics);
  const difficultyBreakdown = buildDifficultyBreakdown(diagnostics, questionSet.questions);
  const timeMetrics = buildTimeMetrics(diagnostics, attempt);
  const behaviorSignals = buildBehaviorSignals(
    diagnostics,
    topicBreakdown,
    difficultyBreakdown,
    timeMetrics,
  );

  return {
    score,
    totalQuestions: questionSet.questions.length,
    attempted,
    unattempted,
    accuracy,
    topicBreakdown,
    difficultyBreakdown,
    timeMetrics,
    behaviorFlags: behaviorSignals.map((signal) => signal.code),
    behaviorSignals,
    questionDiagnostics: diagnostics,
  };
}

function buildQuestionDiagnostic(
  question: Question,
  answer: AttemptAnswer | undefined,
  index: number,
): EvaluatedQuestion {
  const selectedAnswer = answer?.selectedAnswer ?? null;
  const isAttempted = selectedAnswer !== null;
  const isCorrect = isAttempted && selectedAnswer === question.correctAnswer;
  const timeSpentSec = answer?.timeSpentSec ?? 0;

  return {
    questionId: question.id,
    index,
    topic: question.topic,
    difficulty: question.difficulty,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isAttempted,
    isCorrect,
    timeSpentSec,
    expectedTimeSec: question.expectedTimeSec,
    overtimeSec: round(timeSpentSec - question.expectedTimeSec),
    visitedCount: answer?.visitedCount ?? 0,
    answerChangedCount: answer?.answerChangedCount ?? 0,
    timeToFirstAnswerSec: answer?.timeToFirstAnswerSec ?? null,
    averageGapBeforeVisitSec: answer?.averageGapBeforeVisitSec ?? 0,
    maxGapBeforeVisitSec: answer?.maxGapBeforeVisitSec ?? 0,
  };
}

function buildTopicBreakdown(diagnostics: EvaluatedQuestion[]): TopicBreakdown[] {
  const grouped = new Map<string, EvaluatedQuestion[]>();

  diagnostics.forEach((item) => {
    const bucket = grouped.get(item.topic) ?? [];
    bucket.push(item);
    grouped.set(item.topic, bucket);
  });

  return Array.from(grouped.entries()).map(([topic, questions]) => {
    const attempted = questions.filter((item) => item.isAttempted);
    const correct = attempted.filter((item) => item.isCorrect).length;

    return {
      topic,
      attempted: attempted.length,
      correct,
      accuracy: attempted.length ? round(correct / attempted.length) : 0,
      averageTimeSec: attempted.length ? round(average(attempted.map((item) => item.timeSpentSec))) : 0,
      averageGapBeforeVisitSec: attempted.length
        ? round(average(attempted.map((item) => item.averageGapBeforeVisitSec)))
        : 0,
    };
  });
}

function buildDifficultyBreakdown(
  diagnostics: EvaluatedQuestion[],
  questions: Question[],
): DifficultyBreakdown[] {
  const order: Difficulty[] = ["easy", "medium", "hard"];

  return order.map((difficulty) => {
    const filtered = diagnostics.filter((item) => item.difficulty === difficulty);
    const attempted = filtered.filter((item) => item.isAttempted);
    const correct = attempted.filter((item) => item.isCorrect).length;
    const expectedTimes = questions
      .filter((item) => item.difficulty === difficulty)
      .map((item) => item.expectedTimeSec);

    return {
      difficulty,
      attempted: attempted.length,
      correct,
      accuracy: attempted.length ? round(correct / attempted.length) : 0,
      averageTimeSec: attempted.length ? round(average(attempted.map((item) => item.timeSpentSec))) : 0,
      expectedTimeSec: expectedTimes.length ? round(average(expectedTimes)) : 0,
    };
  });
}

function buildTimeMetrics(
  diagnostics: EvaluatedQuestion[],
  attempt: AttemptSubmission,
): TimeMetrics {
  const attempted = diagnostics.filter((item) => item.isAttempted);
  const correct = diagnostics.filter((item) => item.isCorrect);
  const wrong = attempted.filter((item) => !item.isCorrect);
  const transitions = attempt.answers
    .flatMap((answer) => answer.visitWindows.map((window) => window.gapBeforeEnterSec))
    .filter((value) => value > 0);

  const halfway = Math.ceil(diagnostics.length / 2);
  const firstHalf = diagnostics.slice(0, halfway).filter((item) => item.isAttempted);
  const secondHalf = diagnostics.slice(halfway).filter((item) => item.isAttempted);
  const firstHalfAccuracy = firstHalf.length
    ? round(firstHalf.filter((item) => item.isCorrect).length / firstHalf.length)
    : 0;
  const secondHalfAccuracy = secondHalf.length
    ? round(secondHalf.filter((item) => item.isCorrect).length / secondHalf.length)
    : 0;

  const lateStageAccuracyDrop =
    firstHalf.length >= 2 && secondHalf.length >= 2 && secondHalfAccuracy <= firstHalfAccuracy - 0.2;

  const slowestQuestion = diagnostics.reduce<EvaluatedQuestion | null>((slowest, current) => {
    if (!slowest || current.timeSpentSec > slowest.timeSpentSec) {
      return current;
    }
    return slowest;
  }, null);

  const fastestCorrect = correct.reduce<EvaluatedQuestion | null>((fastest, current) => {
    if (!fastest || current.timeSpentSec < fastest.timeSpentSec) {
      return current;
    }
    return fastest;
  }, null);

  return {
    averageTimePerQuestionSec: attempted.length ? round(average(attempted.map((item) => item.timeSpentSec))) : 0,
    averageTransitionDelaySec: transitions.length ? round(average(transitions)) : 0,
    totalTransitionDelaySec: transitions.length
      ? round(transitions.reduce((sum, value) => sum + value, 0))
      : 0,
    idleTransitionCount: transitions.filter((value) => value >= 15).length,
    slowestQuestionId: slowestQuestion?.questionId ?? null,
    fastestCorrectQuestionId: fastestCorrect?.questionId ?? null,
    lateStageAccuracyDrop,
    firstHalfAccuracy,
    secondHalfAccuracy,
    averageTimeOnCorrectSec: correct.length ? round(average(correct.map((item) => item.timeSpentSec))) : 0,
    averageTimeOnWrongSec: wrong.length ? round(average(wrong.map((item) => item.timeSpentSec))) : 0,
  };
}

function buildBehaviorSignals(
  diagnostics: EvaluatedQuestion[],
  topicBreakdown: TopicBreakdown[],
  difficultyBreakdown: DifficultyBreakdown[],
  timeMetrics: TimeMetrics,
): BehaviorSignal[] {
  const signals: BehaviorSignal[] = [];
  const hard = difficultyBreakdown.find((item) => item.difficulty === "hard");
  const easy = difficultyBreakdown.find((item) => item.difficulty === "easy");
  const revisited = diagnostics.filter((item) => item.visitedCount > 1);
  const hesitant = diagnostics.filter((item) => item.timeToFirstAnswerSec !== null);

  if (
    hard &&
    hard.attempted >= 2 &&
    hard.averageTimeSec > hard.expectedTimeSec * 1.25 &&
    hard.accuracy <= 0.5
  ) {
    signals.push({
      code: "overinvests_in_hard_questions",
      label: "Overinvests in hard questions",
      detail: "Hard questions are taking significantly longer than planned without enough accuracy return.",
      evidence: {
        hardAverageTimeSec: hard.averageTimeSec,
        hardExpectedTimeSec: hard.expectedTimeSec,
        hardAccuracy: hard.accuracy,
      },
    });
  }

  if (timeMetrics.averageTransitionDelaySec >= 10 || timeMetrics.idleTransitionCount >= 2) {
    signals.push({
      code: "slow_between_questions",
      label: "Slow between questions",
      detail: "A meaningful amount of time is being spent between questions instead of inside active solving windows.",
      evidence: {
        averageTransitionDelaySec: timeMetrics.averageTransitionDelaySec,
        idleTransitionCount: timeMetrics.idleTransitionCount,
      },
    });
  }

  if (hesitant.length >= 3) {
    const averageTimeToFirstAnswer = average(
      hesitant
        .map((item) => item.timeToFirstAnswerSec)
        .filter((value): value is number => value !== null),
    );

    const averageSolveTime = average(hesitant.map((item) => item.timeSpentSec));
    if (averageSolveTime > 0 && averageTimeToFirstAnswer / averageSolveTime >= 0.55) {
      signals.push({
        code: "hesitates_before_committing",
        label: "Hesitates before committing",
        detail: "A large share of the solve window is spent before the first answer selection.",
        evidence: {
          averageTimeToFirstAnswerSec: round(averageTimeToFirstAnswer),
          averageSolveTimeSec: round(averageSolveTime),
        },
      });
    }
  }

  if (timeMetrics.lateStageAccuracyDrop) {
    signals.push({
      code: "accuracy_drops_late",
      label: "Accuracy drops late",
      detail: "The second half of the paper is materially weaker than the first half.",
      evidence: {
        firstHalfAccuracy: timeMetrics.firstHalfAccuracy,
        secondHalfAccuracy: timeMetrics.secondHalfAccuracy,
      },
    });
  }

  if (revisited.length >= 2) {
    const revisitAccuracy = revisited.filter((item) => item.isCorrect).length / revisited.length;
    if (revisitAccuracy < 0.5) {
      signals.push({
        code: "revisits_without_improvement",
        label: "Revisits without improvement",
        detail: "Questions are being revisited, but the extra passes are not converting into correct answers often enough.",
        evidence: {
          revisitedQuestions: revisited.length,
          revisitAccuracy: round(revisitAccuracy),
        },
      });
    }
  }

  if (
    easy &&
    easy.attempted >= 2 &&
    easy.accuracy < 0.6 &&
    easy.averageTimeSec < easy.expectedTimeSec * 0.75
  ) {
    signals.push({
      code: "rushes_easy_questions",
      label: "Rushes easy questions",
      detail: "Easy questions are being answered too quickly relative to their target solve time and accuracy is suffering.",
      evidence: {
        easyAverageTimeSec: easy.averageTimeSec,
        easyExpectedTimeSec: easy.expectedTimeSec,
        easyAccuracy: easy.accuracy,
      },
    });
  }

  const strongTopic = topicBreakdown.find((item) => item.attempted >= 2 && item.accuracy >= 0.75);
  if (strongTopic) {
    signals.push({
      code: "strong_in_topic",
      label: "Strong in topic",
      detail: `${strongTopic.topic} is currently a reliable scoring area.`,
      evidence: {
        topic: strongTopic.topic,
        accuracy: strongTopic.accuracy,
      },
    });
  }

  const weakTopic = topicBreakdown.find((item) => item.attempted >= 2 && item.accuracy <= 0.4);
  if (weakTopic) {
    signals.push({
      code: "weak_in_topic",
      label: "Weak in topic",
      detail: `${weakTopic.topic} is currently dragging the score down.`,
      evidence: {
        topic: weakTopic.topic,
        accuracy: weakTopic.accuracy,
      },
    });
  }

  return signals;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
