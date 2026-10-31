import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { patientKey } from './receptionistUtils';

const VitalsContext = createContext({
  withSavedVitals: patient => patient,
  recordVitals: () => {},
  withSavedAvailability: patient => patient,
  recordAvailability: () => {},
});

// Keep confirmed readings above the sheets and tabs that mount/unmount while
// navigating. A delayed poll must not replace them with an older appointment.
// Confirmed availability is kept the same way, so a patient marked
// Unavailable moves to that queue tab at once instead of on the next poll.
export function ReceptionistVitalsProvider({ children }) {
  const [savedVitals, setSavedVitals] = useState({});
  const [savedAvailability, setSavedAvailability] = useState({});
  const recordVitals = useCallback((patient, vitals) => {
    setSavedVitals(current => ({ ...current, [patientKey(patient)]: vitals }));
  }, []);
  const withSavedVitals = useCallback(patient => {
    if (!patient) return patient;
    const saved = savedVitals[patientKey(patient)];
    if (!saved) return patient;
    let remote = patient.vitals;
    if (typeof remote === 'string') {
      try { remote = JSON.parse(remote); } catch { remote = null; }
    }
    if (Date.parse(remote?.recorded_at) > Date.parse(saved.recorded_at)) return patient;
    return { ...patient, vitals: saved };
  }, [savedVitals]);
  const recordAvailability = useCallback((patient, availability) => {
    setSavedAvailability(current => ({ ...current, [patientKey(patient)]: availability }));
  }, []);
  const withSavedAvailability = useCallback(patient => {
    if (!patient) return patient;
    const saved = savedAvailability[patientKey(patient)];
    if (!saved) return patient;
    // A newer update from the server (e.g. the doctor's side) wins.
    if (Date.parse(patient.availability?.updatedAt) > Date.parse(saved.updatedAt)) return patient;
    return { ...patient, availability: saved };
  }, [savedAvailability]);
  const value = useMemo(
    () => ({ withSavedVitals, recordVitals, withSavedAvailability, recordAvailability }),
    [withSavedVitals, recordVitals, withSavedAvailability, recordAvailability],
  );
  return <VitalsContext.Provider value={value}>{children}</VitalsContext.Provider>;
}

export const useReceptionistVitals = () => useContext(VitalsContext);
