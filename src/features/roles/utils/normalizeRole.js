import { ROLE_ALIASES } from '../constants/roleTypes';

export const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';

  const key = value.replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[key] || ROLE_ALIASES[value] || key;
};

