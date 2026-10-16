// A doctor's consultation prescription laid out like the web's
// common/PrescriptionDocument.jsx (+ PrescriptionDocument.css), which the web
// patient Prescriptions tab shows for a doctor's record: Humaeli logo +
// "CONSULTATION RECORD / Prescription", prescribing doctor + date, patient
// strip (name, gender, consultation for), Diagnosis, ℞ medicines table,
// advice, notes, recommended tests, and a Follow-up / Issued by footer.
// doctorRxToDocument feeds both the in-app view and the PDF / print HTML.
import HUMAELI_LOGO from './humaeliLogoDataUri';
import { consultationData } from './consultationData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Web prescriptionDate: en-IN "05 Oct 2026", "—" when missing.
export const documentDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const listText = value => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value || '');

// Web medicineTiming / medicineDuration (prescriptionDetails.js).
export const medicineTiming = (m = {}) =>
  [listText(m.timeOfDay || m.timings), m.timing || m.when].filter(Boolean).join(' · ');
export const medicineDuration = (m = {}) =>
  m.duration || [m.durationValue, m.durationType].filter(Boolean).join(' ');

// Both raw API records and the doctor's formatted queue rows use this shape.
export const appointmentToDocument = (appointment = {}, doctorName) => {
  const input = { ...appointment.__raw };
  Object.entries(appointment).forEach(([key, value]) => {
    if (value !== undefined && value !== null) input[key] = value;
  });
  const record = consultationData(input);
  const patient = record.patient || record.patientData || record.user || {};
  const candidates = [doctorName, record.psychiatrist?.name, record.psychiatrist?.fullName,
    record.doctor?.name, record.doctor?.fullName, record.doctorName, record.doctor_name,
    record.psychiatristSnapshot?.name, record.counselor?.fullName];
  return {
    patient: patient.name || patient.fullName || patient.full_name || record.name || record.patient_name || 'Patient',
    doctor: candidates.find(value => typeof value === 'string' && value.trim() && !/^(dr\.?\s*)?doctor$/i.test(value.trim()))?.trim() || 'Doctor name not recorded',
    date: documentDate(record.issuedAt || record.appointmentDate || record.appointment_date || record.date || record.endTime),
    gender: patient.gender || (record.gender !== 'Not specified' && record.gender) || record.patient_gender || '—',
    issue: record.issue || record.problem || '—',
    diagnosis: record.diagnosis || record.problem || '—',
    medicines: record.medicines,
    medicine: record.medicine || '',
    advice: record.advice || record.instructions || '',
    notes: record.additionalNotes || record.additional_notes || '',
    tests: record.recommendedTests,
    followUp: record.followUpDate || record.follow_up_date,
    followUpRequired: [true, 1, '1', 'true'].includes(record.followUpRequired ?? record.follow_up_required),
  };
};

// A doctor prescription built by the patient's Prescriptions screen → the
// web's prescriptionDetails(record, doctorName) shape.
export const doctorRxToDocument = (rx = {}) => {
  // Appointment prescriptions carry the web mapping (appointmentToDocument);
  // only "Consultation for" falls back to the visit's symptoms.
  if (rx.document) {
    return rx.document.issue === '—' && rx.complaint
      ? { ...rx.document, issue: rx.complaint }
      : rx.document;
  }
  const tests = rx.testDetails?.length
    ? rx.testDetails
    : (rx.tests || []).filter(Boolean).map(name => ({ testName: name }));
  return {
    patient: rx.patientName || 'Patient',
    doctor: rx.doctorName || 'Doctor name not recorded',
    date: documentDate(rx.date),
    gender: rx.patientGender || '—',
    issue: rx.issue || rx.complaint || rx.diagnosis || '—',
    diagnosis: rx.diagnosis || rx.complaint || '—',
    medicines: Array.isArray(rx.medicines) ? rx.medicines : [],
    medicine: '',
    advice: rx.advice || '',
    notes: rx.additionalNotes || '',
    tests,
    followUp: rx.followUpDate || '',
    followUpRequired: [true, 1, '1', 'true'].includes(rx.followUpRequired),
  };
};

