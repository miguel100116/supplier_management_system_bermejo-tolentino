import { formatCompositeScore } from '../../../data/questionWeights';
import { SurveyResponse, SurveyType } from '../../../types/survey';
import { computeRankScore } from '../../../utils/analytics';
import { computeCompanyComposite, RankingMode } from '../../../utils/scoring';

export interface CompanyRankingCandidate {
  name: string;
  scorePercentage: number;
  count: number;
  type: SurveyType;
}

export type RankedCompany<T extends CompanyRankingCandidate> = T & { rankScore: number };

/**
 * Applies the selected ranking contract to a set of company summaries.
 * A single-type list compares the rounded, user-visible score before using
 * evaluation volume as a tiebreaker; mixed-type lists stay on the shared
 * 0-100 scale because Subcontractors display in native 0-2 units.
 */
export function rankCompanySummaries<T extends CompanyRankingCandidate>(
  candidates: T[],
  rankingMode: RankingMode,
): RankedCompany<T>[] {
  const uniformType = candidates.length > 0 && candidates.every((candidate) => candidate.type === candidates[0].type)
    ? candidates[0].type
    : null;
  const visibleScore = (score: number) => uniformType ? formatCompositeScore(uniformType, score).value : score;

  if (rankingMode === 'pure') {
    return candidates
      .map((candidate) => ({ ...candidate, rankScore: candidate.scorePercentage }))
      .sort((left, right) => {
        const scoreDifference = visibleScore(right.rankScore) - visibleScore(left.rankScore);
        if (scoreDifference !== 0) return scoreDifference;
        if (right.count !== left.count) return right.count - left.count;
        return left.name.localeCompare(right.name);
      });
  }

  const peers = candidates.map((candidate) => ({ score: candidate.scorePercentage, count: candidate.count }));
  return candidates
    .map((candidate) => ({
      ...candidate,
      rankScore: computeRankScore(candidate.scorePercentage, candidate.count, peers),
    }))
    .sort((left, right) => {
      const scoreDifference = visibleScore(right.rankScore) - visibleScore(left.rankScore);
      if (scoreDifference !== 0) return scoreDifference;
      if (right.count !== left.count) return right.count - left.count;
      if (right.rankScore !== left.rankScore) return right.rankScore - left.rankScore;
      return left.name.localeCompare(right.name);
    });
}

export interface CompanyPerformanceDatum {
  company: string;
  /** The value plotted and used for ordering in the selected ranking mode. */
  score: number;
  rawScore: number;
  evaluationCount: number;
  surveyType: SurveyType;
}

/**
 * Builds the best/least-performing chart data once from the filtered response
 * slice. Grouping first avoids repeatedly scanning every response for every
 * company and survey type.
 */
export function getCompanyPerformanceRanking(
  responses: SurveyResponse[],
  activeSurveyTypes: SurveyType[],
  rankingMode: RankingMode,
  direction: 'highest' | 'lowest',
  limit: number,
): CompanyPerformanceDatum[] {
  const allowedTypes = new Set(activeSurveyTypes);
  const grouped = new Map<string, Map<SurveyType, SurveyResponse[]>>();

  responses.forEach((response) => {
    if (!allowedTypes.has(response.surveyType)) return;
    const byType = grouped.get(response.company) ?? new Map<SurveyType, SurveyResponse[]>();
    const companyResponses = byType.get(response.surveyType) ?? [];
    companyResponses.push(response);
    byType.set(response.surveyType, companyResponses);
    grouped.set(response.company, byType);
  });

  const rawStats = [...grouped.entries()].flatMap(([company, byType]) => {
    const composites = activeSurveyTypes
      .map((surveyType) => {
        const companyResponses = byType.get(surveyType);
        return companyResponses
          ? computeCompanyComposite(company, surveyType, companyResponses)
          : null;
      })
      .filter((composite): composite is NonNullable<typeof composite> => composite !== null && composite.hasScore);

    if (composites.length === 0) return [];

    const rawScore = Number((composites.reduce((sum, composite) => sum + composite.compositeScore, 0) / composites.length).toFixed(1));
    return [{
      company,
      rawScore,
      evaluationCount: composites.reduce((sum, composite) => sum + composite.evaluationCount, 0),
      surveyType: composites[0].surveyType,
    }];
  });

  const peers = rawStats.map((item) => ({ score: item.rawScore, count: item.evaluationCount }));
  return rawStats
    .map((item) => ({
      ...item,
      score: rankingMode === 'weighted'
        ? computeRankScore(item.rawScore, item.evaluationCount, peers)
        : item.rawScore,
    }))
    .sort((left, right) => {
      const scoreDifference = direction === 'highest'
        ? right.score - left.score
        : left.score - right.score;
      if (scoreDifference !== 0) return scoreDifference;
      if (right.evaluationCount !== left.evaluationCount) return right.evaluationCount - left.evaluationCount;
      return left.company.localeCompare(right.company);
    })
    .slice(0, limit);
}
