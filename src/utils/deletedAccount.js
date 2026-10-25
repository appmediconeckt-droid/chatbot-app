
// Appointments left behind by deleted accounts.
// ---------------------------------------------------------------------------
// When a user/consultant/doctor account is deleted, the backend keeps the
// appointment rows but no longer populates the removed participant. The UI then
// rendered them with placeholder labels — "Unknown" in the doctor's today queue,
// "Counselor" on the patient's appointment card — so they looked like real
// bookings that could never be acted on.
//
// These helpers identify those orphaned rows so each side can hide them:
//   - doctor / consultant side  -> isPatientAccountDeleted (the patient is gone)
//   - patient (user) side       -> isProfessionalAccountDeleted (the pro is gone)
//
// Walk-in appointments intentionally have no linked account, but they always
// store the patient's name on the appointment itself (name is required at
// registration), so they are never treated as orphaned.
// ---------------------------------------------------------------------------

const DELETED_FLAGS = [
  'is_deleted', 'isDeleted', 'deleted',
  'account_deleted', 'accountDeleted',
  'is_deactivated', 'isDeactivated',
];

const DELETED_AT_FIELDS = ['deleted_at', 'deletedAt', 'account_deleted_at', 'accountDeletedAt'];

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const isFlaggedDeleted = (entity) =>
  Boolean(entity) && (
    DELETED_FLAGS.some((key) => entity[key] === true) ||
    DELETED_AT_FIELDS.some((key) => Boolean(entity[key]))
  );

// A participant is gone when it is explicitly flagged deleted, or when neither a
// name nor any other identifying field survives on the record.
const isParticipantMissing = (party, inlineName) => {
  if (isFlaggedDeleted(party)) return true;
  // A name kept on the appointment row itself (walk-ins, denormalised records).
  if (firstValue(inlineName)) return false;
  if (firstValue(party?.fullName, party?.full_name, party?.name)) return false;
  return !firstValue(
    party?.email, party?.phone, party?.mobile,
    party?.id, party?._id, party?.user_id, party?.userId,
  );
};

/** The patient on this appointment no longer exists (doctor / consultant side). */
export const isPatientAccountDeleted = (appointment) => {
  if (!appointment) return false;
  if (isFlaggedDeleted(appointment.patient || appointment.patientData || appointment.user)) return true;
  const patient = appointment.patient || appointment.patientData || appointment.user || null;
  const inlineName = firstValue(
    appointment.patient_name, appointment.patientName,
    appointment.walkin_patient_name, appointment.walkinPatientName,
    appointment.visitor_name, appointment.visitorName, appointment.name,
  );
  return isParticipantMissing(patient, inlineName);
};

/** The consultant / doctor on this appointment no longer exists (patient side). */
export const isProfessionalAccountDeleted = (appointment) => {
  if (!appointment) return false;
  const professional =
    appointment.counselor || appointment.counsellor || appointment.doctor ||
    appointment.psychiatrist || appointment.professional || null;
  const inlineName = firstValue(
    appointment.counselor_name, appointment.counselorName,
    appointment.counsellor_name, appointment.counsellorName,
    appointment.doctor_name, appointment.doctorName,
  );
  return isParticipantMissing(professional, inlineName);
};

/** Either side of the appointment is gone. */
export const hasDeletedParticipant = (appointment) =>
  isPatientAccountDeleted(appointment) || isProfessionalAccountDeleted(appointment);

export default {
  isPatientAccountDeleted,
  isProfessionalAccountDeleted,
  hasDeletedParticipant,
};
