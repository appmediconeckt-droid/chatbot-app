import { Alert, NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

const toSafeString = value => value === null || value === undefined ? '' : String(value);
const sanitizePdfText = value => toSafeString(value)
  .replace(/[\\()]/g, character => `\\${character}`)
  .replace(/[^\x20-\x7E]/g, '?');

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