export const followUpText = data =>
  data.followUp
    ? documentDate(data.followUp)
    : data.followUpRequired
      ? 'Required'
      : 'No follow-up scheduled';

export const testLine = test =>
  [
    test.completeBy ? ` · By ${documentDate(test.completeBy)}` : '',
    test.reason ? `\n${test.reason}` : '',
    test.instructions ? `\n${test.instructions}` : '',
  ].join('');

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// The same document as an A4 page for the PDF / print dialog (the web
// PrescriptionDocument.css desktop layout).
export const buildConsultationDocumentHtml = data => {
  const medicines = data.medicines.length
    ? `<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Timing</th><th>Duration</th></tr></thead><tbody>${data.medicines
        .map(
          m =>
            `<tr><td><strong>${esc(m.name || m.medicine || '—')}</strong></td><td>${esc(m.dosage || '—')}</td><td>${esc(
              medicineTiming(m) || '—',
            )}</td><td>${esc(medicineDuration(m) || '—')}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : `<p>${esc(data.medicine || 'No medicines prescribed.')}</p>`;
  const section = (title, body) => `<section><h3>${title}</h3>${body}</section>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .doc { background: #fff; color: #243247; padding: 32px; border: 1px solid #e2e8f0; border-radius: 14px; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding-bottom: 24px; border-bottom: 2px solid #2563eb; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 54px; height: 54px; object-fit: contain; }
  .brand span { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #64748b; }
  .brand h2 { margin: 4px 0 0; color: #1e3a8a; font-size: 26px; font-weight: 700; }
  .issuer { display: grid; gap: 6px; text-align: right; font-size: 14px; }
  .issuer span { color: #64748b; }
  .issuer .label { font-size: 10px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; }
  .issuer strong { font-size: 17px; color: #1e3a8a; overflow-wrap: anywhere; }
  .patient { display: grid; grid-template-columns: 1.2fr .6fr 1.2fr; gap: 20px; padding: 20px; margin: 24px 0; background: #f3f6fb; border-radius: 10px; }
  .patient > div, .foot > div { display: grid; gap: 6px; overflow-wrap: anywhere; }
  .patient span, .foot span { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .6px; }
  .patient strong, .foot strong { font-size: 14px; }
  section { margin: 0 0 24px; }
  h3 { font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 10px; }
  section p { margin: 0; font-size: 14px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rx { font-size: 23px; vertical-align: middle; margin-right: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #eff4fc; color: #475569; font-size: 11px; }
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; }
  tr { page-break-inside: avoid; }
  .foot { display: flex; justify-content: space-between; gap: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; page-break-inside: avoid; }
</style></head><body>
<article class="doc">
  <header class="head">
    <div class="brand"><img src="${HUMAELI_LOGO}" alt="Humaeli"/><div><span>CONSULTATION RECORD</span><h2>Prescription</h2></div></div>
    <div class="issuer"><span class="label">Prescribing doctor</span><strong>${esc(data.doctor)}</strong><span>${esc(data.date)}</span></div>
  </header>
  <section class="patient"><div><span>Patient name</span><strong>${esc(data.patient)}</strong></div><div><span>Gender</span><strong>${esc(
    data.gender,
  )}</strong></div><div><span>Consultation for</span><strong>${esc(data.issue)}</strong></div></section>
  ${section('Diagnosis', `<p>${esc(data.diagnosis)}</p>`)}
  ${section('<span class="rx">℞</span> Prescribed medicines', medicines)}
  ${data.advice ? section('Advice &amp; instructions', `<p>${esc(data.advice)}</p>`) : ''}
  ${data.notes && data.notes !== data.advice ? section('Additional notes', `<p>${esc(data.notes)}</p>`) : ''}
  ${
    data.tests.length
      ? section(
          'Recommended tests',
          data.tests
            .map(test => `<p><strong>${esc(test.testName || test.name)}</strong>${esc(testLine(test))}</p>`)
            .join(''),
        )
      : ''
  }
  <footer class="foot"><div><span>Follow-up</span><strong>${esc(followUpText(data))}</strong></div><div><span>Issued by</span><strong>${esc(
    data.doctor,
  )}</strong></div></footer>
</article>
</body></html>`;
};
