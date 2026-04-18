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
            <p className="eyebrow mb-3 text-signal">
              Orchestrator sequence
            </p>
            <h2 className="section-title text-foreground">
              One route, three bounded reasoning steps.
            </h2>
          </div>

          <div className="grid gap-4">
            {generationFlow.map((step, index) => (
              <article
                key={step.title}
                className={`signal-line panel-subtle page-reveal ${staggerClasses[index] ?? ""} rounded-[24px] pl-6`}
              >
                <div className="p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="eyebrow text-muted">
                      Step 0{index + 1}
                    </p>
                    <span className="status-pill status-pill-brand">
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="card-title mb-3 text-foreground">{step.title}</h3>
                  <p className="body-copy max-w-xl text-muted">
                    {step.description}
                  </p>
                  <p className="body-compact mt-4 font-medium text-foreground">{step.output}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="surface page-reveal stagger-3 rounded-[28px] p-6 md:p-8">
          <p className="eyebrow mb-3 text-[#b38911]">
            Why this stack
          </p>
          <h3 className="section-title text-foreground">Next.js stays in control.</h3>
          <ul className="body-copy mt-6 space-y-4 text-muted">
            <li>App Router gives us entry, test, and report surfaces in one monolith.</li>
            <li>Route handlers can own AI orchestration without a separate backend.</li>
            <li>Local React state is enough for timing, answer capture, and navigation in v1.</li>
            <li>Zod schemas should lock the JSON contracts before agent logic expands.</li>
          </ul>

          <div className="panel-subtle mt-8 rounded-[24px] p-5">
            <p className="eyebrow text-muted">
              Next route
            </p>
            <p className="body-copy mt-3 text-ink-soft">
              Move into a timed workspace with one question column, one decision sidebar,
              and no dashboard clutter.
            </p>
          </div>

          <Link href="/test" className="btn-primary mt-8">
            Open test workspace
          </Link>
        </aside>
      </section>
    </SiteShell>
  );
}
