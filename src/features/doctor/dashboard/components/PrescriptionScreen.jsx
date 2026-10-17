// All doctor prescription entry points use the patient's shared document.
import React from 'react';
import { formatAppointment } from '../api/doctorAppointments';
import ConsultationPrescriptionModal from './ConsultationPrescriptionModal';

export default function PrescriptionScreen({ patient, appointment, onBack }) {
  const record = React.useMemo(() => appointment || formatAppointment(patient?.__raw || patient || {}), [appointment, patient]);
  return <ConsultationPrescriptionModal visible appointment={record} onClose={onBack} />;
}
