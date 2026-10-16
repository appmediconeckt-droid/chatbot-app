// with a plain Alert so it works on iOS too.
import { Alert, NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { buildPrescriptionPaperHtml, doctorRxToPaper } from '../../../../utils/prescriptionPaper';

// Always a string: visit records carry numbers too (age, pulse, days…), and
// calling .trim()/.replace() on a number threw 'undefined is not a function',
// which failed both the HTML PDF and its simple-PDF fallback.
const toSafeString = (value) => (value === null || value === undefined ? '' : String(value));

const isAscii = (value) => /^[\x20-\x7E]*$/.test(toSafeString(value));
const sanitizePdfText = (value) =>
  toSafeString(value)
    .replace(/[\\()]/g, (character) => `\\${character}`)
    .replace(/[^\x20-\x7E]/g, '?');

const fileSafeName = (value) =>
  toSafeString(value)
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '') || 'Prescription';

let isGeneratingPdf = false;

const display = (value, fallback = 'N/A') => {
  const text = toSafeString(value).trim();
  return text && text !== 'undefined' && text !== 'null' ? text : fallback;
};

const normalizeMedicineList = (record = {}) => {
  if (Array.isArray(record.medicines) && record.medicines.length) {
    return record.medicines.map((medicine) => ({
      name: display(medicine.name || medicine.medicine),
      dosage: display(medicine.dosage),
      timing: display(
        Array.isArray(medicine.timeOfDay || medicine.timings)
          ? (medicine.timeOfDay || medicine.timings).filter(Boolean).join(', ')
          : medicine.timeOfDay || medicine.timings || medicine.timing || medicine.when,
      ),
      duration: display(
        medicine.duration || [medicine.durationValue, medicine.durationType].filter(Boolean).join(' '),
      ),
    }));
  }

  const medication = display(record.tablets || record.medicine || record.medication, '');
  if (!medication) return [];
  return medication
    .split(/[;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      dosage: 'N/A',
      timing: 'N/A',
      duration: display(record.days || record.duration),
    }));
};

// Same page as the patient's prescription view and the psychiatrist preview
// (utils/prescriptionPaper): this visit is mapped onto the shared paper.
const buildVisitPrescriptionHtml = (patient = {}, record = {}) => {
  const real = (value) => {
    const text = display(value, '');
    return text === 'N/A' ? '' : text;
  };
  const tests = Array.isArray(record.tests || record.recommendedTests)
    ? (record.tests || record.recommendedTests).filter(Boolean)
    : [];
  const age = real(patient.age);
  const gender = real(patient.gender);
  const paper = doctorRxToPaper({
    id: record.id,
    rxNumber: record.id ? `RX-${String(record.id).slice(-6).toUpperCase()}` : '',
    date: record.date,
    doctorName: real(record.doctor) || 'Doctor',
    patientName: real(patient.name) || 'Patient',
    complaint: real(record.problem),
    diagnosis: real(record.diagnosis),
    medicines: normalizeMedicineList(record).map((medicine) => ({
      name: medicine.name,
      dosage: real(medicine.dosage),
      timings: real(medicine.timing) ? [real(medicine.timing)] : [],
      duration: real(medicine.duration),
    })),
    advice: real(record.advice || record.prescription || record.instructions),
    tests,
    additionalNotes: real(record.notes || record.additionalNotes || record.additional_notes),
    followUpDate: real(record.followUp) && !/not required/i.test(record.followUp) ? record.followUp : '',
  });
  if (age || gender) {
    const extra = [age && `${age} yrs`, gender].filter(Boolean).join(', ');
    paper.patientName = `${paper.patientName}  (${extra})`;
  }
  return buildPrescriptionPaperHtml(paper);
};

// The PDF is written to the app's own storage (always writable). A copy goes
// to the phone's Downloads folder when Android allows it, and the file opens
// straight away in the phone's PDF viewer (save / share from there) — before,
// it only sat in the private app folder where the doctor couldn't reach it.
export async function saveAndOpenPdf(appPath, fileName) {
  if (!appPath || typeof appPath !== 'string') {
    throw new Error('Prescription PDF could not be created.');
  }
  let downloadsPath = null;
  if (Platform.OS === 'android') {
    try {
      let target = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
      for (let copy = 1; (await RNFS.exists(target)) && copy < 100; copy += 1) {
        target = `${RNFS.DownloadDirectoryPath}/${fileName} (${copy}).pdf`;
      }
      await RNFS.copyFile(appPath, target);
      await RNFS.scanFile(target).catch(() => {});
      downloadsPath = target;
    } catch {
      downloadsPath = null; // scoped storage refused — the viewer below still has it
    }
  }
  let opened = false;
  try {
    const opener = NativeModules.PdfFileOpener;
    if (opener?.open) {
      await opener.open(appPath);
      opened = true;
    }
  } catch {
    opened = false;
  }
  if (downloadsPath) {
    Alert.alert('Prescription downloaded', `Saved to Downloads as ${downloadsPath.split('/').pop()}`);
  } else if (!opened) {
    Alert.alert('Prescription ready', 'The PDF was created but no PDF viewer app was found on this phone.');
  }
}

