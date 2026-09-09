import { USER_ROLES } from '../constants/roleTypes';

export const ROLE_MODULES = [
  {
    role: USER_ROLES.PATIENT,
    label: 'Patient',
    dashboardRoute: 'UserDashboard',
    featurePath: 'src/features/patient',
  },
  {
    role: USER_ROLES.COUNSELOR,
    label: 'Counselor / Psychologist',
    dashboardRoute: 'CounselorDashboard',
    featurePath: 'src/features/counselor',
  },
  {
    role: USER_ROLES.DOCTOR,
    label: 'Doctor / Specialist',
    dashboardRoute: null,
    featurePath: 'src/features/doctor',
  },
  {
    role: USER_ROLES.HOSPITAL_ADMIN,
    label: 'Hospital Admin',
    dashboardRoute: null,
    featurePath: 'src/features/hospital-admin',
  },
  {
    role: USER_ROLES.BRANCH_ADMIN,
    label: 'Branch Admin',
    dashboardRoute: null,
    featurePath: 'src/features/branch-admin',
  },
  {
    role: USER_ROLES.NURSE_LAB_TECHNICIAN,
    label: 'Nurse / Lab Technician',
    dashboardRoute: null,
    featurePath: 'src/features/nurse-lab-technician',
  },
  {
    role: USER_ROLES.PHARMACIST,
    label: 'Pharmacist',
    dashboardRoute: null,
    featurePath: 'src/features/pharmacist',
  },
  {
    role: USER_ROLES.RECEPTIONIST,
    label: 'Receptionist',
    dashboardRoute: null,
    featurePath: 'src/features/receptionist',
  },
  {
    role: USER_ROLES.BILLING_ACCOUNTS,
    label: 'Billing / Accounts',
    dashboardRoute: null,
    featurePath: 'src/features/billing-accounts',
  },
  {
    role: USER_ROLES.HOUSEKEEPING,
    label: 'Housekeeping',
    dashboardRoute: null,
    featurePath: 'src/features/housekeeping',
  },
  {
    role: USER_ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    dashboardRoute: null,
    featurePath: 'src/features/super-admin',
  },
];

