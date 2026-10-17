import { prescriptionBrand, prescriptionWatermark, prescriptionFooter } from './prescriptionBrandAssets';
import { consultationData } from './consultationData';
import toImageUri from './imageUri';
import { API_BASE_URL } from '../axiosConfig';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Web prescriptionDate: en-IN "05 Oct 2026", "—" when missing.
export const documentDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const listText = value => Array.isArray(value) ? value.filter(Boolean).join(', ') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const approvedSignature = record => {
  const completedVisit = record.source === 'appointment' && record.verificationStatus === 'completed';
  if (record.verificationStatus !== 'verified' && !completedVisit) return '';
  const uri = toImageUri(record.prescriptionSignatureUrl || record.signatureUrl || record.psychiatrist?.prescriptionSignature || record.doctorProfile?.prescriptionSignature || record.doctor?.prescriptionSignature || record.doctorProfile?.prescriptionSignatureUrl || record.psychiatrist?.prescriptionSignatureUrl || record.doctor?.prescriptionSignatureUrl);
  if (!uri || !/^(https?:|data:image\/|\/)/i.test(uri)) return '';
  return uri.startsWith('/') ? `${API_BASE_URL}${uri}` : uri;
};

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
  const patient = record.patient || record.patientSnapshot || record.patientData || record.user || {};
  const provider = record.doctorProfile || record.psychiatrist || record.doctor || record.psychiatristSnapshot || record.counselor || {};
  const clinic = record.clinic || (typeof record.clinic_id === 'object' ? record.clinic_id : null) || {};
  const candidates = [doctorName, record.psychiatrist?.name, record.psychiatrist?.fullName,
    record.doctorProfile?.fullName, record.doctorProfile?.name, record.doctor?.name, record.doctor?.fullName, record.doctorName, record.doctor_name,
    record.psychiatristSnapshot?.name, record.counselor?.fullName];
  return {
    qualification: listText(provider.qualification),
    specialization: listText(provider.specialization),
    registration: listText(provider.registrationNumber || provider.registration_number || provider.medicalRegistrationNumber || provider.licenseNumber),
    clinic: listText(clinic.clinic_name || clinic.name || record.clinic_name),
    address: listText(clinic.location || clinic.address),
    doctorPhone: listText(clinic.phone_number || clinic.phoneNumber || clinic.phone || provider.phoneNumber || provider.phone),
    doctorEmail: listText(provider.email),
    prescriptionId: listText(record.prescriptionNumber || record.id || record._id),
    opd: listText(record.opdNumber ?? record.token_number ?? record.token),
    patientId: listText(patient.id || patient._id || record.patientId),
    age: listText(patient.age ?? record.age),
    phone: listText(patient.phoneNumber || patient.phone || patient.mobile || record.phoneNumber || record.phone),
    weight: listText(record.vitals?.weight ?? patient.weight ?? patient.medicalInfo?.weight ?? record.weight),
    allergies: listText(patient.allergies || patient.medicalInfo?.allergies || record.allergies),
    signature: approvedSignature(record),
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
  const base = appointmentToDocument({
    ...rx,
    patient: rx.patient || rx.patientSnapshot || { name: rx.patientName, gender: rx.patientGender },
    prescriptionNumber: rx.prescriptionNumber || rx.rxNumber,
    token_number: rx.tokenNumber ?? rx.token_number,
    doctorProfile: rx.doctorProfile || rx.psychiatrist || rx.doctor || { fullName: rx.doctorName, qualification: rx.qualification, specialization: rx.specialization },
  });
  const data = { ...base, ...rx.document };
  return {
    ...data,
    clinic: data.clinic || listText(rx.clinic?.name),
    address: data.address || listText(rx.clinic?.location),
    doctorPhone: data.doctorPhone || listText(rx.clinic?.phone),
    opd: data.opd || listText(rx.tokenNumber),
    issue: data.issue === '—' ? rx.complaint || data.issue : data.issue,
    tests: data.tests.length ? data.tests : (rx.testDetails || rx.tests || []).map(test => typeof test === 'string' ? { testName: test } : test),
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

// Shared by patient downloads and staff/doctor native PDF printing.
export const buildConsultationDocumentHtml = (data = {}) => {
  const field = (label, value) => `<div><span>${esc(label)}</span><strong>${esc(value || '—')}</strong></div>`;
  const section = (title, value) => value ? `<section><h3>${esc(title)}</h3><p>${esc(value)}</p></section>` : '';
  const medicines = (data.medicines || []).length
    ? `<table><thead><tr><th>S. No.</th><th>Medicine name</th><th>Strength</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${data.medicines.map((m, index) => `<tr><td>${index + 1}</td><td><strong>${esc(m.name || m.medicine || '—')}</strong></td><td>${esc(m.strength || '—')}</td><td>${esc(m.dosage || '—')}</td><td>${esc(medicineDuration(m) || '—')}</td><td>${esc([medicineTiming(m), m.instructions].filter(Boolean).join(' / ') || '—')}</td></tr>`).join('')}</tbody></table>`
    : `<p>${esc(data.medicine || 'No medicines prescribed.')}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 12px Arial, sans-serif; color: #193d42; }
.doc { position: relative; min-height: 265mm; padding: 16px; border-bottom: 10px solid #89aaa2; }
.head { display: flex; align-items: flex-start; gap: 20px; padding-bottom: 22px; border-bottom: 1px solid #a7bdbc; }
.brand { width: 115px; text-align: center; flex-shrink: 0; }
.brand img { width: 115px; height: 115px; object-fit: contain; }
.brand strong { display: block; font-size: 20px; color: #269b9c; }
.brand small { font-size: 8px; }
.issuer { flex: 1; border-left: 1px solid #bdcecc; padding-left: 20px; }
h2 { font-size: 23px; margin: 4px 0 8px; }
p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; margin: 4px 0; }
.reference { width: 140px; border-left: 1px solid #bdcecc; padding-left: 14px; }
.reference div { margin-bottom: 10px; }
span { font-size: 10px; font-weight: bold; }
strong { overflow-wrap: anywhere; }
.reference strong { display: block; margin-top: 4px; font-weight: normal; }
.patient { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; padding: 18px; margin: 18px 0; background: #f1f4f3; border-radius: 8px; }
.patient div { display: grid; grid-template-columns: 90px 1fr; gap: 10px; }
h1 { font-size: 25px; margin: 16px 0; }
h1 small { font-size: 8px; letter-spacing: 1px; float: right; padding-top: 12px; }
h3 { font-size: 14px; margin: 0 0 8px; }
section { margin: 18px 0; }
table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
th { background: #dfe9e6; } th, td { border: 1px solid #bdcecc; text-align: left; padding: 8px; overflow-wrap: anywhere; vertical-align: top; }
th:first-child { width: 7%; } th:nth-child(2) { width: 24%; }
tr, .foot { break-inside: avoid; } thead { display: table-header-group; }
.clinical { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 32px; }
.signoff { width: 180px; text-align: center; } .signature { height: 60px; display: flex; justify-content: center; align-items: flex-end; }
.signature img { max-width: 150px; max-height: 60px; object-fit: contain; }
.brandFooter { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-top: 1px solid #a7bdbc; margin-top: 65px; padding-top: 16px; font-size: 9px; }
.watermark { position: absolute; right: 0; bottom: 90px; width: 170px; opacity: .045; z-index: -1; }
</style></head><body><article class="doc">
<img class="watermark" src="${prescriptionWatermark}" alt=""/>
<header class="head"><div class="brand"><img src="${prescriptionBrand}" alt="Humaeli - Talk. Connect. Feel Supported."/></div>
<div class="issuer"><h2>${esc(data.doctor)}</h2>${[data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`, data.clinic, data.address, data.doctorPhone, data.doctorEmail].filter(Boolean).map(value => `<p>${esc(value)}</p>`).join('')}</div>
<div class="reference">${field('Date', data.date)}${data.opd ? field('OPD / Token No.', data.opd) : ''}${data.prescriptionId ? field('Prescription No.', data.prescriptionId) : ''}</div></header>
<section class="patient">${field('Patient name', data.patient)}${field('Patient ID', data.patientId)}${field('Age / Gender', [data.age && `${data.age} years`, data.gender !== '—' && data.gender].filter(Boolean).join(' / '))}${field('Weight', data.weight && `${data.weight}${/kg/i.test(data.weight) ? '' : ' kg'}`)}${field('Contact No.', data.phone)}${field('Allergies', data.allergies || 'Not recorded')}</section>
<h1>℞ Prescription <small>FOR A HEALTHIER YOU</small></h1>${medicines}
<section class="clinical"><p><strong>Consultation for: </strong>${esc(data.issue)}</p><p><strong>Diagnosis: </strong>${esc(data.diagnosis)}</p></section>
${section('Advice & Instructions', data.advice)}${data.notes !== data.advice ? section('Additional notes', data.notes) : ''}
${(data.tests || []).length ? `<section><h3>Recommended tests</h3>${data.tests.map(test => `<p><strong>${esc(test.testName || test.name)}</strong>${esc(testLine(test))}</p>`).join('')}</section>` : ''}
<footer class="foot"><div><h3>Next Follow-up:</h3><p>${esc(followUpText(data))}</p></div><div class="signoff"><div class="signature">${data.signature ? `<img src="${esc(data.signature)}" alt="Doctor signature"/>` : ''}</div><span>Issued by</span><p><strong>${esc(data.doctor)}</strong></p>${data.qualification ? `<p>${esc(data.qualification)}</p>` : ''}${data.registration ? `<p>Reg. No.: ${esc(data.registration)}</p>` : ''}</div></footer>
<div class="brandFooter"><div>This prescription is provided by</div><strong><img src="${prescriptionFooter}" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"/>HUMAELI</strong><div>Talk. Connect. Feel Supported.</div></div>
</article></body></html>`;
};
