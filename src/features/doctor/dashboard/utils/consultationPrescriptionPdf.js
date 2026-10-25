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
    // One name per visit (patient + date + token): every visit used to save as
    // "prescription_<patient>", so Downloads filled with look-alike copies and an
    // older one (e.g. made before the consultation was completed) got opened.
    const part = value => str(value).replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const fileName = [
      'Prescription',
      part(data.patient) || 'patient',
      data.date && data.date !== '—' ? part(data.date) : '',
      data.opd ? `Token_${part(data.opd)}` : '',
    ].filter(Boolean).join('_');
    const nativePdf = NativeModules.PrescriptionPrint;
    if (nativePdf?.createPdf) {
      const path = await nativePdf.createPdf(buildConsultationDocumentHtml(data), fileName);
      if (path && typeof path === 'string' && await RNFS.exists(path)) {
        // Re-downloading the same visit replaces its earlier copy.
        await saveAndOpenPdf(path, fileName, { replace: true });
        return;
      }
    }
    // The fallback retains every section and paginates long prescriptions.
    const lines = [
      'Prescription',
      `Prescribing doctor: ${str(data.doctor)}`,
      ...[data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`, data.clinic, data.address, data.doctorPhone, data.doctorEmail].filter(Boolean),
      `Date: ${str(data.date)}`,
      // Details that were not recorded are left out.
      ...[
        ['Prescription No.', data.prescriptionId],
        ['OPD / Token No.', data.opd],
        ['Patient ID', data.patientId],
        ['Age', data.age],
        ['Contact No.', data.phone],
        ['Weight', data.weight],
        ['Allergies', data.allergies],
      ]
        .filter(([, value]) => { const text = str(value).trim(); return text && text !== '—' && !/^(none|not)\s*recorded$/i.test(text); })
        .map(([label, value]) => `${label}: ${str(value)}`),
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
    await saveAndOpenPdf(path, fileName, { replace: true });
  } catch (error) {
    Alert.alert('PDF failed', error?.message || 'Unable to download prescription. Please try again.');
  } finally {
    busy = false;
  }
}
