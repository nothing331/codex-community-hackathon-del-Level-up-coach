"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { entryJourney } from "@/lib/demo-data";
import {
  buildChapterQuizRequest,
  buildFullPhysicsMixRequest,
  buildStartAttemptRequest,
  ExamMode,
  EXAM_COACH_STORAGE_KEY,
  findTopicMatch,
  GenerateResponse,
  getAvailableTopics,
  getFilteredTopics,
  StartAttemptResponse,
  StoredGeneratedQuiz,
  TopicApiItem,
  TopicsResponse,
} from "@/lib/exam-coach-api";

export function EntrySurface() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicApiItem[]>([]);
  const [selectedMode, setSelectedMode] = useState<ExamMode>("full_physics_mix");
  const [selectedTopic, setSelectedTopic] = useState<TopicApiItem | null>(null);
  const [query, setQuery] = useState("");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTopics() {
      setIsLoadingTopics(true);
      setError(null);

      try {
        const response = await fetch("/api/topics", {
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json()) as TopicsResponse | { detail?: string };

        if (!response.ok) {
          throw new Error(readErrorDetail(payload, "Unable to load available topics."));
        }

        const availableTopics = getAvailableTopics((payload as TopicsResponse).topics);
        const initialTopic = availableTopics[0] ?? null;

        if (!isActive) {
          return;
        }

        setTopics(availableTopics);
        setSelectedTopic(initialTopic);
        setQuery("");
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load available topics.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoadingTopics(false);
        }
      }
    }

    void loadTopics();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredTopics = useMemo(() => getFilteredTopics(topics, query).slice(0, 6), [topics, query]);
  const suggestedTopics = useMemo(() => topics.slice(0, 5), [topics]);
  const previewTopics = useMemo(() => topics.slice(0, 10), [topics]);

  const nextStep = useMemo(() => {
    if (selectedMode === "full_physics_mix") {
      return "Full Physics Mix selected. Next: generate a 15-question paper across the ingested Physics catalog and move straight into the timed workspace.";
    }

    if (!selectedTopic) {
      return "Pick one ingested topic to generate a chapter quiz and move into the test page.";
    }

    return `${selectedTopic.topic_name} selected. Next: generate a 9-question chapter quiz and open the test page.`;
  }, [selectedMode, selectedTopic]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedMode === "full_physics_mix" && topics.length === 0) {
      setError("No ingested topics are available yet. Start the backend ingestion flow first.");
      return;
    }

    if (selectedMode === "chapter_quiz" && !selectedTopic) {
      setError("Choose one ingested topic before generating the quiz.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/exam-coach/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          selectedMode === "full_physics_mix"
            ? buildFullPhysicsMixRequest()
            : buildChapterQuizRequest(selectedTopic!.topic_id),
        ),
      });

      const payload = (await response.json()) as GenerateResponse | { detail?: string };

      if (!response.ok) {
        throw new Error(readErrorDetail(payload, "Unable to generate the quiz."));
      }

      const generatedQuiz = payload as GenerateResponse;

      const attemptResponse = await fetch("/api/exam-coach/start-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(buildStartAttemptRequest(generatedQuiz.question_set.question_set_id)),
      });

      const attemptPayload = (await attemptResponse.json()) as
        | StartAttemptResponse
        | { detail?: string };

      if (!attemptResponse.ok) {
        throw new Error(readErrorDetail(attemptPayload, "Unable to start the timed attempt."));
      }

      const startedAttempt = (attemptPayload as StartAttemptResponse).attempt;
      const storedQuiz: StoredGeneratedQuiz = {
        topic: selectedMode === "chapter_quiz" ? selectedTopic : null,
        response: generatedQuiz,
        attempt: startedAttempt,
      };

      sessionStorage.setItem(EXAM_COACH_STORAGE_KEY, JSON.stringify(storedQuiz));

      const nextParams = new URLSearchParams({
        mode: selectedMode,
        attempt: startedAttempt.attempt_id,
      });
      if (selectedMode === "chapter_quiz" && selectedTopic) {
        nextParams.set("topic", selectedTopic.topic_id);
      }
      router.push(`/test?${nextParams.toString()}`);
    } catch (generateError) {
      const message =
        generateError instanceof Error ? generateError.message : "Unable to generate the quiz.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="page-reveal flex min-h-[calc(100vh-6rem)] items-start pt-8 md:pt-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="mb-4 flex flex-wrap gap-3 self-start">
          <button
            type="button"
            onClick={() => {
              setSelectedMode("full_physics_mix");
              setError(null);
            }}
            className={`min-w-44 rounded-[18px] border px-4 py-3 text-left ${
              selectedMode === "full_physics_mix"
                ? "border-signal/35 bg-signal-soft shadow-[0_16px_34px_rgba(105,227,255,0.16)]"
                : "border-line bg-white/72 hover:-translate-y-0.5 hover:border-signal/20"
            }`}
          >
            <p className="eyebrow text-signal">Option 1</p>
            <p className="body-compact mt-2 font-semibold text-foreground">Full Physics Mix</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMode("chapter_quiz");
              if (!query && selectedTopic) {
                setQuery(selectedTopic.topic_name);
              }
              setError(null);
            }}
            className={`min-w-44 rounded-[18px] border px-4 py-3 text-left ${
              selectedMode === "chapter_quiz"
                ? "border-[#fad776] bg-warning-soft shadow-[0_16px_34px_rgba(250,215,118,0.18)]"
                : "border-line bg-white/72 hover:-translate-y-0.5 hover:border-[#fad776]"
            }`}
          >
            <p className="eyebrow text-[#b38911]">Option 2</p>
            <p className="body-compact mt-2 font-semibold text-foreground">Chapter Quiz</p>
          </button>
        </div>

        <form className="w-full" onSubmit={handleSubmit}>
          {selectedMode === "full_physics_mix" ? (
            <div className="surface relative overflow-hidden rounded-[32px] p-5 md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(105,227,255,0.16),transparent_52%)]" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1 rounded-[24px] border border-transparent bg-white/[0.05] px-5 py-5 text-left">
                  <p className="body-compact text-foreground">Full catalog selected</p>
                </div>
                <button
                  type="submit"
                  disabled={isLoadingTopics || isGenerating || topics.length === 0}
                  className="btn-primary min-h-16 rounded-[24px] px-6 disabled:cursor-not-allowed disabled:opacity-55 md:px-8"
                >
                  {isGenerating ? "Generating full paper..." : "Generate full Physics paper"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="study-query" className="sr-only">
                Search ingested topics
              </label>
              <div className="surface relative flex w-full flex-col gap-4 rounded-[32px] p-4 md:flex-row md:items-center">
                <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(250,215,118,0.18),transparent_52%)]" />
                <input
                  id="study-query"
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    const nextSelection = findTopicMatch(topics, nextQuery);

                    setQuery(nextQuery);
                    setSelectedTopic(nextSelection);
                    setError(null);
                  }}
                  placeholder={isLoadingTopics ? "Loading topics..." : "Search an ingested topic"}
                  disabled={isLoadingTopics || isGenerating}
                  className="input-field relative min-h-16 flex-1 rounded-[24px] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isLoadingTopics || isGenerating || !selectedTopic}
                  className="btn-warm relative min-h-16 rounded-[24px] px-6 disabled:cursor-not-allowed disabled:opacity-55 md:px-8"
                >
                  {isGenerating ? "Generating..." : "Generate chapter quiz"}
                </button>
              </div>
            </>
          )}
        </form>

        <div className="panel-subtle mt-4 w-full rounded-[24px] p-4 text-left">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="eyebrow text-signal">
              {selectedMode === "full_physics_mix" ? "Included in the full mix" : "Suggested chapter quizzes"}
            </p>
            <p className="body-compact text-muted">
              {selectedMode === "full_physics_mix"
                ? "Scan the catalog that feeds the default paper"
                : "First 5 ingested topics from the API"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {(selectedMode === "full_physics_mix" ? previewTopics : suggestedTopics).map((topic) => {
              const active = selectedTopic?.topic_id === topic.topic_id;

              return (
                <button
                  key={topic.topic_id}
                  type="button"
                  onClick={() => {
                    setSelectedMode("chapter_quiz");
                    setSelectedTopic(topic);
                    setQuery(topic.topic_name);
                    setError(null);
                  }}
                  className={`chip-button ${
                    selectedMode === "chapter_quiz" && active ? "chip-warm" : ""
                  }`}
                >
                  {topic.topic_name}
                </button>
              );
            })}
          </div>
        </div>

        {selectedMode === "chapter_quiz" &&
        query &&
        filteredTopics.length > 0 &&
        !suggestedTopics.some((topic) => topic.topic_id === filteredTopics[0]?.topic_id) ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {filteredTopics.slice(0, 5).map((topic) => (
              <button
                key={`${topic.topic_id}-search`}
                type="button"
                onClick={() => {
                  setSelectedTopic(topic);
                  setQuery(topic.topic_name);
                  setError(null);
                }}
                className="chip-button"
              >
                {topic.topic_name}
              </button>
            ))}
          </div>
        ) : null}

        <p className="body-compact mt-4 text-ink-soft">{nextStep}</p>
        {error ? <p className="body-compact mt-3 text-[#b38911]">{error}</p> : null}
        {!isLoadingTopics && topics.length === 0 ? (
          <p className="body-compact mt-3 text-[#b38911]">
            No ingested topics are available yet. Start the backend ingestion flow first.
          </p>
        ) : null}

        <div className="mt-12 grid w-full grid-cols-1 gap-4 border-t border-line pt-6 md:grid-cols-4 md:gap-0">
          {entryJourney.map((item, index) => (
            <div
              key={item.title}
              className={`flex items-start gap-4 px-0 text-left md:px-5 ${
                index < entryJourney.length - 1 ? "md:border-r md:border-line" : ""
              }`}
            >
              <span className="status-pill status-pill-brand mt-0.5 shrink-0">
                0{index + 1}
              </span>
              <div>
                <p className="body-compact font-semibold text-foreground">{item.title}</p>
                <p className="body-compact mt-1 text-muted">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function readErrorDetail(
  payload: TopicsResponse | GenerateResponse | StartAttemptResponse | { detail?: string },
  fallback: string,
) {
  if ("detail" in payload && payload.detail) {
    return payload.detail;
  }

  return fallback;
}
