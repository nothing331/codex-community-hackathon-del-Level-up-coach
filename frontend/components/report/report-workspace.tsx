"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AttemptStateResponse, PerformanceReport, QuestionReview } from "@/lib/exam-coach-api";

const reportSections = [
  { id: "overview", label: "Overview" },
  { id: "breakdown", label: "Breakdown" },
  { id: "timing", label: "Timing" },
  { id: "review", label: "Review Lab" },
  { id: "action-plan", label: "Action Plan" },
] as const;

type ReportSectionId = (typeof reportSections)[number]["id"];
type ReviewFilter = "incorrect" | "slow" | "correct" | "all";

export function ReportWorkspace() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt");

  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<ReportSectionId>("overview");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("incorrect");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadReport() {
      if (!attemptId) {
        setError("Open the report from a submitted quiz attempt.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/exam-coach/attempt/${attemptId}`, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });
        const payload = (await response.json()) as AttemptStateResponse | { detail?: string };

        if (!response.ok) {
          throw new Error(readErrorDetail(payload, "Unable to load the report."));
        }

        const attemptState = payload as AttemptStateResponse;
        if (!attemptState.performance_report) {
          throw new Error("This attempt has not been submitted yet.");
        }

        if (isActive) {
          setReport(attemptState.performance_report);
        }
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load the report.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      isActive = false;
    };
  }, [attemptId]);

  const slowQuestionIds = useMemo(() => {
    if (!report) {
      return new Set<string>();
    }

    return new Set(report.timing_summary.slowest_question_ids);
  }, [report]);

  const slowestQuestions = useMemo(() => {
    if (!report) {
      return [];
    }

    return report.timing_summary.slowest_question_ids.map((questionId) => {
      const review = report.question_review.find((item) => item.question_id === questionId);
      return {
        questionId,
        seconds: review?.time_spent_seconds ?? 0,
        result: review?.result ?? "unattempted",
      };
    });
  }, [report]);

  const reviewItems = useMemo(() => {
    if (!report) {
      return [];
    }

    return getFilteredReview(report.question_review, reviewFilter, slowQuestionIds);
  }, [report, reviewFilter, slowQuestionIds]);

  if (isLoading) {
    return (
      <section className="surface rounded-[28px] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-signal">
          Loading report
        </p>
        <h3 className="mt-4 font-display text-3xl leading-none md:text-5xl">
          Building the evaluation summary from your timed attempt.
        </h3>
      </section>
    );
  }

  if (error || !report) {
    return (
      <section className="surface rounded-[28px] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-warning">
          Report unavailable
        </p>
        <h3 className="mt-4 font-display text-3xl leading-none md:text-5xl">
          {error ?? "The report could not be loaded."}
        </h3>
        <Link href="/" className="btn-primary mt-6">
          Start another quiz
        </Link>
      </section>
    );
  }

  const submissionLabel = report.submitted_at
    ? formatDateTime(report.submitted_at)
    : "Awaiting timestamp";
  const coachVerdict = getCoachVerdict(report);
  const primeFocus = getPrimeFocus(report);
  const attemptTone = report.auto_submitted ? "Auto-submitted" : "Submitted on time";
  const activeQuestionId =
    expandedQuestionId && reviewItems.some((item) => item.question_id === expandedQuestionId)
      ? expandedQuestionId
      : reviewItems[0]?.question_id ?? null;
  const reviewFilters: Array<{ value: ReviewFilter; label: string; count: number }> = [
    {
      value: "incorrect",
      label: "Incorrect",
      count: report.question_review.filter((item) => item.result === "incorrect").length,
    },
    {
      value: "slow",
      label: "Slowest",
      count: report.question_review.filter((item) => slowQuestionIds.has(item.question_id))
        .length,
    },
    {
      value: "correct",
      label: "Correct",
      count: report.question_review.filter((item) => item.result === "correct").length,
    },
    {
      value: "all",
      label: "All",
      count: report.question_review.length,
    },
  ];

  const sharedProps = {
    report,
    submissionLabel,
    coachVerdict,
    primeFocus,
    attemptTone,
    slowestQuestions,
    slowQuestionIds,
    reviewFilter,
    reviewFilters,
    reviewItems,
    activeQuestionId,
    expandedQuestionId,
    setExpandedQuestionId,
    setReviewFilter,
  };

  return (
    <div className="grid gap-6">
      <nav className="surface rounded-[28px] p-3">
        <div role="tablist" aria-label="Report sections" className="report-tab-list">
          {reportSections.map((section) => {
            const isSelected = selectedSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`report-tab ${isSelected ? "report-tab-active" : ""}`}
                onClick={() => setSelectedSection(section.id)}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>

      <ReportSectionPanel section={selectedSection} {...sharedProps} />
    </div>
  );
}

function ReportSectionPanel({
  section,
  report,
  submissionLabel,
  coachVerdict,
  primeFocus,
  attemptTone,
  slowestQuestions,
  slowQuestionIds,
  reviewFilter,
  reviewFilters,
  reviewItems,
  activeQuestionId,
  setExpandedQuestionId,
  setReviewFilter,
}: {
  section: ReportSectionId;
  report: PerformanceReport;
  submissionLabel: string;
  coachVerdict: string;
  primeFocus: string;
  attemptTone: string;
  slowestQuestions: Array<{
    questionId: string;
    seconds: number;
    result: QuestionReview["result"];
  }>;
  slowQuestionIds: Set<string>;
  reviewFilter: ReviewFilter;
  reviewFilters: Array<{ value: ReviewFilter; label: string; count: number }>;
  reviewItems: QuestionReview[];
  activeQuestionId: string | null;
  expandedQuestionId: string | null;
  setExpandedQuestionId: (questionId: string) => void;
  setReviewFilter: (filter: ReviewFilter) => void;
}) {
  switch (section) {
    case "overview":
      return (
        <OverviewSection
          report={report}
          submissionLabel={submissionLabel}
          coachVerdict={coachVerdict}
          primeFocus={primeFocus}
          attemptTone={attemptTone}
        />
      );
    case "breakdown":
      return <BreakdownSection report={report} />;
    case "timing":
      return (
        <TimingSection
          report={report}
          slowestQuestions={slowestQuestions}
          slowQuestionIds={slowQuestionIds}
        />
      );
    case "review":
      return (
        <ReviewSection
          report={report}
          reviewFilter={reviewFilter}
          reviewFilters={reviewFilters}
          reviewItems={reviewItems}
          activeQuestionId={activeQuestionId}
          slowQuestionIds={slowQuestionIds}
          setExpandedQuestionId={setExpandedQuestionId}
          setReviewFilter={setReviewFilter}
        />
      );
    case "action-plan":
      return <ActionPlanSection report={report} primeFocus={primeFocus} />;
    default:
      return null;
  }
}

function OverviewSection({
  report,
  submissionLabel,
  coachVerdict,
  primeFocus,
  attemptTone,
}: {
  report: PerformanceReport;
  submissionLabel: string;
  coachVerdict: string;
  primeFocus: string;
  attemptTone: string;
}) {
  return (
    <section className="surface rounded-[34px] p-6 md:p-8">
      <SectionHeader
        eyebrow="Overview"
        title="A focused reading of this attempt, not a wall of metrics."
        description="This section keeps the first read short and decisive: score, pace, verdict, and the one fix that matters most before the next paper."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <article className="dossier-card rounded-[30px] p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="status-pill status-pill-brand">{attemptTone}</span>
              <h3 className="mt-4 max-w-3xl font-display text-4xl leading-none text-[#1e2f4d] md:text-6xl">
                {coachVerdict}
              </h3>
            </div>
            <div className="rounded-[24px] border border-line bg-white/70 px-5 py-4 text-right shadow-[0_20px_40px_rgba(27,74,120,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
                Submitted
              </p>
              <p className="mt-2 text-sm font-semibold text-[#1e2f4d]">{submissionLabel}</p>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#5a6d8c]">{primeFocus}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Score"
              value={`${report.score_summary.correct} / ${report.question_review.length}`}
              note={`${report.score_summary.percentage.toFixed(2)}% overall accuracy`}
              tone="signal"
            />
            <MetricCard
              label="Pace"
              value={`${Math.round(report.timing_summary.average_time_per_question_seconds)} sec`}
              note={`${report.timing_summary.total_duration_seconds.toFixed(0)} sec total active time`}
            />
            <MetricCard
              label="Late half"
              value={report.timing_summary.late_stage_accuracy_drop ? "Dropped" : "Stable"}
              note={`${report.timing_summary.first_half_accuracy}% vs ${report.timing_summary.second_half_accuracy}%`}
              tone={report.timing_summary.late_stage_accuracy_drop ? "warning" : "signal"}
            />
          </div>
        </article>

        <aside className="grid gap-4">
          <div className="dossier-card dossier-card-signal rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#335eea]">
              What helped
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#1e2f4d]">
              {report.coaching.strengths.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="dossier-card dossier-card-warm rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#9a6a00]">
              First repair
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#1e2f4d]">
              {report.coaching.weak_topics.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function BreakdownSection({ report }: { report: PerformanceReport }) {
  return (
    <section className="surface rounded-[34px] p-6 md:p-8">
      <SectionHeader
        eyebrow="Breakdown"
        title="Where the paper was manageable, and where it leaked marks."
        description="Topic and difficulty are paired here so the user sees pattern and pressure together instead of hunting across the page."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <article className="dossier-card rounded-[30px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
                Topic profile
              </p>
              <h3 className="mt-3 card-title text-[#1e2f4d]">Chapter confidence map</h3>
            </div>
            <span className="status-pill">{report.topic_performance.length} tracked</span>
          </div>

          <div className="mt-6 grid gap-5">
            {report.topic_performance.map((item) => (
              <PerformanceStrip
                key={item.topic_id}
                label={formatTopicName(item.topic_id)}
                value={`${item.accuracy}%`}
                width={Math.max(item.accuracy, 6)}
                meta={`${item.attempted} attempted / ${item.average_time_seconds.toFixed(1)} sec avg`}
                badge={item.weakness_level}
              />
            ))}
          </div>
        </article>

        <article className="dossier-card rounded-[30px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
                Difficulty profile
              </p>
              <h3 className="mt-3 card-title text-[#1e2f4d]">Band-by-band accuracy</h3>
            </div>
            <span className="status-pill status-pill-brand">
              {report.score_summary.attempted} attempted
            </span>
          </div>

          <div className="mt-6 grid gap-5">
            {report.difficulty_performance.map((item) => (
              <PerformanceStrip
                key={item.difficulty_label}
                label={capitalize(item.difficulty_label)}
                value={`${item.accuracy}%`}
                width={Math.max(item.accuracy, 6)}
                meta={`${item.attempted} attempted / ${item.average_time_seconds.toFixed(1)} sec avg`}
                badge={
                  item.accuracy >= 70 ? "strong" : item.accuracy >= 45 ? "watch" : "risk"
                }
              />
            ))}
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <InsightColumn
          title="Strengths"
          tone="signal"
          items={
            report.coaching.strengths.length
              ? report.coaching.strengths
              : ["No clear strengths were highlighted in this attempt."]
          }
        />
        <InsightColumn
          title="Pressure points"
          tone="warning"
          items={
            report.coaching.weak_topics.length
              ? report.coaching.weak_topics
              : ["No major weakness cluster stood out in this attempt."]
          }
        />
        <InsightColumn
          title="Immediate response"
          tone="signal"
          items={
            report.coaching.next_actions.length
              ? report.coaching.next_actions.slice(0, 3)
              : ["Retake a similar timed quiz within the next 24 hours."]
          }
        />
      </div>
    </section>
  );
}

function TimingSection({
  report,
  slowestQuestions,
  slowQuestionIds,
}: {
  report: PerformanceReport;
  slowestQuestions: Array<{
    questionId: string;
    seconds: number;
    result: QuestionReview["result"];
  }>;
  slowQuestionIds: Set<string>;
}) {
  return (
    <section className="surface rounded-[34px] p-6 md:p-8">
      <SectionHeader
        eyebrow="Timing"
        title="This section explains how tempo shaped accuracy."
        description="Timing gets its own panel now so hesitation, late drop, and slow questions are easier to read as one connected story."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <StatPanel
              label="Transition delay"
              value={`${report.timing_summary.average_transition_delay_seconds.toFixed(1)} sec`}
              note={`${report.timing_summary.idle_transition_count} idle transitions`}
            />
            <StatPanel
              label="Commit pattern"
              value={hasSignal(report, "hesitates_before_committing") ? "Hesitant" : "Direct"}
              note={`${report.timing_summary.average_time_per_question_seconds.toFixed(1)} sec average pace`}
            />
            <StatPanel
              label="Correct-answer pace"
              value={`${report.timing_summary.average_time_on_correct_seconds.toFixed(1)} sec`}
              note="Average time on correct responses"
            />
            <StatPanel
              label="Wrong-answer pace"
              value={`${report.timing_summary.average_time_on_wrong_seconds.toFixed(1)} sec`}
              note="Average time on incorrect responses"
            />
          </div>

          <div className="dossier-card rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-warning">
                  Half split
                </p>
                <h3 className="mt-3 card-title text-[#1e2f4d]">
                  Accuracy trend through the set
                </h3>
              </div>
              <span
                className={`status-pill ${
                  report.timing_summary.late_stage_accuracy_drop
                    ? "status-pill-warm"
                    : "status-pill-brand"
                }`}
              >
                {report.timing_summary.late_stage_accuracy_drop
                  ? "Late drop detected"
                  : "Stable finish"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SplitMeter
                label="First half"
                value={report.timing_summary.first_half_accuracy}
                tone="signal"
              />
              <SplitMeter
                label="Second half"
                value={report.timing_summary.second_half_accuracy}
                tone={report.timing_summary.late_stage_accuracy_drop ? "warning" : "signal"}
              />
            </div>
          </div>
        </article>

        <aside className="grid gap-4">
          <div className="dossier-card rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
              Slowest questions
            </p>
            <div className="mt-5 grid gap-3">
              {slowestQuestions.length ? (
                slowestQuestions.map((item, index) => (
                  <div
                    key={item.questionId}
                    className="rounded-[22px] border border-line bg-white/80 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6a7a96]">
                          Slow question {index + 1}
                        </p>
                        <p className="mt-2 font-semibold text-[#1e2f4d]">{item.questionId}</p>
                      </div>
                      <ResultBadge result={item.result} />
                    </div>
                    <p className="mt-3 text-sm text-[#5a6d8c]">
                      {item.seconds.toFixed(1)} sec spent on this question.
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#5a6d8c]">No slow-question data was captured.</p>
              )}
            </div>
          </div>

          <div className="dossier-card rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
              Behavior signals
            </p>
            <div className="mt-5 grid gap-3">
              {report.behavior_signals.length ? (
                report.behavior_signals.map((signal) => (
                  <div
                    key={signal.code}
                    className="rounded-[22px] border border-line bg-white/80 p-4"
                  >
                    <p className="font-semibold text-[#1e2f4d]">{signal.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5a6d8c]">{signal.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#5a6d8c]">No behavior signals were flagged.</p>
              )}
            </div>
          </div>

          <div className="dossier-card rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#6a7a96]">
              Review shortcut
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...slowQuestionIds].slice(0, 3).map((questionId) => (
                <span key={questionId} className="status-pill">
                  {questionId}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReviewSection({
  report,
  reviewFilter,
  reviewFilters,
  reviewItems,
  activeQuestionId,
  slowQuestionIds,
  setExpandedQuestionId,
  setReviewFilter,
}: {
  report: PerformanceReport;
  reviewFilter: ReviewFilter;
  reviewFilters: Array<{ value: ReviewFilter; label: string; count: number }>;
  reviewItems: QuestionReview[];
  activeQuestionId: string | null;
  slowQuestionIds: Set<string>;
  setExpandedQuestionId: (questionId: string) => void;
  setReviewFilter: (filter: ReviewFilter) => void;
}) {
  return (
    <section className="surface rounded-[34px] p-6 md:p-8">
      <SectionHeader
        eyebrow="Review Lab"
        title="Question review is selective now, so explanations appear only when needed."
        description="This keeps the section useful without flooding the page. Choose the slice you want, then expand the item you want to inspect."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        {reviewFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`chip-button ${reviewFilter === filter.value ? "chip-active" : ""}`}
            onClick={() => setReviewFilter(filter.value)}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {reviewItems.length ? (
          reviewItems.map((item) => {
            const isExpanded = item.question_id === activeQuestionId;

            return (
              <article key={item.question_id} className="dossier-card rounded-[26px] p-2">
                <button
                  type="button"
                  className="review-toggle w-full rounded-[22px] px-4 py-4 text-left"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedQuestionId(item.question_id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#1e2f4d]">{item.question_id}</p>
                      <p className="mt-2 text-sm text-[#5a6d8c]">
                        {item.time_spent_seconds.toFixed(1)} sec / {item.visited_count} visits /{" "}
                        {item.answer_changed_count} changes
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {slowQuestionIds.has(item.question_id) ? (
                        <span className="status-pill status-pill-warm">Slowest set</span>
                      ) : null}
                      <ResultBadge result={item.result} />
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 rounded-[18px] border border-line bg-white/85 p-4">
                      <p className="text-sm leading-7 text-[#1e2f4d]">{item.explanation}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-[#6a7a96]">
                        <span>Selected: {item.selected_option_id ?? "None"}</span>
                        <span>Correct: {item.correct_option_id}</span>
                      </div>
                    </div>
                  ) : null}
                </button>
              </article>
            );
          })
        ) : (
          <div className="dossier-card rounded-[26px] p-6">
            <p className="text-sm text-[#5a6d8c]">No questions matched this review filter.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <span className="status-pill status-pill-brand">
          {report.question_review.length} questions in this attempt
        </span>
      </div>
    </section>
  );
}

function ActionPlanSection({
  report,
  primeFocus,
}: {
  report: PerformanceReport;
  primeFocus: string;
}) {
  return (
    <section className="surface rounded-[34px] p-6 md:p-8">
      <SectionHeader
        eyebrow="Action Plan"
        title="The report closes with a concrete response, not just observations."
        description="This tab turns the diagnosis into next steps, with the immediate move first and the weekly practice cadence after that."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="dossier-card dossier-card-warm rounded-[30px] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#9a6a00]">
            Primary adjustment
          </p>
          <p className="mt-4 text-base leading-8 text-[#1e2f4d]">{primeFocus}</p>

          <div className="mt-6 grid gap-3">
            {report.coaching.next_actions.map((item, index) => (
              <ActionStep key={item} label={`Step ${index + 1}`} text={item} />
            ))}
          </div>
        </article>

        <article className="dossier-card dossier-card-signal rounded-[30px] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#335eea]">
            Recommended practice cadence
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {report.coaching.recommended_practice_plan.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-line bg-white/80 p-4 text-sm leading-6 text-[#1e2f4d]"
              >
                {item}
              </div>
            ))}
          </div>
          <Link href="/" className="btn-primary mt-6">
            Start another timed quiz
          </Link>
        </article>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">{eyebrow}</p>
      <h2 className="mt-4 section-title text-foreground">{title}</h2>
      <p className="mt-4 max-w-3xl text-base leading-8 text-ink-soft">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "signal" | "warning";
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 ${
        tone === "signal"
          ? "border-signal/20 bg-signal-soft"
          : tone === "warning"
            ? "border-warning/40 bg-warning-soft"
            : "border-line bg-white/75"
      }`}
    >
      <p className="text-sm text-[#6a7a96]">{label}</p>
      <p className="mt-3 font-display text-4xl text-[#1e2f4d]">{value}</p>
      <p className="mt-2 text-sm text-[#5a6d8c]">{note}</p>
    </div>
  );
}

function PerformanceStrip({
  label,
  value,
  width,
  meta,
  badge,
}: {
  label: string;
  value: string;
  width: number;
  meta: string;
  badge: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1e2f4d]">{label}</p>
          <p className="mt-1 text-sm text-[#5a6d8c]">{meta}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#6a7a96]">
            {value}
          </span>
          <StrengthBadge value={badge} />
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/70">
        <div className="metric-bar h-full rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function InsightColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "signal" | "warning";
  items: string[];
}) {
  return (
    <article
      className={`rounded-[28px] border p-6 ${
        tone === "signal"
          ? "border-signal/20 bg-signal-soft"
          : "border-warning/30 bg-warning-soft"
      }`}
    >
      <p
        className={`font-mono text-xs uppercase tracking-[0.24em] ${
          tone === "signal" ? "text-[#335eea]" : "text-[#9a6a00]"
        }`}
      >
        {title}
      </p>
      <ul className="mt-5 grid gap-3 text-sm leading-7 text-[#1e2f4d]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function StatPanel({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="dossier-card rounded-[26px] p-5">
      <p className="text-sm text-[#6a7a96]">{label}</p>
      <p className="mt-3 font-display text-3xl text-[#1e2f4d]">{value}</p>
      <p className="mt-2 text-sm text-[#5a6d8c]">{note}</p>
    </div>
  );
}

function SplitMeter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "signal" | "warning";
}) {
  return (
    <div className="rounded-[24px] border border-line bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-[#1e2f4d]">{label}</p>
        <span
          className={`font-mono text-xs uppercase tracking-[0.16em] ${
            tone === "signal" ? "text-[#335eea]" : "text-[#9a6a00]"
          }`}
        >
          {value}%
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full ${
            tone === "signal" ? "bg-signal-strong" : "bg-[#d6a727]"
          }`}
          style={{ width: `${Math.max(value, 6)}%` }}
        />
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: QuestionReview["result"] }) {
  if (result === "correct") {
    return <span className="status-pill status-pill-brand">Correct</span>;
  }

  if (result === "incorrect") {
    return <span className="status-pill status-pill-warm">Incorrect</span>;
  }

  return <span className="status-pill">Unattempted</span>;
}

function StrengthBadge({ value }: { value: string }) {
  if (value === "high" || value === "risk") {
    return <span className="status-pill status-pill-warm">Risk</span>;
  }

  if (value === "strong" || value === "low") {
    return <span className="status-pill status-pill-brand">Strong</span>;
  }

  return <span className="status-pill">Watch</span>;
}

function ActionStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-white/80 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#6a7a96]">{label}</p>
      <p className="mt-2 text-sm leading-7 text-[#1e2f4d]">{text}</p>
    </div>
  );
}

function getFilteredReview(
  items: QuestionReview[],
  filter: ReviewFilter,
  slowQuestionIds: Set<string>,
) {
  switch (filter) {
    case "incorrect":
      return items.filter((item) => item.result === "incorrect");
    case "correct":
      return items.filter((item) => item.result === "correct");
    case "slow":
      return items.filter((item) => slowQuestionIds.has(item.question_id));
    case "all":
    default:
      return items;
  }
}

function getCoachVerdict(report: PerformanceReport) {
  const accuracy = report.score_summary.percentage;
  const lateDrop = report.timing_summary.late_stage_accuracy_drop;
  const hesitation = hasSignal(report, "hesitates_before_committing");

  if (accuracy >= 70 && !lateDrop) {
    return "You kept control of both the concepts and the clock.";
  }

  if (lateDrop && hesitation) {
    return "The attempt starts with intent, then loses sharpness once pacing pressure builds.";
  }

  if (accuracy < 50) {
    return "The score says the base needs tightening before speed becomes useful.";
  }

  return "This attempt is close to stable, but a few repeatable leaks are still costing marks.";
}

function getPrimeFocus(report: PerformanceReport) {
  return (
    report.coaching.next_actions[0] ??
    report.coaching.weak_topics[0] ??
    report.behavior_signals[0]?.detail ??
    "Review the incorrect questions first and repeat the same topic under a short timer."
  );
}

function hasSignal(report: PerformanceReport, code: string) {
  return report.behavior_signals.some((signal) => signal.code === code);
}

function formatTopicName(value: string) {
  return value
    .split("-")
    .map((part) => capitalize(part))
    .join(" ");
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readErrorDetail(payload: AttemptStateResponse | { detail?: string }, fallback: string) {
  if ("detail" in payload && payload.detail) {
    return payload.detail;
  }

  return fallback;
}
