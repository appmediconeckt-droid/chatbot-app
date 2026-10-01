import { USER_ROLES } from '../constants/roleTypes';
import { normalizeRole } from '../utils/normalizeRole';

export const ROLE_DASHBOARD_ROUTES = {
  [USER_ROLES.PATIENT]: 'UserDashboard',
  [USER_ROLES.COUNSELOR]: 'CounselorDashboard',
  [USER_ROLES.DOCTOR]: 'DoctorDashboard',
  // Clinic staff created by a doctor all share the staff dashboard.
  [USER_ROLES.STAFF]: 'StaffDashboard',
  [USER_ROLES.NURSE_LAB_TECHNICIAN]: 'StaffDashboard',
  [USER_ROLES.RECEPTIONIST]: 'StaffDashboard',
  [USER_ROLES.BILLING_ACCOUNTS]: 'StaffDashboard',
  [USER_ROLES.HOUSEKEEPING]: 'StaffDashboard',
  assistant: 'StaffDashboard',
  technician: 'StaffDashboard',
  supervisor: 'StaffDashboard',
  manager: 'StaffDashboard',
};

export const routeForRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return ROLE_DASHBOARD_ROUTES[normalizedRole] || null;
};

