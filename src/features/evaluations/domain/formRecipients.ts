import type { PersistedProfile } from '../../account-management/domain/accountProfile';
import type { CustomForm, SurveyType } from '../../../types/survey';
import { getDefaultPermissions, getDepartmentDefaultPermissions } from '../../../utils/rbac';

export type DepartmentSurveyPermissions = Record<string, { surveyTypes: SurveyType[] }>;

export function getEligibleFormRecipients(
  survey: CustomForm,
  profiles: PersistedProfile[],
  departmentPermissions: DepartmentSurveyPermissions,
): PersistedProfile[] {
  return profiles.filter((profile) => {
    if (profile.role !== 'Employee') return false;
    const accountTypes = profile.permissions?.surveyTypes
      ?? getDefaultPermissions(profile.designation, profile.department).surveyTypes;
    const departmentTypes = departmentPermissions[profile.department]?.surveyTypes
      ?? getDepartmentDefaultPermissions(profile.department).surveyTypes;
    return accountTypes.includes(survey.surveyType)
      && departmentTypes.includes(survey.surveyType)
      && (!survey.accessDepartments?.length || survey.accessDepartments.includes(profile.department))
      && (!survey.accessRoles?.length || survey.accessRoles.includes(profile.designation));
  });
}
