import { type ReactNode } from 'react';

interface AnalyticsSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AnalyticsSection({ id, eyebrow, title, description, children }: AnalyticsSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex max-w-3xl flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0063a9] dark:text-blue-400 sm:text-xs">
          {eyebrow}
        </p>
        <h2 id={headingId} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
          {title}
        </h2>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}
