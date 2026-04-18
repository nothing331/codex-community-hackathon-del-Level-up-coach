import { EntrySurface } from "@/components/entry/entry-surface";
import { SiteShell } from "@/components/layout/site-shell";

export default function Home() {
  return (
    <SiteShell hideIntro>
      <EntrySurface />
    </SiteShell>
  );
}
