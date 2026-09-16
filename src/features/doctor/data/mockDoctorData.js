// MOCK DATA — Doctor role has no backend yet.
// Every export in this file is placeholder data for UI development only.
// Replace with real API responses once the Doctor backend exists.

export const MOCK_DOCTOR_STATS = {
  appointmentsToday: 8,
  totalPatients: 24,
};

export const MOCK_TODAY_APPOINTMENTS = [
  {
    id: 'mock-appt-1',
    patientName: 'Ananya Sharma',
    time: '10:30 AM',
    type: 'Online Consultation',
  },
  {
    id: 'mock-appt-2',
    patientName: 'Rohan Mehta',
    time: '12:00 PM',
    type: 'Online Consultation',
  },
  {
    id: 'mock-appt-3',
    patientName: 'Priya Iyer',
    time: '3:15 PM',
    type: 'In-person Visit',
  },
];

// Example shape used by DoctorProfileCard when browsing a directory of
// doctors — the same object shape the future User-side "find a doctor" list
// is expected to consume.
export const MOCK_DOCTOR_DIRECTORY = [
  {
    id: 'mock-doc-1',
    fullName: 'Dr. Ananya Rao',
    specialization: 'Cardiologist',
    rating: 4.9,
    experience: 8,
    consultationType: 'Online',
    photoUrl: null,
  },
  {
    id: 'mock-doc-2',
    fullName: 'Dr. Karan Verma',
    specialization: 'Dermatologist',
    rating: 4.7,
    experience: 5,
    consultationType: 'Both',
    photoUrl: null,
  },
];
