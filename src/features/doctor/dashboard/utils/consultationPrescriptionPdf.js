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
import { medicineTiming, medicineDuration, buildConsultationDocumentHtml, followUpText, shortRxNumber } from '../../../../utils/consultationPrescriptionDocument';
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
    // Plain-text fallback (only when the native PDF module is unavailable): the
    // same sections and rules as the designed PDF — short Rx number, nothing
    // printed for details that were not recorded.
    const has = value => { const text = str(value).trim(); return Boolean(text) && text !== '—' && !/^(none|not)\s*recorded$/i.test(text); };
    const section = (title, body) => (has(body) ? ['', title.toUpperCase(), str(body)] : []);
    const followUp = followUpText(data);
    const lines = [
      `PRESCRIPTION  -  ${str(data.doctor)}`,
      ...[data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`].filter(has),
      ...[data.clinic, data.address].filter(has).length ? [[data.clinic, data.address].filter(has).join(', ')] : [],
      ...[data.doctorPhone, data.doctorEmail].filter(has).length ? [[data.doctorPhone, data.doctorEmail].filter(has).join('   |   ')] : [],
      '',
      [`Date: ${str(data.date)}`, has(data.opd) && `Token: #${data.opd}`, has(data.prescriptionId) && `Rx No.: ${shortRxNumber(data.prescriptionId)}`].filter(Boolean).join('   |   '),
      '',
      `PATIENT: ${str(data.patient)}`,
      ...[
        ['Age / Gender', [has(data.age) && `${data.age} yrs`, has(data.gender) && data.gender].filter(Boolean).join(' / ')],
        ['Contact', data.phone],
        ['Weight', data.weight],
        ['Allergies', data.allergies],
        ['Patient ID', data.patientId],
      ].filter(([, value]) => has(value)).map(([label, value]) => `${label}: ${str(value)}`),
      ...section('Consultation for', data.issue),
      ...section('Diagnosis', data.diagnosis),
      '', 'PRESCRIBED MEDICINES',
      ...((data.medicines || []).length
        ? data.medicines.map((m, index) => `${index + 1}. ${[m.name || m.medicine, m.strength, m.dosage, medicineTiming(m), medicineDuration(m), m.instructions].filter(has).join('  -  ')}`)
        : [has(data.medicine) ? str(data.medicine) : 'No medicines prescribed.']),
      ...((data.tests || []).length ? ['', 'RECOMMENDED TESTS', ...data.tests.map(test => `- ${test.testName || test.name || 'Test'}${[test.completeBy && ` (by ${test.completeBy})`, test.reason && ` - ${test.reason}`, test.instructions && ` - ${test.instructions}`].filter(Boolean).join('')}`)] : []),
      ...section('Advice & instructions', data.advice),
      ...(data.notes !== data.advice ? section('Additional notes', data.notes) : []),
      ...(followUp !== 'No follow-up scheduled' ? ['', `NEXT FOLLOW-UP: ${followUp}`] : []),
      '', '', `Issued by: ${str(data.doctor)}`,
      ...(has(data.qualification) ? [str(data.qualification)] : []),
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
