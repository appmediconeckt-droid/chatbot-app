import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { LANGUAGES, LANG_STORAGE_KEY } from '../../i18n';

const GlobeIcon = ({ color = '#2563EB', size = 22 }) => (
  <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>🌐</Text>
);

export default function LanguageSelector({ iconColor, iconSize }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [scale] = useState(new Animated.Value(0.9));
  const currentLang = i18n.language || 'en';

  const open = useCallback(() => {
    setVisible(true);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 160, friction: 9 }).start();
  }, [scale]);

  const close = useCallback(() => {
    Animated.timing(scale, { toValue: 0.9, duration: 140, useNativeDriver: true }).start(() =>
      setVisible(false)
    );
  }, [scale]);

  const selectLanguage = useCallback(
    async (code) => {
      if (code === currentLang) { close(); return; }
      await i18n.changeLanguage(code);
      await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
      close();
    },
    [currentLang, close]
  );

  const renderItem = ({ item }) => {
    const isActive = item.code === currentLang;
    return (
      <TouchableOpacity
        style={[styles.langRow, isActive && styles.langRowActive]}
        onPress={() => selectLanguage(item.code)}
        activeOpacity={0.7}
      >
        <View style={styles.langLabels}>
          <Text style={[styles.langNative, isActive && styles.langNativeActive]}>{item.native}</Text>
          <Text style={styles.langEnglish}>{item.label}</Text>
        </View>
        {isActive && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity onPress={open} style={styles.trigger} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <GlobeIcon color={iconColor || '#2563EB'} size={iconSize || 22} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
        <Animated.View style={[styles.sheet, { transform: [{ scale }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('language:selectLanguage')}</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            bounces={false}
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: '82%',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  closeBtn: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  langRowActive: {
    backgroundColor: '#EFF6FF',
  },
  langLabels: {
    flex: 1,
  },
  langNative: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  langNativeActive: {
    color: '#2563EB',
  },
  langEnglish: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '400',
  },
  checkmark: {
    fontSize: 17,
    color: '#2563EB',
    fontWeight: '700',
    marginLeft: 8,
  },
});
