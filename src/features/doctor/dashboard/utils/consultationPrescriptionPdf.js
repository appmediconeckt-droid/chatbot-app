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
import { medicineTiming, medicineDuration } from '../../../../utils/consultationPrescriptionDocument';
export { medicineTiming, medicineDuration } from '../../../../utils/consultationPrescriptionDocument';

const NAVY = 'rgb(30,58,138)';
const INK = 'rgb(36,50,71)';

const str = (value) => (value === null || value === undefined ? '' : String(value));
const esc = (value) => str(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');


const section = (title, content) => (content
  ? `<section><h2>${esc(title)}</h2><p>${esc(content)}</p></section>`
  : '');

const buildHtml = (data) => {
  const medicines = Array.isArray(data.medicines) ? data.medicines : [];
  const tests = Array.isArray(data.tests) ? data.tests : [];
  const table = medicines.length
    ? `<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Timing</th><th>Duration</th></tr></thead><tbody>${
      medicines.map((m) => `<tr><td>${esc(m.name || m.medicine || '-')}</td><td>${esc(m.dosage || '-')}</td><td>${esc(medicineTiming(m) || '-')}</td><td>${esc(medicineDuration(m) || '-')}</td></tr>`).join('')
    }</tbody></table>`
    : section('Prescribed medicines', data.medicine || 'No medicines prescribed.');
  const testSections = tests.map((test) => section(
    `Recommended test: ${test.testName || test.name || 'Test'}`,
    [test.completeBy && `Complete by: ${test.completeBy}`, test.reason, test.instructions].filter(Boolean).join('\n') || 'As advised',
  )).join('');
  const followUp = data.followUp || (data.followUpRequired ? 'Required' : 'No follow-up scheduled');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 18mm 18mm 20mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: ${INK}; font-size: 11pt; line-height: 1.33; }
h1 { margin: 0 0 4mm; font-size: 24pt; font-weight: bold; color: ${NAVY}; line-height: 1.1; }
.line { margin: 0 0 4mm; white-space: pre-wrap; word-wrap: break-word; }
.strong { font-size: 12pt; font-weight: bold; }
section { margin: 0 0 3mm; page-break-inside: avoid; }
h2 { margin: 0 0 4mm; font-size: 12pt; font-weight: bold; color: ${NAVY}; }
section p { margin: 0 0 4mm; white-space: pre-wrap; word-wrap: break-word; }
table { width: 100%; border-collapse: collapse; margin: 0 0 12mm; font-size: 10pt; }
th { background: ${NAVY}; color: #fff; font-weight: bold; text-align: left; padding: 4mm; }
td { padding: 4mm; text-align: left; vertical-align: top; color: rgb(80,80,80); word-wrap: break-word; }
tbody tr:nth-child(even) td { background: rgb(245,245,245); }
tr { page-break-inside: avoid; }
</style></head><body>
<h1>Prescription</h1>
<p class="line strong">Prescribing doctor: ${esc(data.doctor)}</p>
<p class="line">Date: ${esc(data.date)}</p>
<p class="line strong">Patient: ${esc(data.patient)}</p>
<p class="line">Gender: ${esc(data.gender)} | Consultation for: ${esc(data.issue)}</p>
${section('Diagnosis', data.diagnosis)}
${table}
${section('Advice & instructions', data.advice)}
${data.notes !== data.advice ? section('Additional notes', data.notes) : ''}
${testSections}
${section('Follow-up', followUp)}
${section('Issued by', data.doctor)}
</body></html>`;
};

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
      const path = await nativePdf.createPdf(buildHtml(data), fileName);
      if (path && typeof path === 'string' && await RNFS.exists(path)) {
        await saveAndOpenPdf(path, fileName);
        return;
      }
    }
    // The fallback retains every section and paginates long prescriptions.
    const lines = [
      'Prescription',
      `Prescribing doctor: ${str(data.doctor)}`,
      `Date: ${str(data.date)}`,
      `Patient: ${str(data.patient)}`,
      `Gender: ${str(data.gender)} | Consultation for: ${str(data.issue)}`,
      '', 'Diagnosis', str(data.diagnosis), '', 'Prescribed medicines',
      ...((data.medicines || []).length
        ? data.medicines.map((m) => [m.name || m.medicine, m.dosage, medicineTiming(m), medicineDuration(m)].filter(Boolean).join(' - '))
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
