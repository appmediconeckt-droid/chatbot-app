import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { PATIENT_GRADIENT, GRADIENT_DIRECTION } from '../../../../theme/palette';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import axiosInstance from '../../../../axiosConfig';
import useLanguageRender from '../../../../hooks/useLanguageRender';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── DiceBear URL helpers (ported from iOS utils/avatarProfile) ───────────────
const DEFAULT_STYLE = 'lorelei';
const DEFAULT_BACKGROUND = 'b6e3f4';

const buildAvatarUrl = (seed, style = DEFAULT_STYLE, backgroundColor = DEFAULT_BACKGROUND, options = {}) => {
  const safeSeed = encodeURIComponent(seed || `avatar-${Date.now()}`);
  const safeBackground = encodeURIComponent(String(backgroundColor).replace('#', ''));
  const optionParams = Object.entries(options)
    .filter(([, value]) => value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const params = `seed=${safeSeed}&radius=50&backgroundColor=${safeBackground}${optionParams ? `&${optionParams}` : ''}`;
  return `https://api.dicebear.com/7.x/${style}/png?${params}`;
};

const createAvatarProfile = (seed, style = DEFAULT_STYLE, backgroundColor = DEFAULT_BACKGROUND, options = {}) => ({
  seed,
  style,
  backgroundColor,
  options,
  source: 'generated',
  url: buildAvatarUrl(seed, style, backgroundColor, options),
});

const SKIN_COLORS = [
  { label: 'Very Fair', value: 'ffdbb4' }, { label: 'Fair', value: 'edb98a' },
  { label: 'Light', value: 'fd9841' }, { label: 'Medium', value: 'd08b5b' },
  { label: 'Tan', value: 'ae5d29' }, { label: 'Dark', value: '614335' },
];

const MALE_HAIR_OPTIONS = [
  { label: 'Short', value: 'shortFlat' }, { label: 'Round', value: 'shortRound' },
  { label: 'Curly', value: 'shortCurly' }, { label: 'Waved', value: 'shortWaved' },
  { label: 'Caesar', value: 'theCaesar' }, { label: 'Side Part', value: 'theCaesarAndSidePart' },
  { label: 'Sides', value: 'sides' }, { label: 'Fro', value: 'fro' },
  { label: 'Fro Band', value: 'froBand' }, { label: 'Dreads', value: 'dreads01' },
  { label: 'Shaved', value: 'shavedSides' }, { label: 'Hat', value: 'hat' },
  { label: 'Turban', value: 'turban' }, { label: 'Winter Hat', value: 'winterHat1' },
];

const FEMALE_HAIR_OPTIONS = [
  { label: 'Big Hair', value: 'bigHair' }, { label: 'Bob', value: 'bob' },
  { label: 'Bun', value: 'bun' }, { label: 'Curly', value: 'curly' },
  { label: 'Curly 2', value: 'curly2' }, { label: 'Straight', value: 'straight01' },
  { label: 'Straight 2', value: 'straight02' }, { label: 'Long', value: 'longButNotTooLong' },
  { label: 'Dreads', value: 'dreads' }, { label: 'Frizzle', value: 'frizzle' },
  { label: 'Fro', value: 'fro' }, { label: 'Fro Band', value: 'froBand' },
  { label: 'Hijab', value: 'hijab' }, { label: 'Hat', value: 'hat' },
  { label: 'Winter Hat', value: 'winterHat2' },
];

const HAIR_COLORS = [
  { label: 'Black', value: '2c1b18' }, { label: 'Dark Brown', value: '4a312c' },
  { label: 'Brown', value: '724133' }, { label: 'Auburn', value: 'a55728' },
  { label: 'Blonde', value: 'b58143' }, { label: 'Silver', value: 'e8e1e1' },
  { label: 'White', value: 'ecdcbf' }, { label: 'Red', value: 'c93305' },
];

const EYE_OPTIONS = [
  { label: 'Normal', value: 'default' }, { label: 'Close', value: 'close' },
  { label: 'Cry', value: 'cry' }, { label: 'Dizzy', value: 'xDizzy' },
  { label: 'Happy', value: 'happy' }, { label: 'Hearts', value: 'hearts' },
  { label: 'Wink', value: 'wink' }, { label: 'Wink 2', value: 'winkWacky' },
  { label: 'Side', value: 'side' }, { label: 'Squint', value: 'squint' },
  { label: 'Surprised', value: 'surprised' }, { label: 'Closed', value: 'closed' },
];

const EYEBROW_OPTIONS = [
  { label: 'Natural', value: 'defaultNatural' }, { label: 'Default', value: 'default' },
  { label: 'Raised', value: 'raisedExcitedNatural' }, { label: 'Raised 2', value: 'raisedExcited' },
  { label: 'Flat', value: 'flatNatural' }, { label: 'Unibrow', value: 'unibrowNatural' },
  { label: 'Up Down', value: 'upDownNatural' }, { label: 'Sad', value: 'sadConcernedNatural' },
  { label: 'Sad 2', value: 'sadConcerned' }, { label: 'Angry', value: 'angryNatural' },
  { label: 'Angry 2', value: 'angry' },
];

const MOUTH_OPTIONS = [
  { label: 'Smile', value: 'smile' }, { label: 'Neutral', value: 'default' },
  { label: 'Concern', value: 'concerned' }, { label: 'Disbelief', value: 'disbelief' },
  { label: 'Eating', value: 'eating' }, { label: 'Grimace', value: 'grimace' },
  { label: 'Serious', value: 'serious' }, { label: 'Twinkle', value: 'twinkle' },
  { label: 'Tongue', value: 'tongue' }, { label: 'Sad', value: 'sad' },
  { label: 'Scream', value: 'screamOpen' }, { label: 'Vomit', value: 'vomit' },
];

const BEARD_OPTIONS = [
  { label: 'None', value: 'none' }, { label: 'Light', value: 'beardLight' },
  { label: 'Medium', value: 'beardMedium' }, { label: 'Full', value: 'beardMajestic' },
  { label: 'Moustache', value: 'moustacheFancy' },
];

const ACCESSORY_OPTIONS = [
  { label: 'None', value: 'none' }, { label: 'Round', value: 'round' },
  { label: 'Glasses 1', value: 'prescription01' }, { label: 'Glasses 2', value: 'prescription02' },
  { label: 'Sunglasses', value: 'sunglasses' }, { label: 'Wayfarers', value: 'wayfarers' },
];

const FACE_PRESETS = [
  { label: 'Bright', eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile', accessory: 'none', beard: 'none' },
  { label: 'Calm', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'default', accessory: 'none', beard: 'none' },
  { label: 'Serious', eyes: 'side', eyebrows: 'flatNatural', mouth: 'serious', accessory: 'none' },
  { label: 'Kind', eyes: 'squint', eyebrows: 'upDownNatural', mouth: 'twinkle', accessory: 'round' },
  { label: 'Elder', eyes: 'closed', eyebrows: 'defaultNatural', mouth: 'concerned', accessory: 'prescription01', beard: 'beardLight' },
  { label: 'Bold', eyes: 'winkWacky', eyebrows: 'angryNatural', mouth: 'smile', accessory: 'sunglasses', beard: 'moustacheFancy' },
  { label: 'Gentle', eyes: 'happy', eyebrows: 'sadConcernedNatural', mouth: 'smile', accessory: 'prescription02', beard: 'none' },
  { label: 'Unique', eyes: 'hearts', eyebrows: 'raisedExcited', mouth: 'tongue', accessory: 'wayfarers' },
];

const CLOTHES_OPTIONS = [
  { label: 'Blazer', value: 'blazerAndShirt' }, { label: 'Sweater', value: 'collarAndSweater' },
  { label: 'Graphic', value: 'graphicShirt' }, { label: 'Hoodie', value: 'hoodie' },
  { label: 'Overall', value: 'overall' }, { label: 'Crew', value: 'shirtCrewNeck' },
  { label: 'V-neck', value: 'shirtVNeck' },
];

const CLOTHES_COLORS = [
  { label: 'Navy', value: '25557c' }, { label: 'Black', value: '262e33' },
  { label: 'Blue', value: '5199e4' }, { label: 'Mint', value: 'a7ffc4' },
  { label: 'Red', value: 'ff5c5c' }, { label: 'Pink', value: 'ffafb9' },
  { label: 'White', value: 'e6e6e6' }, { label: 'Yellow', value: 'ffffb1' },
];

const BACKGROUND_COLORS = [
  { label: 'Sky', value: 'b6e3f4' }, { label: 'Lilac', value: 'c0aede' },
  { label: 'Rose', value: 'ffd5dc' }, { label: 'Peach', value: 'ffdfbf' },
  { label: 'Mint', value: 'd5f5e3' }, { label: 'Teal', value: 'c8f7f4' },
  { label: 'Gold', value: 'fde68a' }, { label: 'Slate', value: 'cbd5e1' },
];

const DEFAULT_DRAFT = {
  gender: 'male', skinColor: 'edb98a', hair: 'shortFlat', hairColor: '2c1b18',
  eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'smile', beard: 'none',
  accessory: 'none', clothes: 'hoodie', clothesColor: '25557c', backgroundColor: 'b6e3f4',
};

const DICEBEAR_STYLE = 'avataaars';

// ─── Preset avatars (ported from the web AvatarBuilder picker grid) ───────────
// Tapping one fills the whole draft so the customizer below stays in sync.
const PRESET_AVATARS = [
  { id: 'calm-pro',      label: 'Calm Pro',      draft: { ...DEFAULT_DRAFT, gender: 'male',   skinColor: 'edb98a', hair: 'shortRound',        hairColor: '2c1b18', eyes: 'happy',  eyebrows: 'defaultNatural',       mouth: 'smile',   beard: 'none',       accessory: 'none',          clothes: 'blazerAndShirt',    clothesColor: '25557c', backgroundColor: 'b6e3f4' } },
  { id: 'warm-smile',    label: 'Warm Smile',    draft: { ...DEFAULT_DRAFT, gender: 'female', skinColor: 'd08b5b', hair: 'longButNotTooLong', hairColor: '4a312c', eyes: 'default', eyebrows: 'defaultNatural',       mouth: 'smile',   beard: 'none',       accessory: 'none',          clothes: 'shirtCrewNeck',     clothesColor: '5199e4', backgroundColor: 'ffd5dc' } },
  { id: 'friendly-care', label: 'Friendly Care', draft: { ...DEFAULT_DRAFT, gender: 'female', skinColor: 'ffdbb4', hair: 'bob',               hairColor: '724133', eyes: 'happy',  eyebrows: 'defaultNatural',       mouth: 'twinkle', beard: 'none',       accessory: 'none',          clothes: 'hoodie',            clothesColor: 'ffafb9', backgroundColor: 'ffdfbf' } },
  { id: 'steady-guide',  label: 'Steady Guide',  draft: { ...DEFAULT_DRAFT, gender: 'male',   skinColor: 'ae5d29', hair: 'shortFlat',         hairColor: '2c1b18', eyes: 'default', eyebrows: 'defaultNatural',      mouth: 'serious', beard: 'beardLight', accessory: 'none',          clothes: 'collarAndSweater',  clothesColor: '262e33', backgroundColor: 'cbd5e1' } },
  { id: 'soft-focus',    label: 'Soft Focus',    draft: { ...DEFAULT_DRAFT, gender: 'female', skinColor: 'fd9841', hair: 'curly',             hairColor: 'a55728', eyes: 'closed', eyebrows: 'defaultNatural',       mouth: 'smile',   beard: 'none',       accessory: 'round',         clothes: 'shirtVNeck',        clothesColor: 'a7ffc4', backgroundColor: 'd5f5e3' } },
  { id: 'bright-day',    label: 'Bright Day',    draft: { ...DEFAULT_DRAFT, gender: 'male',   skinColor: '614335', hair: 'fro',               hairColor: '2c1b18', eyes: 'happy',  eyebrows: 'raisedExcitedNatural', mouth: 'smile',   beard: 'none',       accessory: 'none',          clothes: 'overall',           clothesColor: 'ffafb9', backgroundColor: 'fde68a' } },
];

const getDraftGenderDefaults = (gender) => ({
  gender,
  hair: gender === 'female' ? FEMALE_HAIR_OPTIONS[0].value : MALE_HAIR_OPTIONS[0].value,
  beard: 'none',
});

const getAvatarGenderFromValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'female') return normalized;
  return null;
};

