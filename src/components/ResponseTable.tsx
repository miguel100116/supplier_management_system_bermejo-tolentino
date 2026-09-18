import { SurveyResponse } from '../types/survey';

interface ResponseTableProps {
  responses: SurveyResponse[];
}

export function ResponseTable({ responses }: ResponseTableProps) {
  const visibleResponses = responses.slice(0, 80);

  return (
    <section className="panel overflow-hidden">
      <div className="mb-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div>
          <h3 className="text-base font-semibold">Response Table</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Showing {visibleResponses.length} of {responses.length} filtered list records</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-3">Response ID</th>
              <th className="px-3 py-3">Survey</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Company</th>
              <th className="px-3 py-3">Question</th>
              <th className="px-3 py-3">Rating</th>
              <th className="px-3 py-3">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleResponses.map((response) => (
              <tr key={response.responseId} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="whitespace-nowrap px-3 py-3 font-medium">{response.responseId}</td>
                <td className="px-3 py-3">{response.surveyType}</td>
                <td className="whitespace-nowrap px-3 py-3">{response.submissionDate.slice(0, 10)}</td>
                <td className="whitespace-nowrap px-3 py-3">{response.company}</td>
                <td className="min-w-64 px-3 py-3">{response.question}</td>
                <td className="px-3 py-3">
                  <span className="badge">{response.rating}</span>
                </td>
                <td className="min-w-72 px-3 py-3 text-slate-500 dark:text-slate-400">{response.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
