import { USER_ROLES } from '../constants/roleTypes';
import { normalizeRole } from '../utils/normalizeRole';

export const ROLE_DASHBOARD_ROUTES = {
  [USER_ROLES.PATIENT]: 'UserDashboard',
  [USER_ROLES.COUNSELOR]: 'CounselorDashboard',
};

export const routeForRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return ROLE_DASHBOARD_ROUTES[normalizedRole] || null;
};

