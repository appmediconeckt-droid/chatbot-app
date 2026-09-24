const normalizeAuthRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'counsellor') return 'counselor';
  if (value === 'patient') return 'user';
  return value;
};

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

  return backendRole === 'doctor' ? 'doctor' : backendRole === 'counselor' ? 'counselor' : 'user';
};

export const routeForAuthRole = (role) => {
  const normalized = normalizeAuthRole(role);
  if (normalized === 'doctor') return 'DoctorDashboard';
  if (normalized === 'counselor') return 'CounselorDashboard';
  return 'UserDashboard';
};

export const isCounselorLikeRole = (role) => {
  const normalized = normalizeAuthRole(role);
  return normalized === 'counselor' || normalized === 'doctor';
};

export { normalizeAuthRole };
