// The consultant's prescription signature. It's drawn live on the signature
// pad at each approval and uploaded then. Uses the live API as is:
//   GET   /api/auth/me              → user.prescriptionSignatureUrl
//   PATCH /api/auth/update/:userId  → multipart `prescriptionSignature` (PNG)
// On approval the server copies the signature URL onto the prescription.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL } from '../axiosConfig';
import toImageUri from './imageUri';

export const signatureUrlOf = user =>
  toImageUri(user?.prescriptionSignatureUrl) ||
  toImageUri(user?.prescriptionSignature?.url) ||
  toImageUri(user?.prescriptionSignature) ||
  '';

// Signature URL stored on a prescription (copied at approval / creation).
export const prescriptionSignatureUrlOf = item => {
  const source = item?.psychiatrist || item?.consultant || item?.doctor || {};
  return (
    toImageUri(item?.prescriptionSignatureUrl) ||
    toImageUri(item?.signatureUrl) ||
    toImageUri(item?.prescriptionSignature) ||
    signatureUrlOf(source) ||
    ''
  );
};

export const fetchMySignature = async () => {
  const res = await axiosInstance.get('/api/auth/me');
  const user = res.data?.user || res.data?.data || {};
  return { userId: String(user._id || user.id || ''), url: signatureUrlOf(user) };
};

// Saves a drawn signature (file from SignaturePad) to the profile and
// resolves its hosted URL.
export const saveMySignature = async (file, userId) => {
  let id = userId || (await AsyncStorage.getItem('userId'));
  if (!id) id = (await fetchMySignature().catch(() => ({}))).userId;
  if (!id) throw new Error('Consultant profile not found. Please log in again.');
  const formData = new FormData();
  formData.append('prescriptionSignature', file);
  const res = await axiosInstance.patch(
    `${API_BASE_URL}/api/auth/update/${encodeURIComponent(id)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  const url = signatureUrlOf(res.data?.user || res.data?.data || {});
  if (!url) throw new Error('The signature could not be saved. Please try again.');
  return url;
};