const buildDiceBearOptions = (draft) => {
  const options = {
    'skinColor[]': draft.skinColor,
    'top[]': draft.hair,
    topProbability: '100',
    'hairColor[]': draft.hairColor,
    'eyes[]': draft.eyes,
    'eyebrows[]': draft.eyebrows,
    'mouth[]': draft.mouth,
    'clothes[]': draft.clothes,
    'clothesColor[]': draft.clothesColor,
  };
  if (draft.gender === 'male' && draft.beard !== 'none') {
    options['facialHair[]'] = draft.beard;
    options['facialHairColor[]'] = draft.hairColor;
    options.facialHairProbability = '100';
  } else {
    options.facialHairProbability = '0';
  }
  if (draft.accessory !== 'none') {
    options['accessories[]'] = draft.accessory;
    options.accessoriesProbability = '100';
  } else {
    options.accessoriesProbability = '0';
  }
  return options;
};

const buildDraftSeed = (userId, draft) => `${userId || 'user'}-${draft.gender}-${draft.hair}-${draft.skinColor}`;
const buildDraftUrl = (draft, seed) => buildAvatarUrl(seed, DICEBEAR_STYLE, draft.backgroundColor, buildDiceBearOptions(draft));

const toDataUrl = (photo) => {
  if (photo.base64.startsWith('data:')) return photo.base64;
  return `data:${photo.type || 'image/jpeg'};base64,${photo.base64}`;
};

