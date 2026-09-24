// with a plain Alert so it works on iOS too.
import { Alert } from 'react-native';
import RNFS from 'react-native-fs';

const toSafeString = (value) => value ?? '';

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

function buildSimplePdf(lines) {
  const contentLines = lines
    .map((line, index) => {
      const y = 780 - index * 20;
      return `BT /F1 12 Tf 40 ${y} Td (${sanitizePdfText(line)}) Tj ET`;
    })
    .join('\n');

  const contentStream = `${contentLines}\n`;
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`,
  ];

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
    const lines = [
      'MEDICAL PRESCRIPTION',
      `Prescription ID: RX-${record?.id ?? ''}    Generated: ${new Date().toLocaleDateString()}`,
      '',
      'PATIENT INFORMATION',
      `Name: ${name}    Age/Gender: ${patient?.age} years, ${patient?.gender}`,
      `Phone: ${patient?.phone}    Blood Group: ${patient?.bloodGroup}`,
      '',
      'VISIT DETAILS',
      `Date: ${record?.date}    Time: ${record?.time}`,
      `Doctor: ${record?.doctor}    Follow-up: ${record?.followUp}`,
      '',
      'MEDICAL INFORMATION',
      ...wrapText(`Problem: ${record?.problem}`),
      ...wrapText(`Diagnosis: ${record?.diagnosis}`),
      '',
      'VITAL SIGNS',
      `Blood Pressure: ${record?.bp} mmHg    Pulse Rate: ${record?.pulse} bpm    Temperature: ${record?.temperature}`,
      '',
      'PRESCRIPTION',
      ...wrapText(`Medication: ${record?.tablets}`),
      `Duration: ${record?.days}`,
      '',
      "DOCTOR'S INSTRUCTIONS",
      ...wrapText(record?.prescription),
    ].slice(0, 38); // one A4 page
    await RNFS.writeFile(pdfPath, buildSimplePdf(lines), 'utf8');
    Alert.alert('Prescription downloaded', `Saved to ${pdfPath}`);
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
