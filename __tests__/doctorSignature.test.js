import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../src/axiosConfig';
import DoctorPrescriptionSignature from '../src/features/doctor/dashboard/components/DoctorPrescriptionSignature';
import SignaturePad from '../src/components/SignaturePad';
import { doctorSignatureUrl, saveDoctorSignature, validateSignatureFile } from '../src/features/doctor/dashboard/api/doctorSignature';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'android', select: options => options.android }, StyleSheet: { create: value => value },
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/SignaturePad', () => 'SignaturePad');
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('react-native-fs', () => ({ stat: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, API_BASE_URL: 'https://example.test', default: { defaults: { baseURL: 'https://example.test' }, patch: jest.fn() } }));

const profile = { _id: 'doctor-1', fullName: 'Test Doctor' };
const image = { uri: 'file:///signature.png', type: 'image/png', fileSize: 1000, fileName: 'signature.png' };
let root;
let formData;
let originalFormData;
const text = children => React.Children.toArray(children).map(child => typeof child === 'string' ? child : text(child.props?.children)).join('');
const button = label => root.root.findAllByType('Pressable').find(node => text(node.props.children) === label);
const press = async label => { await act(async () => { await button(label).props.onPress(); }); };
const render = async onSaved => { await act(async () => { root = create(<DoctorPrescriptionSignature profile={profile} onSaved={onSaved} />); }); };
beforeEach(() => {
  jest.clearAllMocks();
  originalFormData = global.FormData;
  global.FormData = function SignatureFormData() {
    const body = { parts: [], append(...args) { body.parts.push(args); } };
    formData = body;
    return body;
  };
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify(profile));
  AsyncStorage.setItem.mockResolvedValue();
  RNFS.stat.mockResolvedValue({ size: 800 });
  launchImageLibrary.mockResolvedValue({ assets: [image] });
  api.patch.mockResolvedValue({ data: { success: true, user: { ...profile, prescriptionSignature: { url: '/saved-signature.png' } } } });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; global.FormData = originalFormData; });

it('uploads, previews and saves the same multipart field as web, then persists the saved URL', async () => {
  const onSaved = jest.fn();
  await render(onSaved);
  expect(button('Save Signature').props.disabled).toBe(true);
  await press('Upload Image');
  expect(button('Save Signature').props.disabled).toBe(true);
  await act(async () => { root.root.findByType('Image').props.onLoad(); });
  expect(button('Save Signature').props.disabled).toBe(false);
  await press('Save Signature');
  expect(api.patch).toHaveBeenCalledWith('/api/auth/update/doctor-1', formData, { timeout: 30000 });
  expect(formData.parts).toEqual([['prescriptionSignature', { uri: image.uri, type: 'image/png', name: 'signature.png' }]]);
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ prescriptionSignatureUrl: 'https://example.test/saved-signature.png' }));
  expect(JSON.parse(AsyncStorage.setItem.mock.calls[0][1]).prescriptionSignature.url).toBe('/saved-signature.png');
  expect(JSON.stringify(root.toJSON())).toContain('Signature saved.');
});

it('accepts a drawn native PNG through the same preview/save flow', async () => {
  const onSaved = jest.fn();
  await render(onSaved);
  await press('Draw Signature');
  const pad = root.root.findByType(SignaturePad);
  await act(async () => { pad.props.onDone({ uri: 'file:///drawn.png', type: 'image/png', name: 'drawn.png' }); });
  expect(RNFS.stat).toHaveBeenCalledWith('/drawn.png');
  await act(async () => { root.root.findByType('Image').props.onLoad(); });
  await press('Save Signature');
  expect(formData.parts[0][1].uri).toBe('file:///drawn.png');
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it.each([
  { ...image, fileSize: 0 }, { ...image, fileSize: 5 * 1024 * 1024 + 1 }, { ...image, type: 'application/pdf' },
])('rejects invalid image selection %j before upload', async asset => {
  await expect(validateSignatureFile(asset)).rejects.toThrow('PNG, JPG or WebP');
  expect(api.patch).not.toHaveBeenCalled();
});

it('keeps the selected image available for retry after an upload failure', async () => {
  await render(jest.fn());
  await press('Upload Image');
  await act(async () => { root.root.findByType('Image').props.onLoad(); });
  api.patch.mockRejectedValueOnce(new Error('Connection failed'));
  await press('Save Signature');
  expect(JSON.stringify(root.toJSON())).toContain('Connection failed');
  expect(button('Save Signature').props.disabled).toBe(false);
  await press('Save Signature');
  expect(api.patch).toHaveBeenCalledTimes(2);
});

it('blocks a broken preview and does not treat an unconfirmed server response as saved', async () => {
  await render(jest.fn());
  await press('Upload Image');
  await act(async () => { root.root.findByType('Image').props.onError(); });
  expect(button('Save Signature').props.disabled).toBe(true);
  api.patch.mockResolvedValue({ data: { success: true, user: profile } });
  await expect(saveDoctorSignature(profile, image)).rejects.toThrow('Signature could not be saved');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(doctorSignatureUrl({ prescriptionSignature: { secure_url: 'https://example.test/sign.png' } })).toBe('https://example.test/sign.png');
});
