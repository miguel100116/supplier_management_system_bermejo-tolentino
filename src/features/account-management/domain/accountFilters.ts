import type { PersistedProfile } from '../../../services/applicationRepository';
import { compareText } from '../../../utils/tableFilters';

export type AccountRoleFilter = 'All' | PersistedProfile['role'];
export type AccountSort = 'email-asc' | 'email-desc' | 'department-asc' | 'designation-asc';
export type AccountDepartmentFilter = 'All Departments' | PersistedProfile['department'];

export function filterAndSortAccounts(
  accounts: PersistedProfile[],
  roleFilter: AccountRoleFilter,
  searchTerm: string,
  sort: AccountSort,
  departmentFilter: AccountDepartmentFilter = 'All Departments',
): PersistedProfile[] {
  const query = searchTerm.trim().toLowerCase();
  const matching = accounts.filter((account) => {
    const matchesRole = roleFilter === 'All' || account.role === roleFilter;
    const matchesDepartment = departmentFilter === 'All Departments' || account.department === departmentFilter;
    const matchesSearch = !query || [account.email, account.department, account.designation]
      .some((value) => value.toLowerCase().includes(query));
    return matchesRole && matchesDepartment && matchesSearch;
  });

  return matching.sort((a, b) => {
    if (sort === 'email-desc') return compareText(b.email, a.email);
    if (sort === 'department-asc') return compareText(a.department, b.department) || compareText(a.email, b.email);
    if (sort === 'designation-asc') return compareText(a.designation, b.designation) || compareText(a.email, b.email);
    return compareText(a.email, b.email);
  });
}
