import React, { ReactNode } from 'react';

export const EVALUATION_WORKSPACE_TABS = [
  { key: 'survey-forms', label: 'Forms', description: 'Create and manage evaluation forms, assigned companies, deadlines, and access.' },
  { key: 'explorer', label: 'Responses', description: 'Select a form and respondent to inspect submitted evaluation answers.' },
  { key: 'pending-review', label: 'Coverage', description: 'See which assigned companies have evaluations in the current response records.' },
] as const;

export type EvaluationWorkspacePage = typeof EVALUATION_WORKSPACE_TABS[number]['key'];

export function isEvaluationWorkspacePage(page: string): page is EvaluationWorkspacePage {
  return EVALUATION_WORKSPACE_TABS.some((tab) => tab.key === page);
}

export function EvaluationWorkspace({ activePage, onNavigate, children }: {
  activePage: EvaluationWorkspacePage;
  onNavigate: (page: EvaluationWorkspacePage) => void;
  children: ReactNode;
}) {
  const activeTab = EVALUATION_WORKSPACE_TABS.find((tab) => tab.key === activePage)!;
  return (
    <div className="space-y-5">
      <section className="panel space-y-3">
        <nav aria-label="Evaluation workspace views" className="flex flex-wrap gap-2">
          {EVALUATION_WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={activePage === tab.key ? 'page' : undefined}
              onClick={() => onNavigate(tab.key)}
              className={activePage === tab.key
                ? 'rounded-lg bg-[#0063a9] px-4 py-2 text-sm font-semibold text-white dark:bg-blue-600'
                : 'secondary-button px-4 py-2 text-sm font-semibold'}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <p className="text-sm text-slate-500 dark:text-slate-400">{activeTab.description}</p>
      </section>
      {children}
    </div>
  );
}
