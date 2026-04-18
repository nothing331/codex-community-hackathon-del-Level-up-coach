import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Entry" },
  { href: "/generate", label: "Generate" },
  { href: "/test", label: "Test" },
  { href: "/report", label: "Report" },
];

type SiteShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  hideIntro?: boolean;
  children: ReactNode;
};

export function SiteShell({
  eyebrow,
  title,
  description,
  hideIntro = false,
  children,
}: SiteShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="grid-fade absolute inset-0" />
        <div className="absolute left-[-10rem] top-[-12rem] h-80 w-80 rounded-full bg-signal/12 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-72 w-72 rounded-full bg-warning/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="surface page-reveal flex flex-col gap-3 rounded-[24px] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-signal">
              Level Up Coach
            </p>
            <h1 className="mt-2 font-display text-2xl leading-none md:text-4xl">
              Exam command center
            </h1>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-line bg-white/[0.02] px-4 py-2 text-sm text-white hover:-translate-y-0.5 hover:border-signal/20"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 py-5 md:py-6">
          {!hideIntro ? (
            <section className="page-reveal mb-6 max-w-4xl">
              {eyebrow ? (
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-warning">
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h2 className="mt-4 font-display text-4xl leading-none md:text-7xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-5 max-w-3xl text-base leading-8 text-muted md:text-lg">
                  {description}
                </p>
              ) : null}
            </section>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
