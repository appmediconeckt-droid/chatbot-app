import RNFS from 'react-native-fs';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import toImageUri from '../../../../utils/imageUri';
import { saveDoctorUser } from './doctorAppointments';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const doctorSignatureUrl = profile => {
  const uri = toImageUri(profile?.prescriptionSignature || profile?.prescriptionSignatureUrl);
  return uri?.startsWith('/') ? `${API_BASE_URL}${uri}` : uri || '';
};

export async function validateSignatureFile(file) {
  if (!file?.uri || !TYPES.includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image up to 5 MB.');
  const size = file.fileSize ?? Number((await RNFS.stat(file.uri.replace(/^file:\/\//, ''))).size);
  if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) throw new Error('Choose a PNG, JPG or WebP image up to 5 MB.');
  return { uri: file.uri, type: file.type, name: file.fileName || file.name || 'doctor-signature.png' };
}

export async function saveDoctorSignature(profile, file) {
  const userId = profile?._id || profile?.id;
  if (!userId) throw new Error('Doctor profile could not be loaded. Please retry.');
  const body = new FormData();
  body.append('prescriptionSignature', await validateSignatureFile(file));
  // Multipart, like the clinic photo upload: with the instance's default JSON
  // content type axios turned the form into JSON, so no file reached the
  // server and it answered "Error updating user".
  const { data } = await axiosInstance.patch(`/api/auth/update/${encodeURIComponent(String(userId))}`, body, {
    timeout: 30000,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (data?.success === false || !doctorSignatureUrl(data?.user)) throw new Error('Signature could not be saved. Please try again.');
  const updated = { ...profile, ...data.user, prescriptionSignatureUrl: doctorSignatureUrl(data.user) };
  await saveDoctorUser(updated).catch(() => {});
  return updated;
}
