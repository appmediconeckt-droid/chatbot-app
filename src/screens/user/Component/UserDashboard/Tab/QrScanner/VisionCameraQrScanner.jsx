import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import PATIENT from '../../../../../../theme/palette';

export default function VisionCameraQrScanner({ visible, onClose, onScanned }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [torchOn, setTorchOn] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    scannedRef.current = false;
    setIsActive(true);
    setTorchOn(false);
  }, [visible]);

  const scanAgain = useCallback(() => {
    scannedRef.current = false;
    setIsActive(true);
  }, []);

  const closeScanner = useCallback(() => {
    scannedRef.current = false;
    setIsActive(false);
    setTorchOn(false);
    onClose?.();
  }, [onClose]);

  const handleScanned = useCallback((value) => {
    if (scannedRef.current) return;

    scannedRef.current = true;
    setIsActive(false);

    if (onScanned) {
      onScanned(value);
      return;
    }

    Alert.alert('QR Code Scanned', value, [
      { text: 'Scan Again', onPress: scanAgain },
      { text: 'Close', onPress: closeScanner },
    ]);
  }, [closeScanner, onScanned, scanAgain]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const value = codes.find((code) => code.value)?.value;
      if (value) handleScanned(value);
    },
  });

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {device != null && hasPermission ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible && isActive}
          codeScanner={codeScanner}
          torch={torchOn ? 'on' : 'off'}
        />
      ) : (
        <View style={s.fallback} />
      )}

      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={closeScanner} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
          <Text style={s.title}>Scan QR Code</Text>
          <Pressable
            onPress={() => setTorchOn((value) => !value)}
            disabled={device == null || !hasPermission}
            style={[s.iconBtn, (device == null || !hasPermission) && s.disabledBtn]}
            hitSlop={10}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color="#FFF" />
          </Pressable>
        </View>

        {device != null && hasPermission ? (
          <View style={s.frameWrap}>
            <View style={s.frame}>
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
            </View>
            <Text style={s.hint}>Align the QR code within the frame to scan</Text>
          </View>
        ) : (
          <View style={s.permissionBox}>
            <Ionicons name="camera-outline" size={40} color="#FFF" />
            <Text style={s.permissionTitle}>
              {device == null ? 'No camera available' : 'Camera access needed'}
            </Text>
            {device != null && (
              <>
                <Text style={s.permissionText}>
                  Allow camera access to scan appointment QR codes.
                </Text>
                <Pressable onPress={requestPermission} style={s.permissionBtn}>
                  <Text style={s.permissionBtnText}>Enable Camera</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const FRAME_SIZE = 250;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.45 },
  title: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: PATIENT.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  hint: {
    marginTop: 22,
    fontSize: 13.5,
    color: '#FFF',
    opacity: 0.85,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  permissionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 6 },
  permissionText: { fontSize: 13.5, color: '#D1D5DB', textAlign: 'center' },
  permissionBtn: {
    marginTop: 10,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 23,
    backgroundColor: PATIENT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
