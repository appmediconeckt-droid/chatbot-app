import { useEffect, useState } from 'react';
import { loadDoctorPrescriptionDocument } from './api/doctorPrescription';

export default function useDoctorPrescriptionDocument(appointment, visible = true) {
  const [state, setState] = useState({ appointment: null, data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ appointment, data: null, error: '' });
    if (visible && appointment) {
      loadDoctorPrescriptionDocument(appointment).then(
        data => { if (active) setState({ appointment, data, error: '' }); },
        failure => { if (active) setState({ appointment, data: null, error: failure.response?.data?.message || failure.message || 'Prescription could not be loaded. Please try again.' }); },
      );
    }
    return () => { active = false; };
  }, [visible, appointment, attempt]);
  return {
    data: visible && state.appointment === appointment ? state.data : null,
    error: visible && state.appointment === appointment ? state.error : '',
    retry: () => setAttempt(value => value + 1),
  };
}
