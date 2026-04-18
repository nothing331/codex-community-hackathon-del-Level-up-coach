import { Suspense } from "react";

import { SiteShell } from "@/components/layout/site-shell";
import { ReportWorkspace } from "@/components/report/report-workspace";

export default function ReportPage() {
  return (
    <SiteShell
      eyebrow="Performance Report"
      title="Assignment diagnostics"
    >
      <Suspense fallback={<ReportLoadingFallback />}>
        <ReportWorkspace />
      </Suspense>
    </SiteShell>
  );
}

function ReportLoadingFallback() {
  return (
    <section className="surface rounded-[28px] p-6 md:p-8">
      <p className="eyebrow text-signal">
        Loading report
      </p>
      <h3 className="section-title mt-4 text-foreground">
        Preparing the timed attempt analysis.
      </h3>
    </section>
  );
}
