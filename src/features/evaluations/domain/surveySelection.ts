import type { CustomForm } from '../../../types/survey';

/** Legacy test forms use a leading Test/Tests label (SMS-75). */
export function isTestSurveyTitle(title: string): boolean {
  return /^tests?(?:$|[\s._-]|\d)/i.test(title.trim());
}

export function getVisibleSurveyForms<T extends Pick<CustomForm, 'id' | 'title'>>(surveys: T[], isAdmin: boolean): T[] {
  return isAdmin ? surveys : surveys.filter((survey) => !isTestSurveyTitle(survey.title));
}

export function resolveSelectableSurveyId(surveys: Pick<CustomForm, 'id'>[], preferredId?: string | null): string {
  return surveys.some((survey) => survey.id === preferredId) ? preferredId! : surveys[0]?.id ?? '';
}