export function buildSimplePdf(lines) {
  const wrapped = lines.flatMap(line => toSafeString(line).split('\n').flatMap(paragraph => paragraph.match(/.{1,72}(?:\s|$)|.{1,72}/g) || ['']));
  const pages = [];
  for (let index = 0; index < Math.max(wrapped.length, 1); index += 38) pages.push(wrapped.slice(index, index + 38));
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const stream = page.map((line, row) => `BT /F1 12 Tf 40 ${780 - row * 20} Td (${sanitizePdfText(line)}) Tj ET`).join('\n') + '\n';
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>\nendobj\n`,
      `${pageId + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    );
  });

  const header = '%PDF-1.4\n';
  const offsets = [0];
  let currentOffset = header.length;
  for (const object of objects) {
    offsets.push(currentOffset);
    currentOffset += object.length;
  }

  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  const startxref = currentOffset;
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return header + objects.join('') + xref + trailer;
}

// Wrap long text into lines that fit the page (the simple PDF has no auto-wrap).
const wrapText = (text, width = 80) => {
  const out = [];
  String(text ?? '').split('\n').forEach((paragraph) => {
    let line = '';
    paragraph.split(' ').forEach((word) => {
      if ((line + ' ' + word).trim().length > width) {
        if (line) out.push(line);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    });
    out.push(line);
  });
  return out;
};

// Real prescription for one visit record — same sections as the web
// PatientAppointmentDetails/pdfGenerator.js (patient info, visit details,
// medical information, vital signs, prescription, instructions).
export async function downloadVisitPrescriptionPdf(patient, record) {
  if (isGeneratingPdf) return;
  isGeneratingPdf = true;
  try {
    const name = isAscii(patient?.name) && patient?.name ? patient.name : 'Patient';
    const fileName = `Prescription_${fileSafeName(name)}_${fileSafeName(record?.date)}`;
    const pdfPath = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;

    const nativePdf = NativeModules.PrescriptionPrint;
    if (nativePdf?.createPdf) {
      try {
        const nativePath = await nativePdf.createPdf(buildVisitPrescriptionHtml(patient, record), fileName);
        if (nativePath && typeof nativePath === 'string' && await RNFS.exists(nativePath)) {
          await saveAndOpenPdf(nativePath, fileName);
          return;
        }
      } catch (nativeError) {
        console.warn('HTML prescription PDF failed, using simple PDF fallback:', nativeError?.message || nativeError);
      }
    }

    const lines = [
      'MEDICAL PRESCRIPTION',
      `Prescription ID: RX-${record?.id ?? ''}    Generated: ${new Date().toLocaleDateString()}`,
      '',
      'PATIENT INFORMATION',
      `Name: ${name}    Age/Gender: ${display(patient?.age)} years, ${display(patient?.gender)}`,
      `Phone: ${display(patient?.phone)}    Blood Group: ${display(patient?.bloodGroup)}`,
      '',
      'VISIT DETAILS',
      `Date: ${display(record?.date)}    Time: ${display(record?.time)}`,
      `Doctor: ${display(record?.doctor, 'Doctor')}    Follow-up: ${display(record?.followUp, 'Not required')}`,
      '',
      'MEDICAL INFORMATION',
      ...wrapText(`Problem: ${display(record?.problem)}`),
      ...wrapText(`Diagnosis: ${display(record?.diagnosis)}`),
      '',
      'VITAL SIGNS',
      `Blood Pressure: ${display(record?.bp)} mmHg    Pulse Rate: ${display(record?.pulse)} bpm    Temperature: ${display(record?.temperature)}`,
      '',
      'PRESCRIPTION',
      ...wrapText(`Medication: ${display(record?.tablets)}`),
      `Duration: ${display(record?.days)}`,
      '',
      "DOCTOR'S INSTRUCTIONS",
      ...wrapText(display(record?.prescription)),
    ].slice(0, 38); // one A4 page
    await RNFS.writeFile(pdfPath, buildSimplePdf(lines), 'utf8');
    await saveAndOpenPdf(pdfPath, fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert('PDF failed', message || 'Unable to generate the prescription PDF. Please try again.');
  } finally {
    isGeneratingPdf = false;
  }
}

export async function downloadPrescriptionPdf(patientName) {
  if (isGeneratingPdf) return;
  isGeneratingPdf = true;
  try {
    const displayName = isAscii(patientName) && patientName ? patientName : 'Patient';
    const fileName = `Prescription_${fileSafeName(displayName)}`;
    // The app's own sandboxed storage — writable on every Android version with
    // no runtime permission needed. `RNFS.DownloadDirectoryPath` (the shared
    // public Downloads folder) was used before, but Android 10+'s scoped
    // storage blocks direct writes there without extra permission handling
    // this app doesn't have, so every save silently failed.
    const pdfPath = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;

    const lines = [
      'Humaeli Provider Portal',
      'Official Medical Prescription',
      `Patient: ${displayName}`,
      'Date: Oct 24, 2023',
      '',
      'Rx Medications',
      '1. Paracetamol 500mg - 1-0-1 Morning & Evening (After Meals) - 5 Days',
      '2. Cetirizine 10mg - 0-0-1 Night (Before Sleep) - 3 Days',
      '3. Amoxicillin 250mg - 1-1-1 Morning, Afternoon & Evening - 5 Days',
      '4. Pantoprazole 40mg - 1-0-0 Morning (Empty Stomach) - 7 Days',
      '',
      'Doctor Instructions',
      'Take medicine strictly after meals unless specified otherwise.',
      'Rest well for the next 3 days and stay hydrated.',
      'Follow up after 5 days if symptoms persist.',
    ];

    const pdfContent = buildSimplePdf(lines);
    await RNFS.writeFile(pdfPath, pdfContent, 'utf8');

    Alert.alert('PDF downloaded', `The prescription PDF was saved to ${pdfPath}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert('PDF failed', message || 'Unable to generate the prescription PDF. Please try again.');
  } finally {
    isGeneratingPdf = false;
  }
}
