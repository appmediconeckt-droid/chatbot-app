// The doctor's fee currency, set from the clinic fee forms. The server keeps
// one currency per doctor and takes it from the profile country:
//   GET   /api/auth/me                    → user.address.country, user.consultationCurrency
//   PATCH /api/auth/update/:id  multipart   { address, consultationCurrency, consultationFee }
// (the same fields Edit Profile used to send). It applies to every clinic.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL, TUNNEL_HEADERS } from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst, saveDoctorUser } from './doctorAppointments';
import { DEFAULT_COUNTRY, feeCurrencyOf, findCountry } from '../../../../utils/consultationCurrency';

// { user, country, currency, savedCurrency } — the latest server copy when it
// can be read, else the stored one. `savedCurrency` is what the server holds.
export const loadDoctorFeeCurrency = async () => {
  let user = await getStoredDoctorUser();
  try {
    const { data } = await axiosInstance.get('/api/auth/me');
    const me = data?.user || data?.data?.user;
    if (me && typeof me === 'object') {
      await saveDoctorUser(me);
      user = { ...(user || {}), ...me };
    }
  } catch { /* the stored copy will do */ }
  const country = findCountry(user?.address?.country)?.name || DEFAULT_COUNTRY;
  return {
    user,
    country,
    currency: findCountry(country)?.currency || 'INR',
    savedCurrency: String(user?.consultationCurrency || '').trim().toUpperCase() || feeCurrencyOf(user) || '',
  };
};

// True when saving the clinic should also update the doctor's currency.
export const feeCurrencyNeedsSave = (loaded, country) => Boolean(loaded) && (
  country !== loaded.country || (findCountry(country)?.currency || 'INR') !== loaded.savedCurrency
);

// Saves the country (and with it the currency) on the doctor's profile.
// Resolves to the currency the server now holds.
export const saveDoctorFeeCurrency = async (user, country) => {
  const currency = findCountry(country)?.currency || 'INR';
  const userId = pickFirst(user?._id, user?.id, await AsyncStorage.getItem('userId'));
  const accessToken = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
  if (!userId || !accessToken) throw new Error('Your session is incomplete. Please sign in again.');

  const formData = new FormData();
  // `address` replaces the whole saved address, so the rest is sent back unchanged.
  formData.append('address', JSON.stringify({ ...(user?.address || {}), country }));
  formData.append('consultationCurrency', currency);
  // Sent as a pair, as Edit Profile did; the saved fee goes back unchanged.
  const savedFee = Number(user?.consultationFee);
  if (Number.isFinite(savedFee) && savedFee > 0) formData.append('consultationFee', String(savedFee));

  const result = await fetch(`${API_BASE_URL}/api/auth/update/${userId}`, {
    method: 'PATCH',
    headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(data?.message || 'Your fee currency could not be saved.');
  const savedUser = data?.user || data?.data || {};
  if (savedUser && typeof savedUser === 'object') await saveDoctorUser(savedUser);
  return String(savedUser.consultationCurrency || currency).toUpperCase();
};
