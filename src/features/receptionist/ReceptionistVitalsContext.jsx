import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { patientKey } from './receptionistUtils';

const VitalsContext = createContext({
  withSavedVitals: patient => patient,
  recordVitals: () => {},
});

// Keep confirmed readings above the sheets and tabs that mount/unmount while
// navigating. A delayed poll must not replace them with an older appointment.
export function ReceptionistVitalsProvider({ children }) {
  const [savedVitals, setSavedVitals] = useState({});
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
  const value = useMemo(() => ({ withSavedVitals, recordVitals }), [withSavedVitals, recordVitals]);
  return <VitalsContext.Provider value={value}>{children}</VitalsContext.Provider>;
}

export const useReceptionistVitals = () => useContext(VitalsContext);
