// Consultation prescription PDF — the same page as the web's
// common/downloadPrescription.js (downloadConsultationPrescription), which the
// web doctor dashboard, staff patient history and patient prescriptions use.
// The web draws it with jsPDF; here the identical layout is written as HTML and
// printed to an A4 PDF by the native PrescriptionPrint module:
//   "Prescription" (24pt, navy) → Prescribing doctor / Date / Patient /
//   Gender | Consultation for → Diagnosis → medicines table (navy header,
//   striped rows) → Advice → Additional notes → Recommended tests →
//   Follow-up → Issued by. Helvetica, 18mm side margins.
import { Alert, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { buildSimplePdf, saveAndOpenPdf } from './prescriptionPdf';
import { medicineTiming, medicineDuration, buildConsultationDocumentHtml } from '../../../../utils/consultationPrescriptionDocument';
export { medicineTiming, medicineDuration } from '../../../../utils/consultationPrescriptionDocument';

const str = value => value === null || value === undefined ? '' : String(value);

let busy = false;

/**
 * data: { patient, doctor, date, gender, issue, diagnosis, medicines[], medicine,
 *         advice, notes, tests[], followUp, followUpRequired } — the web's
 * prescriptionDetails(record, doctorName) shape.
 */
export async function downloadConsultationPrescriptionPdf(data = {}) {
  if (busy) return;
  busy = true;
  try {
    const safe = str(data.patient).replace(/[^a-zA-Z0-9_-]/g, '_') || 'patient';
    const fileName = `prescription_${safe}`;
    const nativePdf = NativeModules.PrescriptionPrint;
    if (nativePdf?.createPdf) {
      const path = await nativePdf.createPdf(buildConsultationDocumentHtml(data), fileName);
      if (path && typeof path === 'string' && await RNFS.exists(path)) {
        await saveAndOpenPdf(path, fileName);
        return;
      }
    }
    // The fallback retains every section and paginates long prescriptions.
    const lines = [
      'Prescription',
      `Prescribing doctor: ${str(data.doctor)}`,
      ...[data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`, data.clinic, data.address, data.doctorPhone, data.doctorEmail].filter(Boolean),
      `Date: ${str(data.date)}`,
      `Prescription No.: ${str(data.prescriptionId)}`,
      `OPD / Token No.: ${str(data.opd)}`,
      `Patient ID: ${str(data.patientId)}`,
      `Age: ${str(data.age)}`,
      `Contact No.: ${str(data.phone)}`,
      `Weight: ${str(data.weight)}`,
      `Allergies: ${str(data.allergies) || 'Not recorded'}`,
      `Patient: ${str(data.patient)}`,
      `Gender: ${str(data.gender)} | Consultation for: ${str(data.issue)}`,
      '', 'Diagnosis', str(data.diagnosis), '', 'Prescribed medicines',
      ...((data.medicines || []).length
        ? data.medicines.map((m) => [m.name || m.medicine, m.strength, m.dosage, medicineTiming(m), medicineDuration(m), m.instructions].filter(Boolean).join(' - '))
        : [str(data.medicine) || 'No medicines prescribed.']),
      ...(data.advice ? ['', 'Advice & instructions', str(data.advice)] : []),
      ...(data.notes && data.notes !== data.advice ? ['', 'Additional notes', str(data.notes)] : []),
      ...(data.tests || []).flatMap(test => [
        '', `Recommended test: ${test.testName || test.name || 'Test'}`,
        [test.completeBy && `Complete by: ${test.completeBy}`, test.reason, test.instructions].filter(Boolean).join('\n') || 'As advised',
      ]),
      '', 'Follow-up', str(data.followUp || (data.followUpRequired ? 'Required' : 'No follow-up scheduled')),
      '', 'Issued by', str(data.doctor),
    ];
    const path = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;
    await RNFS.writeFile(path, buildSimplePdf(lines), 'utf8');
    await saveAndOpenPdf(path, fileName);
  } catch (error) {
    Alert.alert('PDF failed', error?.message || 'Unable to download prescription. Please try again.');
  } finally {
    busy = false;
  }
}
