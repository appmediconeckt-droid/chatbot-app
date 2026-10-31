import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Text from '../../../../components/TranslatedText';
import SignaturePad from '../../../../components/SignaturePad';
import { createDoctorStyles, colors } from '../theme';
import { doctorSignatureUrl, saveDoctorSignature, validateSignatureFile } from '../api/doctorSignature';

export default function DoctorPrescriptionSignature({ profile, loading, onSaved }) {
  const [drawing, setDrawing] = useState(false);
  const [file, setFile] = useState(null);
  const [validPreview, setValidPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const disabled = loading || saving || !(profile?._id || profile?.id);
  const savedUrl = doctorSignatureUrl(profile);
  const preview = file?.uri || savedUrl;

  const selectFile = async asset => {
    setError(''); setNotice(''); setValidPreview(false); setFile(null);
    try {
      await validateSignatureFile(asset);
      setFile(asset);
    } catch (failure) {
      setError(failure.message);
    }
  };
  const upload = async () => {
    setError(''); setNotice('');
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || 'Signature image could not be opened.');
      if (result.assets?.[0]) await selectFile(result.assets[0]);
    } catch (failure) {
      setError(failure.message);
    }
  };
  const save = async () => {
    if (disabled || !file || !validPreview) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await saveDoctorSignature(profile, file);
      onSaved(updated);
      setFile(null); setValidPreview(false);
      setNotice('Signature saved. It will appear on your appointment prescriptions and downloaded PDFs.');
    } catch (failure) {
      // The server's generic "Error updating user" comes with the reason in
      // `error`; show it so a failed save says why.
      const server = failure.response?.data;
      const reason = server?.error && server.error !== server.message ? ` (${server.error})` : '';
      setError(server?.message ? `${server.message}${reason}` : failure.message || 'Unable to save your signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Prescription Signature</Text>
      <Text style={s.help}>Draw or upload your signature once to use it on your prescriptions.</Text>
      <View style={s.actions}>
        <Button label="Upload Image" disabled={disabled} onPress={upload} />
        <Button label="Draw Signature" disabled={disabled} onPress={() => { setError(''); setNotice(''); setDrawing(true); }} />
      </View>
      <View style={s.preview}>
        {preview ? (
          <Image key={preview} source={{ uri: preview }} style={s.image}
            accessibilityLabel={file ? 'Selected signature preview' : 'Saved doctor signature'}
            onLoad={() => { if (file) setValidPreview(true); }}
            onError={() => { setValidPreview(false); setError(file ? 'This image could not be opened. Choose another signature image.' : 'Saved signature preview could not be loaded.'); }} />
        ) : <Text style={s.help}>{loading ? 'Loading signature...' : 'No signature saved yet'}</Text>}
      </View>
      <Text style={s.help}>PNG, JPG or WebP, up to 5 MB. Use a clear signature on a white or transparent background.</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!notice && <Text accessibilityRole="alert" style={s.success}>{notice}</Text>}
      <View style={s.actions}>
        {!!file && <Button label="Cancel" disabled={saving} onPress={() => { setFile(null); setValidPreview(false); setError(''); setNotice(''); }} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Save Signature" disabled={disabled || !file || !validPreview} onPress={save} style={[s.button, s.save, (disabled || !file || !validPreview) && s.disabled]}>
          {saving && <ActivityIndicator color="#FFFFFF" size="small" />}
          <Text style={s.saveText}>{saving ? 'Saving signature...' : 'Save Signature'}</Text>
        </Pressable>
      </View>
      {drawing && <SignaturePad visible title="Draw Signature" signerName={profile?.fullName || profile?.name}
        onCancel={() => setDrawing(false)} onDone={asset => { setDrawing(false); selectFile(asset); }} />}
    </View>
  );
}

function Button({ label, disabled, onPress }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}

const s = createDoctorStyles({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 16, marginBottom: 18, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  help: { fontSize: 12, color: colors.muted, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#FFFFFF' },
  buttonText: { fontSize: 13, fontWeight: '700', color: colors.blue },
  save: { backgroundColor: colors.blue, borderColor: colors.blue },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  preview: { height: 120, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 96, resizeMode: 'contain' },
  error: { color: '#B42318', fontSize: 13 },
  success: { color: '#047857', fontSize: 13, lineHeight: 20 },
});
