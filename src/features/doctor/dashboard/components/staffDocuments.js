// Staff documents (ID proof, certificates, contracts…). The staff API has no
// document endpoint (web keeps none either), so documents are stored on this
// device: the picked file is copied into the app's private storage and listed
// per staff member. Opening hands the file to the phone's viewer app through
// the native PdfFileOpener.openFile (FileProvider, files-path).
import { Linking, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';

const MAX_BYTES = 10 * 1024 * 1024;
const keyFor = (rawId) => `doctorStaffDocs:${rawId}`;

const kindOf = (mime = '', name = '') => {
  const lower = `${mime} ${name}`.toLowerCase();
  if (lower.includes('pdf')) return 'PDF';
  if (lower.includes('image') || /\.(jpe?g|png|heic|webp)\b/.test(lower)) return 'Image';
  if (lower.includes('word') || /\.docx?\b/.test(lower)) return 'Word';
  return 'File';
};

const formatSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const loadStaffDocuments = async (rawId) => {
  if (!rawId) return [];
  try {
    const list = JSON.parse((await AsyncStorage.getItem(keyFor(rawId))) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const saveList = (rawId, list) => AsyncStorage.setItem(keyFor(rawId), JSON.stringify(list)).catch(() => {});

// Picks a PDF / image / Word file and keeps a private copy. Resolves to the
// updated list, or null if the user cancelled.
export const addStaffDocument = async (rawId) => {
  if (!rawId) throw new Error('Save the staff member first, then add documents.');
  let picked;
  try {
    [picked] = await pick({ type: [types.pdf, types.images, types.doc, types.docx] });
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return null;
    throw err;
  }
  if (!picked?.uri) throw new Error('Could not read the selected file.');
  if (picked.size && picked.size > MAX_BYTES) throw new Error('Documents must be 10 MB or smaller.');

  const name = picked.name || `document-${Date.now()}`;
  const [copy] = await keepLocalCopy({ files: [{ uri: picked.uri, fileName: name }], destination: 'documentDirectory' });
  if (copy?.status !== 'success') throw new Error(copy?.copyError || 'Could not save the document on this device.');

  const doc = {
    id: `doc-${Date.now()}`,
    name,
    mime: picked.type || '',
    type: kindOf(picked.type, name),
    size: formatSize(picked.size),
    uri: copy.localUri,
    addedAt: new Date().toISOString(),
  };
  const list = [doc, ...(await loadStaffDocuments(rawId))];
  await saveList(rawId, list);
  return list;
};

export const removeStaffDocument = async (rawId, docId) => {
  const list = await loadStaffDocuments(rawId);
  const doc = list.find((d) => d.id === docId);
  if (doc?.uri) RNFS.unlink(doc.uri.replace(/^file:\/\//, '')).catch(() => {});
  const next = list.filter((d) => d.id !== docId);
  await saveList(rawId, next);
  return next;
};

// Delete every stored document when the staff member is removed.
export const clearStaffDocuments = async (rawId) => {
  const list = await loadStaffDocuments(rawId);
  list.forEach((doc) => doc.uri && RNFS.unlink(doc.uri.replace(/^file:\/\//, '')).catch(() => {}));
  AsyncStorage.removeItem(keyFor(rawId)).catch(() => {});
};

export const openStaffDocument = async (doc) => {
  const path = String(doc?.uri || '').replace(/^file:\/\//, '');
  if (!path || !(await RNFS.exists(path))) throw new Error('This document is no longer on this device.');
  const opener = NativeModules.PdfFileOpener;
  if (opener?.openFile) {
    await opener.openFile(path, doc.mime || '');
    return;
  }
  // Older native build without openFile.
  await Linking.openURL(doc.uri);
};
