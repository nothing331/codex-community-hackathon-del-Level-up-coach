"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { entryJourney, suggestedTopics } from "@/lib/demo-data";

export function EntrySurface() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTopic, setSelectedTopic] = useState(suggestedTopics[0].value);
  const [query, setQuery] = useState(suggestedTopics[0].value);

  const nextStep = useMemo(
    () =>
      `${selectedTopic} selected. Next: generate a short mock, capture timing, and return a coaching plan.`,
    [selectedTopic],
  );

  return (
    <section className="page-reveal flex min-h-[calc(100vh-8.5rem)] items-start pt-8 md:pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <div className="mb-8 max-w-4xl">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.34em] text-signal">
            AI exam coach
          </p>
          <h2 className="font-display text-4xl leading-none md:text-6xl lg:text-7xl">
            Start with one chapter.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted md:text-base">
            Type a subject, tap a chapter, and move straight into a mock test with no
            guessing.
          </p>
        </div>

        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTopic = query.trim() || suggestedTopics[0].value;

            setSelectedTopic(nextTopic);
            setQuery(nextTopic);
            startTransition(() => {
              router.push("/generate");
            });
          }}
        >
          <label htmlFor="study-query" className="sr-only">
            Enter your study focus
          </label>
          <div className="surface relative mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-[30px] p-3 shadow-[0_26px_70px_rgba(0,0,0,0.3)] md:flex-row md:items-center md:rounded-[32px]">
            <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(105,227,255,0.1),transparent_52%)] md:rounded-[32px]" />
            <input
              id="study-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="JEE Physics / Mechanics"
              className="relative min-h-16 flex-1 rounded-[22px] border border-transparent bg-white/[0.03] px-5 text-base text-white outline-none placeholder:text-muted focus:border-signal/30 md:min-h-18 md:px-6 md:text-xl"
            />
            <button
              type="submit"
              className="relative inline-flex min-h-16 items-center justify-center rounded-[22px] bg-signal px-6 text-base font-semibold text-slate-950 hover:-translate-y-0.5 md:min-h-18 md:px-8"
            >
              {isPending ? "Opening flow..." : "Generate mock"}
            </button>
          </div>
        </form>

        <div className="mt-6 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {suggestedTopics.map((topic) => {
            const active = selectedTopic === topic.value;

            return (
              <button
                key={topic.label}
                type="button"
                onClick={() => {
                  setSelectedTopic(topic.value);
                  setQuery(topic.value);
                }}
                className={`rounded-full border px-3.5 py-2.5 text-sm font-semibold ${
                  active
                    ? "border-signal/30 bg-signal-soft text-signal"
                    : "border-line bg-white/[0.02] text-white hover:-translate-y-0.5 hover:border-signal/20"
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-white/88">{nextStep}</p>

        <div className="mt-10 grid w-full max-w-6xl grid-cols-1 gap-4 border-t border-line pt-5 md:grid-cols-4 md:gap-0">
          {entryJourney.map((item, index) => (
            <div
              key={item.title}
              className={`flex items-start gap-4 px-0 text-left md:px-5 ${
                index < entryJourney.length - 1 ? "md:border-r md:border-line" : ""
              }`}
            >
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-signal/20 bg-signal-soft font-mono text-xs text-signal">
                0{index + 1}
              </span>
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
