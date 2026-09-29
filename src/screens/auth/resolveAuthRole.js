const normalizeAuthRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'counsellor') return 'counselor';
  if (value === 'patient') return 'user';
  return value;
};

// Clinic staff roles a doctor creates (Staff Management → Create Staff; ids
// from staffApi ROLE_LABELS). They all log in on the main Login page and
// share one staff dashboard, which reads the exact role from userData.
export const STAFF_ROLES = new Set([
  'staff', 'nurse', 'assistant', 'technician', 'billing', 'housekeeping',
  'supervisor', 'receptionist', 'manager',
  'medical_assistant', 'lab_technician', 'nurse_lab_technician', 'billing_accounts',
]);

const includesPsychiatry = (value) => {
  if (Array.isArray(value)) {
    return value.some(includesPsychiatry);
  }
  return /psychiatrist|psychiatry/i.test(String(value || ''));
};

export const resolveAuthRole = (data, fallbackRole = 'user') => {
  const user = data?.user || data?.data?.user || data?.profile || data || {};
  const explicitAppRole =
    normalizeAuthRole(data?.accountRole) ||
    normalizeAuthRole(data?.userType) ||
    normalizeAuthRole(data?.appRole) ||
    normalizeAuthRole(user?.accountRole) ||
    normalizeAuthRole(user?.userType) ||
    normalizeAuthRole(user?.appRole);

  if (explicitAppRole === 'doctor') return 'doctor';
  if (STAFF_ROLES.has(explicitAppRole)) return 'staff';

  const backendRole =
    normalizeAuthRole(data?.role) ||
    normalizeAuthRole(data?.data?.role) ||
    normalizeAuthRole(user?.role) ||
    normalizeAuthRole(fallbackRole) ||
    'user';

  if (
    backendRole === 'counselor' &&
    (
      includesPsychiatry(data?.specialization) ||
      includesPsychiatry(data?.specializations) ||
      includesPsychiatry(user?.specialization) ||
      includesPsychiatry(user?.specializations)
    )
  ) {
    return 'doctor';
  }

  if (STAFF_ROLES.has(backendRole.replace(/[\s-]+/g, '_'))) return 'staff';

  return backendRole === 'doctor' ? 'doctor' : backendRole === 'counselor' ? 'counselor' : 'user';
};

export const routeForAuthRole = (role) => {
  const normalized = normalizeAuthRole(role);
  if (normalized === 'doctor') return 'DoctorDashboard';
  if (normalized === 'counselor') return 'CounselorDashboard';
  if (normalized === 'staff') return 'StaffDashboard';
  return 'UserDashboard';
};

export const isCounselorLikeRole = (role) => {
  const normalized = normalizeAuthRole(role);
  return normalized === 'counselor' || normalized === 'doctor';
};

export { normalizeAuthRole };