const getNestedValue = (source, paths) => {
  for (const path of paths) {
    const value = path.reduce((current, key) => (current == null ? current : current[key]), source);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const getAvatarUrlFromGenerationResponse = (payload) =>
  getNestedValue(payload, [
    ['avatarUrl'], ['url'], ['imageUrl'],
    ['data', 'avatarUrl'], ['data', 'url'], ['data', 'imageUrl'],
    ['result', 'avatarUrl'], ['result', 'url'], ['result', 'imageUrl'],
    ['image'], ['data', 'image'], ['result', 'image'],
  ]);

const buildGeneratedPhotoProfile = (avatarUrl, photo) => ({
  url: avatarUrl,
  seed: `photo-avatar-${Date.now()}`,
  style: 'openai-photo-avatar',
  backgroundColor: '',
  source: 'generated',
  label: 'Photo Avatar',
  options: { inputSource: photo.source, inputFileName: photo.fileName },
});

const AvatarPicker = ({
  visible,
  currentAvatarUrl,
  userId,
  userAge,
  userGender,
  presentation = 'modal',
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  // Open straight to the preset picker + customizer, like the web.
  const [activeTab, setActiveTab] = useState('builder');
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [sourcePhoto, setSourcePhoto] = useState(null);
  const [generatedPhotoAvatar, setGeneratedPhotoAvatar] = useState(null);
  const [isGeneratingPhotoAvatar, setIsGeneratingPhotoAvatar] = useState(false);
  const [photoAvatarError, setPhotoAvatarError] = useState('');
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [imageLoading, setImageLoading] = useState({});
  const [imageErrors, setImageErrors] = useState({});

  const hairOptions = draft.gender === 'male' ? MALE_HAIR_OPTIONS : FEMALE_HAIR_OPTIONS;
  const selectedSeed = useMemo(() => buildDraftSeed(userId, draft), [draft, userId]);
  const builderPreviewUrl = useMemo(() => buildDraftUrl(draft, selectedSeed), [draft, selectedSeed]);

  useEffect(() => {
    if (visible) {
      setPhotoAvatarError('');
      const nextGender = getAvatarGenderFromValue(userGender);
      if (nextGender) {
        setDraft((previous) => ({ ...previous, ...getDraftGenderDefaults(nextGender) }));
      }
    }
  }, [userGender, visible]);

  const setLoading = (url, loading) => {
    if (!url) return;
    setImageLoading((previous) => ({ ...previous, [url]: loading }));
  };
  const markImageError = (id) => setImageErrors((previous) => ({ ...previous, [id]: true }));

  const updateDraft = (key, value) => {
    setSelectedPresetId(null);
    setDraft((previous) => ({
      ...previous,
      ...(key === 'gender' ? getDraftGenderDefaults(value) : { [key]: value }),
    }));
  };

  const applyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setDraft({ ...preset.draft });
  };

  const applyFacePreset = (preset) => {
    setSelectedPresetId(null);
    setDraft((previous) => ({
      ...previous,
      eyes: preset.eyes,
      eyebrows: preset.eyebrows,
      mouth: preset.mouth,
      accessory: preset.accessory || previous.accessory,
      beard: previous.gender === 'male' ? preset.beard || previous.beard : 'none',
    }));
  };

  const randomizeAvatar = () => {
    setSelectedPresetId(null);
    const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];
    const nextGender = draft.gender;
    const nextHairOptions = nextGender === 'male' ? MALE_HAIR_OPTIONS : FEMALE_HAIR_OPTIONS;
    const nextBeard = nextGender === 'male' ? randomFrom(BEARD_OPTIONS).value : 'none';
    setDraft({
      gender: nextGender,
      skinColor: randomFrom(SKIN_COLORS).value,
      hair: randomFrom(nextHairOptions).value,
      hairColor: randomFrom(HAIR_COLORS).value,
      eyes: randomFrom(EYE_OPTIONS).value,
      eyebrows: randomFrom(EYEBROW_OPTIONS).value,
      mouth: randomFrom(MOUTH_OPTIONS).value,
      beard: nextBeard,
      accessory: randomFrom(ACCESSORY_OPTIONS).value,
      clothes: randomFrom(CLOTHES_OPTIONS).value,
      clothesColor: randomFrom(CLOTHES_COLORS).value,
      backgroundColor: randomFrom(BACKGROUND_COLORS).value,
    });
  };

  const buildPhotoFromAsset = (asset, source) => {
    if (!asset.uri || !asset.base64) return null;
    return {
      uri: asset.uri,
      base64: asset.base64,
      type: asset.type || 'image/jpeg',
      fileName: asset.fileName || asset.uri.split('/').pop() || `avatar-photo-${Date.now()}.jpg`,
      source,
    };
  };

  const generateAvatarFromPhoto = async (photo) => {
    setIsGeneratingPhotoAvatar(true);
    setPhotoAvatarError('');
    setGeneratedPhotoAvatar(null);
    try {
      const response = await axiosInstance.post(
        '/api/avatar/analyze-and-generate',
        {
          photoBase64: toDataUrl(photo),
          userId: userId || '',
          age: userAge || '',
          gender: userGender || '',
          fileName: photo.fileName,
          contentType: photo.type,
          source: photo.source,
        },
        { timeout: 90000 },
      );

      const payload = response.data || {};
      const avatarUrl = getAvatarUrlFromGenerationResponse(payload);
      if (!avatarUrl) {
        throw new Error(payload.message || 'Avatar service did not return an avatar image.');
      }

      const nextAvatar = buildGeneratedPhotoProfile(avatarUrl, photo);
      setGeneratedPhotoAvatar(nextAvatar);
      setImageErrors((previous) => ({ ...previous, [avatarUrl]: false }));
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Unable to convert this photo into an avatar.';
      setPhotoAvatarError(message);
      Alert.alert('Avatar error', message);
    } finally {
      setIsGeneratingPhotoAvatar(false);
    }
  };

  const selectPhoto = async (source) => {
    setPhotoAvatarError('');
    try {
      const picker = source === 'camera' ? launchCamera : launchImageLibrary;
      const result = await picker({
        mediaType: 'photo',
        cameraType: 'front',
        includeBase64: true,
        quality: 0.6,
        maxWidth: 768,
        maxHeight: 768,
        selectionLimit: 1,
      });

      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage || result.errorCode);

      const nextPhoto = buildPhotoFromAsset(result.assets?.[0] || {}, source);
      if (!nextPhoto) throw new Error('Please choose a valid photo and try again.');

      setSourcePhoto(nextPhoto);
      await generateAvatarFromPhoto(nextPhoto);
    } catch (err) {
      const message = err.message || 'Unable to open photo picker.';
      setPhotoAvatarError(message);
      Alert.alert('Photo error', message);
    }
  };

  const handleUseAvatar = () => {
    if (activeTab === 'photo' && generatedPhotoAvatar) {
      onSelect(generatedPhotoAvatar.url);
      onClose();
      return;
    }
    const profile = createAvatarProfile(selectedSeed, DICEBEAR_STYLE, draft.backgroundColor, buildDiceBearOptions(draft));
    onSelect(profile.url);
    onClose();
  };

  if (!visible) return null;

  const renderPreviewImage = (url, label, fallbackText = '?', errorKey = url) => (
    <View style={styles.previewCard}>
      <Text style={styles.previewLabel}>{label}</Text>
      {url && !imageErrors[errorKey] ? (
        <Image
          source={{ uri: url }}
          style={styles.previewImage}
          onLoadStart={() => setLoading(url, true)}
          onLoadEnd={() => setLoading(url, false)}
          onError={() => markImageError(errorKey)}
        />
      ) : (
        <View style={styles.previewEmpty}>
          <Text style={styles.previewEmptyText}>{fallbackText}</Text>
        </View>
      )}
      {imageLoading[url] && <ActivityIndicator style={styles.imageLoader} size="small" color="#4A90E2" />}
    </View>
  );

  const renderFacePresets = () => (
    <View style={styles.partSection}>
      <Text style={styles.sectionLabel}>{t('Face')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {FACE_PRESETS.map((preset) => {
          const previewDraft = {
            ...draft,
            eyes: preset.eyes,
            eyebrows: preset.eyebrows,
            mouth: preset.mouth,
            accessory: preset.accessory || draft.accessory,
            beard: draft.gender === 'male' ? preset.beard || draft.beard : 'none',
          };
          const selected = draft.eyes === preset.eyes && draft.eyebrows === preset.eyebrows && draft.mouth === preset.mouth;
          const previewUrl = buildDraftUrl(previewDraft, `${selectedSeed}-face-${preset.label}`);
          return (
            <TouchableOpacity
              key={preset.label}
              style={[styles.textOption, styles.avatarOption, selected && styles.textOptionSelected]}
              onPress={() => applyFacePreset(preset)}
            >
              <Image source={{ uri: previewUrl }} style={styles.optionImage} />
              <Text style={[styles.textOptionLabel, selected && styles.textOptionLabelSelected]}>{t(preset.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPartOptions = (label, options, value, keyName, mode = 'text') => (
    <View style={styles.partSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.map((option) => {
          const selected = value === option.value;
          const previewDraft =
            keyName === 'gender'
              ? { ...draft, ...getDraftGenderDefaults(option.value) }
              : { ...draft, [keyName]: option.value };
          const previewUrl = buildDraftUrl(previewDraft, `${selectedSeed}-${keyName}-${option.value}`);
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                mode === 'swatch' ? styles.swatchOption : styles.textOption,
                mode === 'avatar' && styles.avatarOption,
                selected && (mode === 'swatch' ? styles.swatchOptionSelected : styles.textOptionSelected),
              ]}
              onPress={() => updateDraft(keyName, option.value)}
            >
              {mode === 'swatch' && <View style={[styles.swatchColor, { backgroundColor: `#${option.value}` }]} />}
              {mode === 'avatar' && <Image source={{ uri: previewUrl }} style={styles.optionImage} />}
              <Text
                style={[
                  mode === 'swatch' ? styles.swatchLabel : styles.textOptionLabel,
                  selected && (mode === 'swatch' ? styles.swatchLabelSelected : styles.textOptionLabelSelected),
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const pickerContent = (
    <View style={[styles.overlay, presentation === 'inline' && styles.inlineOverlay]}>
      <View style={[styles.sheet, presentation === 'inline' && styles.inlineSheet, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Choose Avatar')}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>x</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewRow}>
          {renderPreviewImage(currentAvatarUrl || '', 'Current')}
          {activeTab === 'photo'
            ? renderPreviewImage(
                generatedPhotoAvatar?.url || sourcePhoto?.uri || '',
                generatedPhotoAvatar ? 'Avatar' : 'Photo',
                'AV',
                generatedPhotoAvatar?.url || sourcePhoto?.uri || 'photo',
              )
            : renderPreviewImage(builderPreviewUrl, 'Preview')}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.creatorBody}>
          {activeTab === 'photo' && (
            <View style={styles.photoCaptureSection}>
              <Text style={styles.sectionLabel}>{t('Use your own photo')}</Text>
              <Text style={styles.photoHelpText}>
                Take a clear selfie or choose one from your gallery. The app sends it to your avatar
                service and uses the returned avatar.
              </Text>

              <View style={styles.photoActionRow}>
                <TouchableOpacity
                  style={[styles.photoActionButton, isGeneratingPhotoAvatar && styles.photoActionButtonOff]}
                  onPress={() => selectPhoto('camera')}
                  disabled={isGeneratingPhotoAvatar}
                >
                  <Text style={styles.photoActionButtonText}>{t('Take Photo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoActionButtonSecondary, isGeneratingPhotoAvatar && styles.photoActionButtonOff]}
                  onPress={() => selectPhoto('library')}
                  disabled={isGeneratingPhotoAvatar}
                >
                  <Text style={styles.photoActionButtonSecondaryText}>{t('Choose Photo')}</Text>
                </TouchableOpacity>
              </View>

              {isGeneratingPhotoAvatar && (
                <View style={styles.photoStatusBox}>
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <Text style={styles.photoStatusText}>{t('Creating avatar from your photo...')}</Text>
                </View>
              )}

              {photoAvatarError ? <Text style={styles.photoErrorText}>{photoAvatarError}</Text> : null}

              {sourcePhoto && (
                <View style={styles.photoResultRow}>
                  <View style={styles.photoResultCard}>
                    <Text style={styles.photoResultLabel}>{t('Selected Photo')}</Text>
                    <Image source={{ uri: sourcePhoto.uri }} style={styles.photoResultImage} />
                  </View>
                  <View style={styles.photoResultCard}>
                    <Text style={styles.photoResultLabel}>{t('Generated Avatar')}</Text>
                    {generatedPhotoAvatar?.url ? (
                      <Image
                        source={{ uri: generatedPhotoAvatar.url }}
                        style={styles.photoResultImage}
                        onError={() => markImageError(generatedPhotoAvatar.url)}
                      />
                    ) : (
                      <View style={styles.photoResultEmpty}>
                        <Text style={styles.photoResultEmptyText}>AV</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {sourcePhoto && !isGeneratingPhotoAvatar && (
                <TouchableOpacity style={styles.retryButton} onPress={() => generateAvatarFromPhoto(sourcePhoto)}>
                  <Text style={styles.retryButtonText}>{t('Generate Again')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'builder' && (
            <>
              <View style={styles.partSection}>
                <Text style={styles.sectionLabel}>{t('Choose an avatar')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {PRESET_AVATARS.map((preset) => {
                    const selected = selectedPresetId === preset.id;
                    const previewUrl = buildDraftUrl(preset.draft, `preset-${preset.id}`);
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.textOption, styles.avatarOption, selected && styles.textOptionSelected]}
                        onPress={() => applyPreset(preset)}
                      >
                        <Image source={{ uri: previewUrl }} style={styles.optionImage} />
                        <Text style={[styles.textOptionLabel, selected && styles.textOptionLabelSelected]}>{t(preset.label)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {renderPartOptions('Gender', [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }], draft.gender, 'gender', 'avatar')}
              {renderFacePresets()}
              {renderPartOptions('Skin', SKIN_COLORS, draft.skinColor, 'skinColor', 'swatch')}
              {renderPartOptions('Hair', hairOptions, draft.hair, 'hair', 'avatar')}
              {renderPartOptions('Hair Color', HAIR_COLORS, draft.hairColor, 'hairColor', 'swatch')}
              {renderPartOptions('Eyes', EYE_OPTIONS, draft.eyes, 'eyes')}
              {renderPartOptions('Eyebrows', EYEBROW_OPTIONS, draft.eyebrows, 'eyebrows')}
              {renderPartOptions('Mouth', MOUTH_OPTIONS, draft.mouth, 'mouth')}
              {draft.gender === 'male' && renderPartOptions('Beard', BEARD_OPTIONS, draft.beard, 'beard')}
              {renderPartOptions('Accessories', ACCESSORY_OPTIONS, draft.accessory, 'accessory')}
              {renderPartOptions('Clothes', CLOTHES_OPTIONS, draft.clothes, 'clothes')}
              {renderPartOptions('Clothes Color', CLOTHES_COLORS, draft.clothesColor, 'clothesColor', 'swatch')}
              {renderPartOptions('Background', BACKGROUND_COLORS, draft.backgroundColor, 'backgroundColor', 'swatch')}
              <TouchableOpacity style={styles.randomButton} onPress={randomizeAvatar}>
                <Text style={styles.randomButtonText}>{t('Random Avatar')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.useButtonWrap,
              ((activeTab === 'photo' && !generatedPhotoAvatar) || isGeneratingPhotoAvatar) && styles.useButtonOff,
            ]}
            onPress={handleUseAvatar}
            disabled={(activeTab === 'photo' && !generatedPhotoAvatar) || isGeneratingPhotoAvatar}
            activeOpacity={0.85}
          >
            <LinearGradient colors={PATIENT_GRADIENT} {...GRADIENT_DIRECTION} style={styles.useButton}>
              <Text style={styles.useText}>{t('Use Avatar')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (presentation === 'inline') return pickerContent;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {pickerContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  inlineOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, elevation: 50 },
  sheet: { maxHeight: '94%', padding: 18, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#fff' },
  inlineSheet: { maxHeight: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  closeText: { fontSize: 18, color: '#4b5563', fontWeight: '700' },
  tabContainer: { flexDirection: 'row', padding: 4, marginBottom: 16, borderRadius: 12, backgroundColor: '#f3f4f6' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { color: '#6b7280', fontSize: 14, fontWeight: '700' },
  activeTabText: { color: '#2563eb' },
  previewRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  previewCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#f8fafc', position: 'relative' },
  previewLabel: { marginBottom: 10, color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  previewImage: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#e2e8f0' },
  previewEmpty: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  previewEmptyText: { color: '#64748b', fontSize: 28, fontWeight: '800' },
  imageLoader: { position: 'absolute', top: 70, alignSelf: 'center' },
  creatorBody: { paddingBottom: 18 },
  partSection: { marginBottom: 18 },
  sectionLabel: { marginBottom: 10, color: '#334155', fontSize: 14, fontWeight: '700' },
  optionRow: { gap: 10, paddingBottom: 2 },
  photoCaptureSection: { paddingTop: 4, paddingBottom: 18 },
  photoHelpText: { marginTop: -4, marginBottom: 16, color: '#64748b', fontSize: 13, lineHeight: 19 },
  photoActionRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  photoActionButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#4A90E2' },
  photoActionButtonSecondary: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#4A90E2', backgroundColor: '#fff' },
  photoActionButtonOff: { opacity: 0.55 },
  photoActionButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  photoActionButtonSecondaryText: { color: '#2563eb', fontSize: 14, fontWeight: '800' },
  photoStatusBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12, borderRadius: 10, backgroundColor: '#eff6ff' },
  photoStatusText: { flex: 1, color: '#1e40af', fontSize: 13, fontWeight: '700' },
  photoErrorText: { marginBottom: 12, color: '#b91c1c', fontSize: 13, fontWeight: '700' },
  photoResultRow: { flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 14 },
  photoResultCard: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#f8fafc' },
  photoResultLabel: { marginBottom: 8, color: '#475569', fontSize: 12, fontWeight: '800' },
  photoResultImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e2e8f0' },
  photoResultEmpty: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  photoResultEmptyText: { color: '#64748b', fontSize: 20, fontWeight: '900' },
  retryButton: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#eef6ff' },
  retryButtonText: { color: '#2563eb', fontSize: 14, fontWeight: '800' },
  textOption: { minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  textOptionSelected: { borderColor: '#4A90E2', backgroundColor: '#eff6ff' },
  textOptionLabel: { color: '#475569', fontSize: 12, fontWeight: '700' },
  textOptionLabelSelected: { color: '#1d4ed8' },
  swatchOption: { alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#f8fafc' },
  swatchOptionSelected: { borderColor: '#4A90E2', backgroundColor: '#eff6ff' },
  swatchColor: { width: 40, height: 40, marginBottom: 5, borderRadius: 20 },
  swatchLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  swatchLabelSelected: { color: '#1d4ed8' },
  avatarOption: { padding: 8 },
  optionImage: { width: 62, height: 62, marginBottom: 6, borderRadius: 31, backgroundColor: '#e2e8f0' },
  randomButton: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, backgroundColor: '#eef6ff', marginTop: 4, marginBottom: 16 },
  randomButtonText: { color: '#2563eb', fontSize: 14, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  cancelText: { color: '#4b5563', fontSize: 15, fontWeight: '700' },
  // Wrapper owns flex/radius and clips the gradient; inner view is just the fill.
  useButtonWrap: { flex: 2, borderRadius: 10, overflow: 'hidden' },
  useButton: { alignItems: 'center', paddingVertical: 13 },
  useButtonOff: { opacity: 0.5 },
  useText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default AvatarPicker;
