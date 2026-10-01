import { useState, useMemo } from 'react';
import { Search, ChevronLeft, CalendarClock, ChevronDown, Check } from 'lucide-react';
import { SurveyResponse, CustomForm } from '../types/survey';
import { isScoredQuestion } from '../data/questionWeights';
import { getSurveyStatus } from '../utils/surveyStatus';

interface SurveyExplorerPageProps {
  responses: SurveyResponse[];
  surveys?: CustomForm[];
}

export function SurveyExplorerPage({ responses, surveys = [] }: SurveyExplorerPageProps) {
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState('');

  const selectedSurvey = useMemo(() => surveys.find(s => s.id === selectedSurveyId), [selectedSurveyId, surveys]);

  const surveyResponses = useMemo(() => {
    if (!selectedSurvey) return [];
    const questionIds = new Set(selectedSurvey.questions.map(q => q.questionId));
    return responses.filter(r => questionIds.has(r.questionId));
  }, [selectedSurvey, responses]);

  const emails = useMemo(() => {
    const emailSet = new Set<string>();
    surveyResponses.forEach(r => {
      if (r.respondentEmail) {
        emailSet.add(r.respondentEmail.toLowerCase());
      }
    });
    return Array.from(emailSet).sort();
  }, [surveyResponses]);

  const filteredEmails = emails.filter(e => e.includes(emailSearch.toLowerCase()));

  const emailResponses = useMemo(() => {
    if (!selectedEmail) return [];
    return surveyResponses.filter(r => r.respondentEmail?.toLowerCase() === selectedEmail.toLowerCase());
  }, [surveyResponses, selectedEmail]);

  const groupedResponses = useMemo(() => {
    const groups: Record<string, SurveyResponse[]> = {};
    emailResponses.forEach(r => {
      if (!groups[r.responseId]) {
        groups[r.responseId] = [];
      }
      groups[r.responseId].push(r);
    });
    return Object.values(groups).sort((a, b) => b[0].submissionDate.localeCompare(a[0].submissionDate));
  }, [emailResponses]);

  if (!selectedSurvey) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {surveys.map(survey => {
            const status = getSurveyStatus(survey);
            let statusColor = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
            let dotColor = 'bg-emerald-500';
            if (status === 'Paused') {
              statusColor = 'border-orange-500 bg-orange-50 dark:bg-orange-950/20';
              dotColor = 'bg-orange-500';
            } else if (status === 'Completed' || status === 'Archived') {
              statusColor = 'border-slate-400 bg-slate-50 dark:bg-slate-900/50';
              dotColor = 'bg-slate-400';
            }

            return (
              <div
                key={survey.id}
                onClick={() => {
                  setSelectedSurveyId(survey.id);
                  setSelectedEmail(null);
                  setEmailSearch('');
                }}
                className={`cursor-pointer rounded-xl border-2 p-5 transition hover:shadow-md ${statusColor}`}
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">{survey.title}</h4>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-semibold shrink-0">
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    <span>{status}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {survey.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {survey.surveyType}
                  </span>
                  {survey.deadlineDate && (
                    <span className="flex items-center gap-1">
                      <CalendarClock size={14} />
                      {survey.deadlineDate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Survey is selected
  return (
    <div className="space-y-5">
      <button
        onClick={() => setSelectedSurveyId(null)}
        className="secondary-button self-start inline-flex items-center gap-2"
        type="button"
      >
        <ChevronLeft size={16} />
        Back to Surveys
      </button>

      <section className="panel space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedSurvey.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{selectedSurvey.description}</p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-sm font-semibold mb-2">Select Respondent Email</label>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search or select email..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0063a9] dark:focus:ring-blue-600"
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              onFocus={() => { if (!selectedEmail) setEmailSearch(''); }}
            />
            {emailSearch !== selectedEmail && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg z-50">
                {filteredEmails.length === 0 ? (
                  <div className="p-3 text-sm text-slate-500 text-center bg-white dark:bg-slate-900">No emails found.</div>
                ) : (
                  filteredEmails.map(email => (
                    <button
                      key={email}
                      className="w-full text-left px-4 py-2 text-sm bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0"
                      onClick={() => {
                        setSelectedEmail(email);
                        setEmailSearch(email);
                      }}
                    >
                      <span>{email}</span>
                      {selectedEmail === email && <Check size={14} className="text-[#0063a9]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedEmail && groupedResponses.length > 0 && (
        <div className="space-y-4 relative z-10">
          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Responses for {selectedEmail} ({groupedResponses.length})
          </h4>
          {groupedResponses.map((group, idx) => (
            <div key={group[0].responseId} className="panel space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Submission Date</p>
                  <p className="font-semibold">{new Date(group[0].submissionDate).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Company</p>
                  <p className="font-semibold">{group[0].company}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Department</p>
                  <p className="font-semibold">{group[0].department || 'N/A'}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {group.map(ans => (
                  <div key={ans.questionId} className="border-l-2 border-[#0063a9] dark:border-blue-500 pl-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{ans.questionCategory} - Q{ans.questionNumber}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">{ans.question}</p>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Answer:</span>
                      <span className="font-bold text-[#0063a9] dark:text-blue-400">
                        {isScoredQuestion(ans.surveyType, ans.questionId) ? ans.rating : (ans.comment || 'N/A')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {selectedEmail && groupedResponses.length === 0 && (
        <div className="panel text-center py-8">
          <p className="text-slate-500">No responses found for this email.</p>
        </div>
      )}
    </div>
  );
}
