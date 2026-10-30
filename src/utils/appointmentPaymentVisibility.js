const PREPAID_METHODS = new Set(['credit_card', 'debit_card', 'card', 'upi', 'wallet']);
const PAID_STATUSES = new Set([
  'paid', 'captured', 'authorized', 'authorised', 'verified',
  'success', 'successful', 'succeeded', 'completed',
]);
const ACTIVE_QUEUE_STATUSES = new Set([
  'booked', 'waiting', 'queued', 'called', 'skipped',
  'in_progress', 'in_consultation', 'consulting', 'serving',
]);

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const isWalkIn = (appointment) => {
  const type = String(first(
    appointment?.__appointmentSource, appointment?.source,
    appointment?.recordType, appointment?.appointment_type, appointment?.appointmentType,
    appointment?.booking_type, appointment?.bookingType, '',
  )).toLowerCase();
  return type.includes('walk') || Boolean(
    appointment?.walkin_appointment_id || appointment?.walkinAppointmentId
    || appointment?.walkin_id || appointment?.walkinId,
  );
};

export const isPrepaidAppointmentVisible = (appointment) => {
  if (isWalkIn(appointment)) return true;
  const queueStatus = String(first(
    appointment?.queue_status, appointment?.queueStatus, '',
  )).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const token = first(
    appointment?.token_number, appointment?.tokenNumber,
    appointment?.queue_token, appointment?.queueToken,
    appointment?.appointment_token, appointment?.appointmentToken,
    typeof appointment?.token === 'object' ? appointment?.token?.myToken : appointment?.token,
  );
  // Once the server has admitted a booking into the live queue (queue state or
  // token), it is authoritative. Staff endpoints omit payment fields while the
  // doctor endpoint includes them; filtering such rows by payment made the two
  // roles disagree about the exact same appointment.
  if (ACTIVE_QUEUE_STATUSES.has(queueStatus) || token !== undefined) return true;
  const method = String(first(
    appointment?.payment_method, appointment?.paymentMethod,
    appointment?.payment?.method, appointment?.payment?.payment_method, '',
  )).trim().toLowerCase();
  if (!PREPAID_METHODS.has(method)) return true;
  const status = String(first(
    appointment?.payment_status, appointment?.paymentStatus,
    appointment?.payment?.status, appointment?.payment?.payment_status,
    appointment?.transaction?.status, '',
  )).trim().toLowerCase();
  const reference = first(
    appointment?.payment_reference, appointment?.paymentReference,
    appointment?.razorpay_payment_id, appointment?.razorpayPaymentId,
    appointment?.payment_id, appointment?.paymentId,
    appointment?.payment?.razorpay_payment_id, appointment?.payment?.razorpayPaymentId,
  );
  return PAID_STATUSES.has(status) || Boolean(reference);
};
