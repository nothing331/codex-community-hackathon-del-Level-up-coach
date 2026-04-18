import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { questionOptions, testSidebarStats } from "@/lib/demo-data";

export default function TestPage() {
  return (
    <SiteShell
      eyebrow="Test Workspace"
      title="Keep the student inside the question, not inside chrome."
      description="This surface mirrors the architecture note: open question area on the left, timing and navigation context on the right."
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="surface page-reveal rounded-[30px] p-6 md:p-8">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-signal">
                Question 04 / 10
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight md:text-5xl">
                A particle moves through a uniform electric field with initial velocity at
                an angle.
              </h2>
            </div>
            <div className="rounded-[20px] border border-warning/30 bg-warning/10 px-4 py-3 text-right">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-warning">
                Elapsed
              </p>
              <p className="mt-2 font-display text-3xl text-white">06:42</p>
            </div>
          </div>

          <div className="max-w-3xl text-base leading-8 text-muted">
            <p>
              Ignoring gravity, which graph best represents the variation of the
              particle&apos;s vertical displacement with time while it remains inside the
              electric field region?
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            {questionOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`rounded-[22px] border px-5 py-4 text-left ${
                  option.active
                    ? "border-signal/35 bg-signal-soft text-white shadow-[0_0_0_1px_rgba(105,227,255,0.08)]"
                    : "border-line bg-white/[0.02] text-muted hover:border-signal/20 hover:text-white"
                }`}
              >
                <span className="mr-3 inline-flex size-7 items-center justify-center rounded-full border border-current/20 font-mono text-xs">
                  {option.id}
                </span>
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-line px-5 py-3 text-sm font-medium text-white hover:border-signal/30 hover:bg-white/[0.03]"
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-slate-950 hover:-translate-y-0.5"
            >
              Save and next
            </button>
          </div>
        </article>

        <aside className="grid gap-6">
          <section className="surface page-reveal stagger-2 rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Live exam state
            </p>
            <div className="mt-5 grid gap-4">
              {testSidebarStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[20px] border border-line bg-white/[0.02] p-4"
                >
                  <p className="text-sm text-muted">{item.label}</p>
                  <p className="mt-2 font-display text-3xl">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface page-reveal stagger-3 rounded-[28px] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-warning">
              Submission transition
            </p>
            <h3 className="mt-3 font-display text-3xl leading-none">
              Evaluate decisions, not just answers.
            </h3>
            <p className="mt-4 text-sm leading-7 text-muted md:text-base">
              The next route should preserve accuracy, time spent, revisits, and difficulty
              mix so the report can explain what to fix.
            </p>
            <Link
              href="/report"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 font-semibold text-slate-950 hover:-translate-y-0.5"
            >
              View report surface
            </Link>
          </section>
        </aside>
      </section>
    </SiteShell>
  );
}
