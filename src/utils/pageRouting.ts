export type PageKey =
  | 'dashboard'
  | 'partner-companies'
  | 'document-register'
  | 'supplier-ranking'
  | 'partners-feedback-hub'
  | 'account-management'
  | 'survey-forms'
  | 'analytics'
  | 'present'
  | 'explorer'
  | 'reports'
  | 'notifications'
  | 'create-form'
  | 'view-form'
  | 'fill-form'
  | 'archive'
  | 'import-evaluations'
  | 'my-submissions'
  | 'profile-settings'
  | 'pending-review'
  | 'export-history'
  | 'settings'
  | 'categories-manager';

const PAGE_KEYS = new Set<PageKey>([
  'dashboard',
  'partner-companies',
  'document-register',
  'supplier-ranking',
  'partners-feedback-hub',
  'account-management',
  'survey-forms',
  'analytics',
  'present',
  'explorer',
  'reports',
  'notifications',
  'create-form',
  'view-form',
  'fill-form',
  'archive',
  'import-evaluations',
  'my-submissions',
  'profile-settings',
  'pending-review',
  'export-history',
  'settings',
  'categories-manager',
]);

function normalizeBasePath(basePath: string): string {
  const segments = basePath.split('/').filter(Boolean);
  return segments.length ? `/${segments.join('/')}` : '';
}

export function getPagePathname(page: PageKey, basePath = ''): string {
  return `${normalizeBasePath(basePath)}/${page}`;
}

export function getPageKeyFromPathname(pathname: string, basePath = ''): PageKey {
  const normalizedBasePath = normalizeBasePath(basePath);
  let routePathname = pathname;

  if (normalizedBasePath) {
    if (pathname === normalizedBasePath || pathname === `${normalizedBasePath}/`) return 'dashboard';
    if (!pathname.startsWith(`${normalizedBasePath}/`)) return 'dashboard';
    routePathname = pathname.slice(normalizedBasePath.length);
  }

  const segments = routePathname.split('/').filter(Boolean);
  if (segments.length !== 1 || !PAGE_KEYS.has(segments[0] as PageKey)) return 'dashboard';
  return segments[0] as PageKey;
}
