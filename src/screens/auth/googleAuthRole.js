export const normalizeGoogleAuthRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  return value === 'counsellor' ? 'counselor' : value;
};

export const mapRoleForBackend = (role) => {
  const normalized = normalizeGoogleAuthRole(role);
  if (normalized === 'counselor') return 'counsellor';
  if (normalized === 'doctor') return 'doctor';
  return normalized || role;
};
