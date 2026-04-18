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
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="grid-fade absolute inset-0" />
        <div className="absolute left-[-8rem] top-[-10rem] h-80 w-80 rounded-full bg-signal/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-warning/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="page-reveal flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex items-center gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-signal font-display text-[20px] leading-[24px] text-slate-900">
              L
            </span>
            <div>
              <p className="eyebrow text-signal-strong">Level Up Coach</p>
              <p className="body-compact text-ink-soft">Student practice workspace</p>
            </div>
          </Link>

          <nav className="flex flex-wrap gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="app-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 py-8 md:py-10">
          {!hideIntro ? (
            <section className="page-reveal mb-8 max-w-4xl">
              {eyebrow ? (
                <p className="eyebrow text-[#b38911]">{eyebrow}</p>
              ) : null}
              {title ? (
                <h2 className="page-title mt-4 text-foreground">{title}</h2>
              ) : null}
              {description ? (
                <p className="body-copy mt-4 max-w-3xl text-muted">
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
