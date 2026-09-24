import { USER_ROLES } from '../constants/roleTypes';

export const ROLE_PERMISSIONS = {
  [USER_ROLES.PATIENT]: [
    'profile:read',
    'profile:update',
    'appointment:book',
    'chat:ai',
    'chat:counselor',
    'wallet:manage',
    'prescription:read',
  ],
  [USER_ROLES.COUNSELOR]: [
    'profile:read',
    'profile:update',
    'patient-request:manage',
    'chat:patient',
    'prescription:write',
    'wallet:read',
    'notification:manage',
  ],
};

