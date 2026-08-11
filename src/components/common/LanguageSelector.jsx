import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { LANGUAGES, saveUserLanguage, LANG_STORAGE_KEY } from '../../i18n';
import { useLanguageContext } from '../../contexts/LanguageContext';
import useLanguageRender from '../../hooks/useLanguageRender';
import AutoTranslatedText from '../AutoTranslatedText';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LANG_ACCENT = {
  en: '#3B82F6',
  hi: '#F97316',
  mr: '#8B5CF6',
  ta: '#10B981',
  pa: '#F59E0B',
  bn: '#EC4899',
  gu: '#06B6D4',
  kn: '#EF4444',
  ml: '#6366F1',
  te: '#0EA5E9',
  ur: '#14B8A6',
};

// `brand` (optional): when set, the whole sheet uses this single accent instead
// of the per-language rainbow — used by the patient/user side (green palette).
export default function LanguageSelector({ iconColor, iconSize, userId, role, iconName, brand, triggerStyle, children }) {
  // Blend the brand toward white so the soft fills always belong to whatever
  // accent was passed in - previously these were hardcoded green.
  const mixWithWhite = (hex, amount) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const blend = (c) => Math.round(c + (255 - c) * amount);
    const r = blend((n >> 16) & 255);
    const g = blend((n >> 8) & 255);
    const b = blend(n & 255);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const brandSoft = (brand && mixWithWhite(brand, 0.88)) || '#EFF6FF';
  const brandFaint = (brand && mixWithWhite(brand, 0.95)) || '#F8FAFF';
  const { i18n } = useTranslation();
  const { t } = useLanguageRender();
  const { language: contextLang, setLanguage: setContextLanguage } = useLanguageContext();
  const [visible, setVisible] = useState(false);
  const [scale] = useState(new Animated.Value(0.88));
  const [opacity] = useState(new Animated.Value(0));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en-US');

  // Use context language, which is always in sync
  const currentLang = contextLang || selectedLang || 'en-US';

  const filteredLanguages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return LANGUAGES;

    return LANGUAGES.filter(lang =>
      [lang.label, lang.name, lang.code]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery]);

  const open = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 140, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.88, duration: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setSearchQuery('');
    });
  }, [scale, opacity]);

  const selectLanguage = useCallback(
    async (code) => {
      if (code === currentLang) {
        close();
        return;
      }
      try {
        console.log(`[LanguageSelector] 🌐 Changing language to: ${code}`);

        // Use the context's setLanguage for persistence and i18n change
        // This handles both the state update and storage
        await setContextLanguage(code);

        // Add small delay to ensure state updates propagate
        await new Promise(resolve => setTimeout(resolve, 100));

        // Also save user-specific language if userId and role are available
        if (userId && role) {
          console.log(`[LanguageSelector] Saving user-specific language: ${code}`);
          await saveUserLanguage(userId, role, code);
        }

        console.log(`[LanguageSelector] ✅ Language changed successfully to: ${code}`);
        setSelectedLang(code);
        close();
      } catch (error) {
        console.error('[LanguageSelector] ❌ Failed to change language:', error);
        // Revert on error
        setSelectedLang(currentLang);
      }
    },
    [currentLang, close, userId, role, setContextLanguage]
  );

  const renderItem = ({ item, index }) => {
    const isActive = item.code === currentLang;
    const accent = brand || LANG_ACCENT[item.code] || '#3B82F6';
    const initial = item.name?.charAt(0) || item.label?.charAt(0) || '?';

    return (
      <TouchableOpacity
        style={[
          styles.langRow,
          isActive && styles.langRowActive,
          isActive && brand && { backgroundColor: brandFaint },
        ]}
        onPress={() => selectLanguage(item.code)}
        activeOpacity={0.65}
      >
        {isActive && <View style={[styles.activeBar, { backgroundColor: accent }]} />}

        <View style={[styles.langBadge, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
          <Text style={[styles.langBadgeText, { color: accent }]}>{initial}</Text>
        </View>

        <View style={styles.langLabels}>
          <Text style={[styles.langNative, isActive && { color: accent }]}>{item.name || item.label}</Text>
          <AutoTranslatedText style={styles.langEnglish}>
            {item.label}
          </AutoTranslatedText>
        </View>

        {isActive ? (
          <View style={[styles.checkCircle, { backgroundColor: accent }]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        ) : (
          <View style={styles.checkCircleEmpty} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        onPress={open}
        style={triggerStyle || styles.trigger}
        activeOpacity={0.7}
        hitSlop={children ? undefined : { top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {children ? (
          children
        ) : iconName ? (
          <Ionicons name={iconName} size={iconSize || 22} color={iconColor || '#111827'} />
        ) : (
          <Text style={{ fontSize: iconSize || 22, lineHeight: (iconSize || 22) + 2 }}>🌐</Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />

        <Animated.View style={[styles.sheet, { transform: [{ scale }], opacity }]}>
          {/* Header */}
          <View style={[styles.header, brand && { backgroundColor: brandFaint }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrap, brand && { backgroundColor: brandSoft }]}>
                {brand ? (
                  <Ionicons name="globe-outline" size={20} color={brand} />
                ) : (
                  <Text style={styles.headerIcon}>🌐</Text>
                )}
              </View>
              <View>
                <Text style={styles.headerTitle}>{t('language:selectLanguage')}</Text>
                <Text style={styles.headerSub}>Choose your preferred language</Text>
              </View>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Search Box */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <View style={[styles.searchIconWrap, brand && { backgroundColor: brandSoft }]}>
                <Ionicons name="search-outline" size={18} color={brand || '#2563EB'} />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder={t('search language') || 'Search languages...'}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {filteredLanguages.length > 0 ? (
            <FlatList
              data={filteredLanguages}
              keyExtractor={(item) => item.code}
              renderItem={renderItem}
              showsVerticalScrollIndicator={true}
              scrollIndicatorInsets={{ right: 2 }}
              bounces={false}
              nestedScrollEnabled={true}
              style={styles.list}
              scrollEnabled={true}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No languages found</Text>
            </View>
          )}

          {/* Bottom pill */}
          <View style={styles.footer}>
            <View style={styles.footerPill} />
          </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    position: 'absolute',
    top: '20%',
    left: '6%',
    right: '6%',
    maxHeight: SCREEN_HEIGHT * 0.65,
    minHeight: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#F8FAFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 0,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  list: {
    flexGrow: 0,
    maxHeight: SCREEN_HEIGHT * 0.50,
    paddingHorizontal: 0,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  langRowActive: {
    backgroundColor: '#F8FAFF',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  langBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
    flexShrink: 0,
  },
  langBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  langLabels: {
    flex: 1,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  langEnglish: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '400',
    marginTop: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  checkMark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 14,
  },
  checkCircleEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  footerPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
});
