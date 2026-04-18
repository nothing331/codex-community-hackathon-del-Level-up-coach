import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { generationFlow } from "@/lib/demo-data";

const staggerClasses = ["stagger-1", "stagger-2", "stagger-3"];

export default function GeneratePage() {
  return (
    <SiteShell
      eyebrow="Generate Flow"
      title="Build the mock before a single question appears."
      description="The architecture keeps AI narrow and structured: extract context, design the blueprint, then generate the question set."
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface page-reveal rounded-[28px] p-6 md:p-8">
          <div className="mb-8 max-w-2xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-signal">
              Orchestrator sequence
            </p>
            <h2 className="font-display text-3xl leading-none md:text-5xl">
              One route, three bounded reasoning steps.
            </h2>
          </div>

          <div className="grid gap-4">
            {generationFlow.map((step, index) => (
              <article
                key={step.title}
                className={`signal-line page-reveal ${staggerClasses[index] ?? ""} rounded-[24px] border border-line/90 bg-white/[0.02] pl-6`}
              >
                <div className="p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
                      Step 0{index + 1}
                    </p>
                    <span className="rounded-full border border-signal/25 bg-signal-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="mb-3 font-display text-2xl">{step.title}</h3>
                  <p className="max-w-xl text-sm leading-7 text-muted md:text-base">
                    {step.description}
                  </p>
                  <p className="mt-4 text-sm font-medium text-white/90">{step.output}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="surface page-reveal stagger-3 rounded-[28px] p-6 md:p-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-warning">
            Why this stack
          </p>
          <h3 className="font-display text-3xl leading-none">Next.js stays in control.</h3>
          <ul className="mt-6 space-y-4 text-sm leading-7 text-muted md:text-base">
            <li>App Router gives us entry, test, and report surfaces in one monolith.</li>
            <li>Route handlers can own AI orchestration without a separate backend.</li>
            <li>Local React state is enough for timing, answer capture, and navigation in v1.</li>
            <li>Zod schemas should lock the JSON contracts before agent logic expands.</li>
          </ul>

          <div className="mt-8 rounded-[22px] border border-line/90 bg-white/[0.02] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
              Next route
            </p>
            <p className="mt-3 text-sm leading-7 text-white/86 md:text-base">
              Move into a timed workspace with one question column, one decision sidebar,
              and no dashboard clutter.
            </p>
          </div>

          <Link
            href="/test"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-signal px-5 font-semibold text-slate-950 hover:-translate-y-0.5"
          >
            Open test workspace
          </Link>
        </aside>
      </section>
    </SiteShell>
  );
}
