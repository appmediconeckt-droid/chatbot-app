// Privacy policy text for the Doctor app, rendered by the shared
// CounselorPrivacyPolicy screen (see DoctorPrivacySecurityScreen).
//
// Written from what the doctor app actually collects and does: profile and
// registration details, clinic info, appointments / tokens / walk-ins via QR,
// the consultation records a doctor creates, follow-ups, staff directory,
// account + device session. It deliberately makes no claim the app can't back
// up (no "end-to-end encrypted", no self-serve data export, no payouts).
//
// DRAFT: this is product copy, not reviewed legal text. Doctors handle health
// data, so have it reviewed (e.g. against India's DPDP Act 2023 and the
// Telemedicine Practice Guidelines 2020) before release, and update
// lastUpdated whenever the wording changes.

const TEAL = { color: '#0D9488', bg: '#CCFBF1' };

export const DOCTOR_PRIVACY_CONTENT = {
  lastUpdated: '25 September 2026',
  heroText:
    'Learn how Humaeli handles your professional profile, clinic details, appointments, and the patient records you create.',
  features: [
    { icon: 'shield-checkmark', label: 'Secure Account', color: '#16A34A', bg: '#E6F6EC' },
    { icon: 'medkit', label: 'Confidential Records', ...TEAL },
    { icon: 'business', label: 'Clinic Privacy', color: '#8B5CF6', bg: '#F3E8FF' },
    { icon: 'hand-left', label: 'We Never Sell Data', color: '#EF4444', bg: '#FEE2E2' },
  ],
  sections: [
    {
      id: 'collect',
      icon: 'document-text-outline',
      title: 'Information We Collect',
      color: '#16A34A',
      bg: '#E6F6EC',
      points: [
        'Professional profile — name, qualifications, registration number, specialization and experience',
        'Clinic details — name, address, contact information and photos you add',
        'Appointments — bookings, tokens, walk-in registrations made through your QR code, schedule and availability',
        'Patient records you create — consultation notes, diagnoses, medicines and advice, follow-ups and visit history',
        'Staff directory entries you add for your clinic',
        'Account and device details — email, phone number, login session and notification token',
      ],
    },
    {
      id: 'use',
      icon: 'settings-outline',
      title: 'How We Use Information',
      ...TEAL,
      points: [
        'Show your profile and clinic so patients can book appointments or register as walk-ins',
        'Run your appointment queue, tokens, follow-ups and reminders',
        'Keep each patient\'s visit history available to you on later visits',
        'Send appointment, account and security notifications',
        'Keep the platform secure and reliable',
      ],
    },
    {
      id: 'records',
      icon: 'medkit-outline',
      title: 'Patient Health Records',
      color: '#8B5CF6',
      bg: '#F3E8FF',
      points: [
        'Records you create are linked to the patient\'s appointments and visits',
        'They are medical information and are treated as confidential',
        'They are not shared outside the platform except to provide care or when required by law',
        'Patients can ask Humaeli support to access or correct their information',
      ],
    },
    {
      id: 'sharing',
      icon: 'share-social-outline',
      title: 'Sharing & Security',
      color: '#F59E0B',
      bg: '#FEF3C7',
      points: [
        'We never sell your data or your patients\' data',
        'Information is shared only as needed to provide the service, or when required by law',
        'Your account is signed in on one device at a time, and you can protect the app with a PIN or biometric lock',
      ],
    },
    {
      id: 'responsibilities',
      icon: 'person-circle-outline',
      title: 'Your Responsibilities',
      ...TEAL,
      points: [
        'Keep patient information confidential and use it only for their care',
        'Follow the Telemedicine Practice Guidelines and other applicable laws',
        'Keep your registration and professional details accurate',
        'Keep your device secure and do not share your login',
      ],
    },
    {
      id: 'retention',
      icon: 'time-outline',
      title: 'Data Retention and Deletion',
      color: '#10B981',
      bg: '#DFF7EC',
      points: [
        'Kept only as long as needed for the purposes stated in this policy.',
        'Medical records may be kept longer where the law requires it.',
        'Retention depends on the type of information, legal requirements, security needs and any open disputes.',
      ],
    },
    {
      id: 'choices',
      icon: 'options-outline',
      title: 'Your Choices',
      color: '#EF4444',
      bg: '#FEE2E2',
      points: [
        'Update your profile and clinic details from Settings',
        'Choose which notifications you receive in Notification Preferences',
        'Ask support for a copy of your data or a correction',
        'Delete your account from Settings',
      ],
    },
  ],
};
