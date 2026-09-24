// Shared helpers for the real /api/staff backend — doctor-owned staff
// directory records (no login capability; see staffModel.js on the backend
// for why staff aren't User-collection accounts).
import axiosInstance from '../../../../axiosConfig';

export const ROLE_LABELS = {
  nurse: 'Nurse',
  medicalAssistant: 'Medical Assistant',
  labTechnician: 'Lab Technician',
  billingStaff: 'Billing',
  housekeeping: 'Housekeeping',
  supervisor: 'Supervisor',
  receptionist: 'Receptionist',
};

const ROLE_KEYS_BY_LABEL = Object.fromEntries(Object.entries(ROLE_LABELS).map(([key, label]) => [label, key]));

export const roleKeyToLabel = (key) => ROLE_LABELS[key] || key;
export const roleLabelToKey = (label) => ROLE_KEYS_BY_LABEL[label] || label;

const avatarFor = (name) => `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name || 'Staff')}`;

export function normalizeStaff(doc) {
  const name = `${doc.firstName || ''} ${doc.lastName || ''}`.trim() || 'Staff Member';
  return {
    rawId: doc._id,
    id: doc.employeeId,
    name,
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    email: doc.email || '',
    phone: doc.phone || '',
    department: doc.department || 'General',
    role: roleKeyToLabel(doc.role),
    roleKey: doc.role,
    verification: doc.verification || 'Pending Docs',
    status: doc.status || 'Active',
    employmentStatus: doc.employmentStatus || 'Full-Time',
    joinDate: doc.hireDate ? String(doc.hireDate).slice(0, 10) : '',
    image: avatarFor(name),
  };
}

export const fetchStaff = async () => {
  const { data } = await axiosInstance.get('/api/staff');
  return (data?.staff || []).map(normalizeStaff);
};

export const createStaff = async (payload) => {
  const { data } = await axiosInstance.post('/api/staff', payload);
  return normalizeStaff(data.staff);
};

export const updateStaff = async (rawId, payload) => {
  const { data } = await axiosInstance.patch(`/api/staff/${rawId}`, payload);
  return normalizeStaff(data.staff);
};

export const deleteStaff = async (rawId) => {
  await axiosInstance.delete(`/api/staff/${rawId}`);
};
