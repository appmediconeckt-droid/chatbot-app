import React, { useCallback } from 'react';
import { Modal, NativeModules, Pressable, StatusBar, StyleSheet, Text, TurboModuleRegistry, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PATIENT from '../../../../../../theme/palette';

// VisionCamera's native module ("CameraView") is in the build. Under the New
// Architecture (bridgeless) it can be exposed through the TurboModule registry
// instead of NativeModules, so look in both before saying it's missing.
const hasVisionCameraNativeModule = () => {
  try {
    return NativeModules.CameraView != null || TurboModuleRegistry.get('CameraView') != null;
  } catch {
    return false;
  }
};

export default function QrScannerScreen({ visible, onClose, onScanned }) {
  const renderScanner = useCallback(() => {
    if (!hasVisionCameraNativeModule()) {
      return <CameraUnavailable onClose={onClose} />;
    }

    const VisionCameraQrScanner = require('./VisionCameraQrScanner').default;
    return (
      <VisionCameraQrScanner
        visible={visible}
        onClose={onClose}
        onScanned={onScanned}
      />
    );
  }, [onClose, onScanned, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {renderScanner()}
    </Modal>
  );
}

function CameraUnavailable({ onClose }) {
  // Explicit insets: this screen opens inside a Modal, where SafeAreaView can
  // report 0 on Android and leave content under the status/navigation bars.
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={[s.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
          <Text style={s.title}>Scan QR Code</Text>
          <View style={s.iconBtnPlaceholder} />
        </View>

        <View style={s.permissionBox}>
          <Ionicons name="camera-outline" size={42} color="#FFF" />
          <Text style={s.permissionTitle}>Camera scanner unavailable</Text>
          <Text style={s.permissionText}>
            Please rebuild and reinstall the Android app so the VisionCamera native module is included.
          </Text>
          <Pressable onPress={onClose} style={s.permissionBtn}>
            <Text style={s.permissionBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
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
  iconBtnPlaceholder: { width: 40, height: 40 },
  title: { fontSize: 16, fontWeight: '700', color: '#FFF' },
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
