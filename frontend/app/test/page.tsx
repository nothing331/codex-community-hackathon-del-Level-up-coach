import { Suspense } from "react";

import { QuizWorkspace } from "@/components/exam/quiz-workspace";
import { SiteShell } from "@/components/layout/site-shell";

export default function TestPage() {
  return (
    <SiteShell
      // eyebrow="Quiz Workspace"
      // title="Generated questions from the ingested topic set."
      // description="This page uses the generated question set from the Exam Coach backend and keeps the student inside the actual quiz flow."
    >
      <Suspense fallback={<QuizLoadingFallback />}>
        <QuizWorkspace />
      </Suspense>
    </SiteShell>
  );
}

function QuizLoadingFallback() {
  return (
    <section className="surface rounded-[28px] p-6 md:p-8">
      <p className="eyebrow text-signal">
        Loading quiz
      </p>
      <h3 className="section-title mt-4 text-foreground">
        Preparing the generated question set.
      </h3>
    </section>
  );
}
