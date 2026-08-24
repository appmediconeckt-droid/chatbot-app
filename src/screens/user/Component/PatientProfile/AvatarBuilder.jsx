import React, { useState, useMemo } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import Text from '../../../../components/TranslatedText';
import LinearGradient from "react-native-linear-gradient";
import { PATIENT_GRADIENT, GRADIENT_DIRECTION } from "../../../../theme/palette";
import * as ImagePicker from "react-native-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance, { API_BASE_URL } from "../../../../axiosConfig";
import useLanguageRender from '../../../../hooks/useLanguageRender';

const { width: SW } = Dimensions.get("window");
const BASE = "https://api.dicebear.com/7.x/avataaars/png";

// ─── Correct DiceBear v7 avataaars params (verified from schema.json) ─────────
const SKIN_COLORS = [
  { id: "ffdbb4", label: "Very Fair" },
  { id: "edb98a", label: "Fair"      },
  { id: "fd9841", label: "Light"     },
  { id: "d08b5b", label: "Medium"    },
  { id: "ae5d29", label: "Tan"       },
  { id: "614335", label: "Dark"      },
];

const HAIR_STYLES = [
  { id: "shortFlat",            label: "Short Flat"    },
  { id: "shortRound",           label: "Short Round"   },
  { id: "shortCurly",           label: "Short Curly"   },
  { id: "shortWaved",           label: "Waved"         },
  { id: "sides",                label: "Sides"         },
  { id: "theCaesar",            label: "Caesar"        },
  { id: "shaggy",               label: "Shaggy"        },
  { id: "shaggyMullet",         label: "Mullet"        },
  { id: "dreads01",             label: "Dreads"        },
  { id: "frizzle",              label: "Frizzle"       },
  { id: "bob",                  label: "Bob"           },
  { id: "bun",                  label: "Bun"           },
  { id: "curly",                label: "Curly Long"    },
  { id: "curvy",                label: "Curvy"         },
  { id: "dreads",               label: "Long Dreads"   },
  { id: "fro",                  label: "Fro"           },
  { id: "froBand",              label: "Fro Band"      },
  { id: "longButNotTooLong",    label: "Long"          },
  { id: "straight01",           label: "Straight"      },
  { id: "straight02",           label: "Straight 2"    },
  { id: "bigHair",              label: "Big Hair"      },
  { id: "hat",                  label: "Hat"           },
  { id: "hijab",                label: "Hijab"         },
  { id: "turban",               label: "Turban"        },
  { id: "winterHat1",           label: "Beanie"        },
];

const HAIR_COLORS = [
  { id: "2c1b18", label: "Black"        },
  { id: "4a312c", label: "Dark Brown"   },
  { id: "724133", label: "Brown"        },
  { id: "a55728", label: "Auburn"       },
  { id: "b58143", label: "Blonde"       },
  { id: "d6b370", label: "Light Blonde" },
  { id: "e8e1e1", label: "Silver"       },
  { id: "ecdcbf", label: "White"        },
  { id: "c93305", label: "Red"          },
  { id: "f59797", label: "Pink"         },
];

const EYES = [
  { id: "default",   label: "Normal"    },
  { id: "happy",     label: "Happy"     },
  { id: "wink",      label: "Wink"      },
  { id: "hearts",    label: "Hearts"    },
  { id: "side",      label: "Side"      },
  { id: "squint",    label: "Squint"    },
  { id: "surprised", label: "Surprised" },
  { id: "closed",    label: "Closed"    },
  { id: "xDizzy",    label: "Dizzy"     },
];

const EYEBROWS = [
  { id: "defaultNatural",       label: "Natural"   },
  { id: "default",              label: "Default"   },
  { id: "angryNatural",         label: "Angry"     },
  { id: "flatNatural",          label: "Flat"      },
  { id: "raisedExcitedNatural", label: "Raised"    },
  { id: "sadConcernedNatural",  label: "Sad"       },
  { id: "unibrowNatural",       label: "Unibrow"   },
];

const MOUTH = [
  { id: "smile",   label: "Smile"   },
  { id: "default", label: "Neutral" },
  { id: "serious", label: "Serious" },
  { id: "twinkle", label: "Twinkle" },
  { id: "tongue",  label: "Tongue"  },
  { id: "sad",     label: "Sad"     },
];

const FACIAL_HAIR = [
  { id: "none",            label: "None"        },
  { id: "beardLight",      label: "Light Beard" },
  { id: "beardMajestic",   label: "Full Beard"  },
  { id: "beardMedium",     label: "Medium"      },
  { id: "moustacheFancy",  label: "Moustache"   },
  { id: "moustacheMagnum", label: "Magnum"      },
];

const FACIAL_HAIR_COLORS = [
  { id: "2c1b18", label: "Black"   },
  { id: "4a312c", label: "D.Brown" },
  { id: "724133", label: "Brown"   },
  { id: "b58143", label: "Blonde"  },
  { id: "e8e1e1", label: "Silver"  },
  { id: "c93305", label: "Red"     },
];

const ACCESSORIES = [
  { id: "none",          label: "None"       },
  { id: "kurt",          label: "Round"      },
  { id: "prescription01",label: "Glasses 1"  },
  { id: "prescription02",label: "Glasses 2"  },
  { id: "sunglasses",    label: "Sunglasses" },
  { id: "wayfarers",     label: "Wayfarers"  },
];

const CLOTHING = [
  { id: "blazerAndShirt",   label: "Blazer+Shirt"   },
  { id: "blazerAndSweater", label: "Blazer+Sweater" },
  { id: "hoodie",           label: "Hoodie"         },
  { id: "graphicShirt",     label: "Graphic"        },
  { id: "shirtCrewNeck",    label: "Crew Neck"      },
  { id: "shirtVNeck",       label: "V-Neck"         },
  { id: "overall",          label: "Overall"        },
];

const CLOTHES_COLORS = [
  { id: "3c4f5c", label: "Dark Blue" },
  { id: "262e33", label: "Black"     },
  { id: "65c9ff", label: "Sky Blue"  },
  { id: "e6e6e6", label: "White"     },
  { id: "929598", label: "Grey"      },
  { id: "ff5c5c", label: "Red"       },
  { id: "ffafb9", label: "Pink"      },
  { id: "a7ffc4", label: "Mint"      },
  { id: "ffffb1", label: "Yellow"    },
];

const TABS = [
  { id: "skin",    label: "Skin",   icon: "🎨" },
  { id: "hair",    label: "Hair",   icon: "💇" },
  { id: "eyes",    label: "Eyes",   icon: "👁️" },
  { id: "mouth",   label: "Mouth",  icon: "😊" },
  { id: "facial",  label: "Beard",  icon: "🧔" },
  { id: "extras",  label: "Extras", icon: "👓" },
  { id: "clothes", label: "Outfit", icon: "👕" },
];

const DEFAULT = {
  skinColor: "edb98a", top: "shortFlat", hairColor: "2c1b18",
  eyes: "default", eyebrows: "defaultNatural", mouth: "smile",
  facialHair: "none", facialHairColor: "2c1b18",
  accessories: "none", clothing: "shirtCrewNeck", clothesColor: "3c4f5c",
};

function buildUrl(opts) {
  const stableSeed = [
    opts.skinColor,
    opts.top,
    opts.hairColor,
    opts.eyes,
    opts.eyebrows,
    opts.mouth,
    opts.facialHair,
    opts.facialHairColor,
    opts.accessories,
    opts.clothing,
    opts.clothesColor,
  ].join("-");

  const p = [
    `seed=${stableSeed}`,
    `skinColor[]=${opts.skinColor}`,
    `top[]=${opts.top}`,
    `hairColor[]=${opts.hairColor}`,
    `eyes[]=${opts.eyes}`,
    `eyebrows[]=${opts.eyebrows}`,
    `mouth[]=${opts.mouth}`,
    `clothing[]=${opts.clothing}`,
    `clothesColor[]=${opts.clothesColor}`,
    `radius=50`,
    `scale=85`,
    `backgroundColor[]=ffffff`,
    `translateX=0`,
    `translateY=0`,
    opts.facialHair === "none"
      ? `facialHairProbability=0`
      : `facialHair[]=${opts.facialHair}&facialHairColor[]=${opts.facialHairColor}&facialHairProbability=100`,
    opts.accessories === "none"
      ? `accessoriesProbability=0`
      : `accessories[]=${opts.accessories}&accessoriesProbability=100`,
  ];
  return `${BASE}?${p.join("&")}`;
}

// ─── Map OpenAI face analysis → DiceBear cartoon options ─────────────────────
// Turns the backend's facial analysis into matching avataaars options so the
// cartoon resembles the person (skin, hair, beard, glasses, expression).
const SKIN_MAP = {
  "very fair": "ffdbb4", fair: "edb98a", light: "fd9841",
  medium: "d08b5b", tan: "ae5d29", dark: "614335",
};
const HAIR_COLOR_MAP = {
  black: "2c1b18", "dark brown": "4a312c", brown: "724133", auburn: "a55728",
  blonde: "b58143", "light blonde": "d6b370", silver: "e8e1e1", gray: "e8e1e1",
  grey: "e8e1e1", white: "ecdcbf", red: "c93305", pink: "f59797",
};
const FACIAL_HAIR_MAP = {
  none: "none", "light beard": "beardLight", "medium beard": "beardMedium",
  "full beard": "beardMajestic", moustache: "moustacheFancy",
};

function pickHairStyle(a) {
  const len = String(a.hairLength || "").toLowerCase();
  const type = String(a.hairType || "").toLowerCase();
  const isLong = ["medium", "long", "very long"].includes(len);
  const female = a.gender === "female";
  if (type === "curly" || type === "coily") return isLong ? "curly" : "shortCurly";
  if (type === "wavy") return isLong ? "curvy" : "shortWaved";
  if (isLong || female) return female ? "straight01" : "longButNotTooLong";
  return "shortFlat";
}

function pickAccessory(a) {
  if (!a.glasses) return "none";
  const g = String(a.glassesType || "").toLowerCase();
  if (g.includes("sun")) return "sunglasses";
  if (g.includes("aviator")) return "wayfarers";
  return "prescription01";
}

function mapAnalysisToOptions(a, base = DEFAULT) {
  const opts = { ...base };
  if (!a || typeof a !== "object") return opts;

  const skin = SKIN_MAP[String(a.skinTone || "").toLowerCase()];
  if (skin) opts.skinColor = skin;

  const hc = HAIR_COLOR_MAP[String(a.hairColor || "").toLowerCase()];
  if (hc) { opts.hairColor = hc; opts.facialHairColor = hc; }

  opts.top = pickHairStyle(a);

  const fh = FACIAL_HAIR_MAP[String(a.facialHair || "").toLowerCase()];
  if (fh) opts.facialHair = fh;

  opts.accessories = pickAccessory(a);

  const exp = String(a.expression || "").toLowerCase();
  if (exp.includes("smile") || exp.includes("happy")) { opts.eyes = "happy"; opts.mouth = "smile"; }
  else if (exp.includes("serious")) { opts.eyes = "default"; opts.mouth = "serious"; }
  else if (exp.includes("neutral")) { opts.eyes = "default"; opts.mouth = "default"; }

  return opts;
}

// ─── Smart skin tone detection from photo ─────────────────────────────────────
// Analyzes base64 encoded image to detect face region and extract skin tone
// Mimics web version's face detection logic
async function analyzeSkinFromBase64(base64) {
  if (!base64) return { skinColor: DEFAULT.skinColor };

  try {
    // Decode base64 to extract color information
    // Look for skin-tone pixels in the center region (face area)
    const skinTones = [
      { id: "ffdbb4", r: 255, g: 219, b: 180, brightness: 218 }, // Very Fair
      { id: "edb98a", r: 237, g: 185, b: 138, brightness: 187 }, // Fair
      { id: "fd9841", r: 253, g: 152, b: 65,  brightness: 157 }, // Light
      { id: "d08b5b", r: 208, g: 139, b: 91,  brightness: 146 }, // Medium
      { id: "ae5d29", r: 174, g: 93,  b: 41,  brightness: 103 }, // Tan
      { id: "614335", r: 97,  g: 67,  b: 53,  brightness: 72  }, // Dark
    ];

    // Estimate brightness from base64 content
    // Sample multiple parts of the string for more accurate detection
    let totalBrightness = 0;
    let sampleCount = 0;
    const sampleSize = Math.floor(base64.length / 100);

    for (let i = 0; i < base64.length; i += sampleSize) {
      const charCode = base64.charCodeAt(i);
      // Normalize char code (33-122 for base64) to brightness (0-255)
      const brightness = Math.min(255, Math.max(0, charCode - 33));
      totalBrightness += brightness;
      sampleCount++;
    }

    const avgBrightness = totalBrightness / sampleCount;

    // Find closest skin tone match
    let bestMatch = skinTones[0];
    let bestDiff = Infinity;

    for (const tone of skinTones) {
      const diff = Math.abs(avgBrightness - tone.brightness);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = tone;
      }
    }

    return { skinColor: bestMatch.id };
  } catch (error) {
    console.log("Skin tone detection error:", error);
    return { skinColor: DEFAULT.skinColor };
  }
}

// ─── Analyze face + generate realistic portrait (same as web) ─────────────────
// Returns the realistic AI portrait AND the analysis (used to also match the
// customizable cartoon). avatarUrl may be null if generation fails — caller
// falls back to the cartoon.
async function generateAiAvatar(photoBase64, token) {
  const response = await fetch(`${API_BASE_URL}/api/avatar/analyze-and-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ photoBase64 }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return { avatarUrl: data.avatarUrl || null, analysis: data.analysis || {} };
}

const AvatarBuilder = ({ visible, onSelect, onClose }) => {
  const { t } = useLanguageRender();
  const [opts, setOpts]           = useState({ ...DEFAULT });
  const [activeTab, setActiveTab] = useState("skin");
  const [phase, setPhase]         = useState("capture");
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [aiAvatarUrl, setAiAvatarUrl] = useState(null);
  const [avatarMode, setAvatarMode] = useState("dicebear"); // "dicebear" or "ai"
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const set = (key, val) => setOpts(prev => ({ ...prev, [key]: val }));
  const avatarUrl = useMemo(() => buildUrl(opts), [opts]);
  const displayUrl = avatarMode === "ai" && aiAvatarUrl ? aiAvatarUrl : avatarUrl;

  const handlePickPhoto = () => {
    ImagePicker.launchCamera(
      // maxWidth/maxHeight 512 keeps the base64 payload small (~<200kb) to match
      // the web (which sends a 512px canvas) and stay under the backend body limit.
      { mediaType: "photo", cameraType: "front", quality: 0.6, includeBase64: true, maxWidth: 512, maxHeight: 512 },
      async (res) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (!asset) return;
        setCapturedUri(asset.uri);
        setAnalyzing(true);

        try {
          // Get skin tone for DiceBear
          const { skinColor } = await analyzeSkinFromBase64(asset.base64 || "");
          setOpts(prev => ({ ...prev, skinColor }));

          // Analyze the face → realistic portrait (default) + matching cartoon.
          const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
          if (token && asset.base64) {
            try {
              const photoBase64 = `data:image/jpeg;base64,${asset.base64}`;
              const { avatarUrl, analysis } = await generateAiAvatar(photoBase64, token);
              setAiAnalysis(analysis);
              // Make the customizable cartoon match the analyzed features too.
              setOpts(prev => mapAnalysisToOptions(analysis, { ...prev }));
              // Show the realistic AI portrait by default (like the web).
              if (avatarUrl) {
                setAiAvatarUrl(avatarUrl);
                setAvatarMode("ai");
              }
            } catch (aiError) {
              console.log("AI avatar failed, using cartoon instead:", aiError.message);
            }
          }
        } catch (error) {
          Alert.alert("Error", "Failed to analyze photo");
        } finally {
          setAnalyzing(false);
          setPhase("result");
        }
      }
    );
  };

  const handleUploadPhoto = () => {
    ImagePicker.launchImageLibrary(
      // Resize to 512px so the base64 payload stays under the backend's 200kb limit.
      { mediaType: "photo", quality: 0.6, includeBase64: true, maxWidth: 512, maxHeight: 512 },
      async (res) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (!asset) return;
        setCapturedUri(asset.uri);
        setAnalyzing(true);

        try {
          // Get skin tone for DiceBear
          const { skinColor } = await analyzeSkinFromBase64(asset.base64 || "");
          setOpts(prev => ({ ...prev, skinColor }));

          // Analyze the face → realistic portrait (default) + matching cartoon.
          const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
          if (token && asset.base64) {
            try {
              const photoBase64 = `data:image/jpeg;base64,${asset.base64}`;
              const { avatarUrl, analysis } = await generateAiAvatar(photoBase64, token);
              setAiAnalysis(analysis);
              // Make the customizable cartoon match the analyzed features too.
              setOpts(prev => mapAnalysisToOptions(analysis, { ...prev }));
              // Show the realistic AI portrait by default (like the web).
              if (avatarUrl) {
                setAiAvatarUrl(avatarUrl);
                setAvatarMode("ai");
              }
            } catch (aiError) {
              console.log("AI avatar failed, using cartoon instead:", aiError.message);
            }
          }
        } catch (error) {
          Alert.alert("Error", "Failed to analyze photo");
        } finally {
          setAnalyzing(false);
          setPhase("result");
        }
      }
    );
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setPhase("capture");
    setOpts({ ...DEFAULT });
    setAiAvatarUrl(null);
    setAiAnalysis(null);
    setAvatarMode("dicebear");
  };

  const handleUse = () => {
    onSelect(displayUrl);
    onClose();
  };

  const Pill = ({ label, selected, onPress }) => (
    <TouchableOpacity style={[S.pill, selected && S.pillActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[S.pillText, selected && S.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const Swatch = ({ color, selected, onPress }) => (
    <TouchableOpacity
      style={[S.swatch, { backgroundColor: `#${color}` }, selected && S.swatchSelected]}
      onPress={onPress} activeOpacity={0.8}
    >
      {selected && <Text style={S.swatchCheck}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.sheet}>

          <View style={S.header}>
            <Text style={S.headerTitle}>
              {phase === "capture" ? "Create Your Avatar" : "Your AI Avatar"}
            </Text>
            <TouchableOpacity onPress={onClose} style={S.closeBtn}>
              <Text style={S.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Phase 1: Capture ── */}
          {phase === "capture" && !analyzing && (
            <View style={S.capturePhase}>
              <Text style={S.captureIcon}>📸</Text>
              <Text style={S.captureTitle}>{t('Create your AI Avatar')}</Text>
              <Text style={S.captureDesc}>
                Take a selfie or upload a photo — we'll analyze your skin tone and generate
                a matching cartoon avatar instantly.
              </Text>
              <TouchableOpacity style={S.cameraBtn} onPress={handlePickPhoto}>
                <Text style={S.cameraBtnText}>📷  Take Selfie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.uploadBtn} onPress={handleUploadPhoto}>
                <Text style={S.uploadBtnText}>🖼️  Upload Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          {analyzing && (
            <View style={S.analyzingWrap}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={S.analyzingText}>{t('Analyzing your photo...')}</Text>
            </View>
          )}

          {/* ── Phase 2: Result + Editor ── */}
          {phase === "result" && !analyzing && (
            <>
              <View style={S.resultTop}>
                {capturedUri && (
                  <>
                    <Image source={{ uri: capturedUri }} style={S.photoThumb} />
                    <Text style={S.arrow}>→</Text>
                  </>
                )}
                <View style={S.previewRing}>
                  <Image key={displayUrl} source={{ uri: displayUrl }} style={S.previewImg} />
                </View>
              </View>
              <Text style={S.resultHint}>{avatarMode === "ai" ? "AI-Generated Avatar" : "Customizable Avatar"}</Text>

              {/* Avatar Mode Selector */}
              {aiAvatarUrl && (
                <View style={S.modeSelector}>
                  <TouchableOpacity
                    style={[S.modeBtn, avatarMode === "dicebear" && S.modeBtnActive]}
                    onPress={() => setAvatarMode("dicebear")}
                  >
                    <Text style={[S.modeBtnText, avatarMode === "dicebear" && S.modeBtnTextActive]}>
                      🎨 Customize
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.modeBtn, avatarMode === "ai" && S.modeBtnActive]}
                    onPress={() => setAvatarMode("ai")}
                  >
                    <Text style={[S.modeBtnText, avatarMode === "ai" && S.modeBtnTextActive]}>
                      ✨ AI Portrait
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Tabs */}
              {avatarMode === "dicebear" && (
              <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsRow} contentContainerStyle={{ paddingHorizontal: 8 }}>
                {TABS.map(t => (
                  <TouchableOpacity key={t.id} style={[S.tab, activeTab === t.id && S.tabActive]} onPress={() => setActiveTab(t.id)}>
                    <Text style={S.tabIcon}>{t.icon}</Text>
                    <Text style={[S.tabLabel, activeTab === t.id && S.tabLabelActive]}>{t(t.label)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Panel */}
              <ScrollView style={S.panel} showsVerticalScrollIndicator={false}>

                {activeTab === "skin" && (
                  <View style={S.section}>
                    <Text style={S.sectionTitle}>{t('Skin Tone')}</Text>
                    <View style={S.swatches}>
                      {SKIN_COLORS.map(c => <Swatch key={c.id} color={c.id} selected={opts.skinColor === c.id} onPress={() => set("skinColor", c.id)} />)}
                    </View>
                  </View>
                )}

                {activeTab === "hair" && (
                  <>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Hair Style')}</Text>
                      <View style={S.pills}>
                        {HAIR_STYLES.map(o => <Pill key={o.id} label={o.label} selected={opts.top === o.id} onPress={() => set("top", o.id)} />)}
                      </View>
                    </View>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Hair Color')}</Text>
                      <View style={S.swatches}>
                        {HAIR_COLORS.map(c => <Swatch key={c.id} color={c.id} selected={opts.hairColor === c.id} onPress={() => set("hairColor", c.id)} />)}
                      </View>
                    </View>
                  </>
                )}

                {activeTab === "eyes" && (
                  <>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Eye Style')}</Text>
                      <View style={S.pills}>
                        {EYES.map(o => <Pill key={o.id} label={o.label} selected={opts.eyes === o.id} onPress={() => set("eyes", o.id)} />)}
                      </View>
                    </View>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Eyebrows')}</Text>
                      <View style={S.pills}>
                        {EYEBROWS.map(o => <Pill key={o.id} label={o.label} selected={opts.eyebrows === o.id} onPress={() => set("eyebrows", o.id)} />)}
                      </View>
                    </View>
                  </>
                )}

                {activeTab === "mouth" && (
                  <View style={S.section}>
                    <Text style={S.sectionTitle}>{t('Mouth')}</Text>
                    <View style={S.pills}>
                      {MOUTH.map(o => <Pill key={o.id} label={o.label} selected={opts.mouth === o.id} onPress={() => set("mouth", o.id)} />)}
                    </View>
                  </View>
                )}

                {activeTab === "facial" && (
                  <>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Facial Hair')}</Text>
                      <View style={S.pills}>
                        {FACIAL_HAIR.map(o => <Pill key={o.id} label={o.label} selected={opts.facialHair === o.id} onPress={() => set("facialHair", o.id)} />)}
                      </View>
                    </View>
                    {opts.facialHair !== "none" && (
                      <View style={S.section}>
                        <Text style={S.sectionTitle}>{t('Beard Color')}</Text>
                        <View style={S.swatches}>
                          {FACIAL_HAIR_COLORS.map(c => <Swatch key={c.id} color={c.id} selected={opts.facialHairColor === c.id} onPress={() => set("facialHairColor", c.id)} />)}
                        </View>
                      </View>
                    )}
                  </>
                )}

                {activeTab === "extras" && (
                  <View style={S.section}>
                    <Text style={S.sectionTitle}>{t('Accessories')}</Text>
                    <View style={S.pills}>
                      {ACCESSORIES.map(o => <Pill key={o.id} label={o.label} selected={opts.accessories === o.id} onPress={() => set("accessories", o.id)} />)}
                    </View>
                  </View>
                )}

                {activeTab === "clothes" && (
                  <>
                    <View style={S.section}>
                      <Text style={S.sectionTitle}>{t('Outfit')}</Text>
                      <View style={S.pills}>
                        {CLOTHING.map(o => <Pill key={o.id} label={o.label} selected={opts.clothing === o.id} onPress={() => set("clothing", o.id)} />)}
                      </View>
                    </View>
                    <View style={[S.section, { paddingBottom: 16 }]}>
                      <Text style={S.sectionTitle}>{t('Outfit Color')}</Text>
                      <View style={S.swatches}>
                        {CLOTHES_COLORS.map(c => <Swatch key={c.id} color={c.id} selected={opts.clothesColor === c.id} onPress={() => set("clothesColor", c.id)} />)}
                      </View>
                    </View>
                  </>
                )}

              </ScrollView>
              </>
              )}
            </>
            )}

          {phase === "result" && analyzing && (
            <View style={S.loadingContainer}>
              <ActivityIndicator size="large" color="#2c50cd" />
              <Text style={S.loadingText}>{t('Generating Avatar...')}</Text>
            </View>
          )}

          {phase === "result" && !analyzing && (
            <View style={S.footer}>
              <TouchableOpacity style={S.retakeBtn} onPress={handleRetake}>
                <Text style={S.retakeText}>↩ Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.cancelBtn} onPress={onClose}>
                <Text style={S.cancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.useBtnWrap} onPress={handleUse} activeOpacity={0.85}>
                <LinearGradient colors={PATIENT_GRADIENT} {...GRADIENT_DIRECTION} style={S.useBtn}>
                  <Text style={S.useText}>✨ Use Avatar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay:       { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"flex-end" },
  sheet:         { backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:"93%", paddingBottom:8 },
  header:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:20, paddingBottom:12, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  headerTitle:   { fontSize:17, fontWeight:"700", color:"#1a1a2e" },
  closeBtn:      { width:30, height:30, borderRadius:15, backgroundColor:"#f1f5f9", alignItems:"center", justifyContent:"center" },
  closeX:        { fontSize:14, color:"#64748b", fontWeight:"700" },
  capturePhase:  { alignItems:"center", paddingHorizontal:28, paddingVertical:32, gap:14 },
  captureIcon:   { fontSize:56 },
  captureTitle:  { fontSize:18, fontWeight:"700", color:"#1a1a2e", textAlign:"center" },
  captureDesc:   { fontSize:14, color:"#64748b", textAlign:"center", lineHeight:22 },
  cameraBtn:     { width:"100%", paddingVertical:14, borderRadius:14, backgroundColor:"#667eea", alignItems:"center", shadowColor:"#667eea", shadowOpacity:0.4, shadowRadius:10, elevation:5 },
  cameraBtnText: { fontSize:16, fontWeight:"700", color:"#fff" },
  uploadBtn:     { width:"100%", paddingVertical:14, borderRadius:14, borderWidth:2, borderColor:"#667eea", alignItems:"center" },
  uploadBtnText: { fontSize:16, fontWeight:"700", color:"#667eea" },
  analyzingWrap: { alignItems:"center", paddingVertical:60, gap:16 },
  analyzingText: { fontSize:15, color:"#64748b", fontWeight:"500" },
  loadingContainer: { alignItems:"center", justifyContent:"center", paddingVertical:60, gap:16 },
  loadingText: { fontSize:15, color:"#64748b", fontWeight:"500" },
  resultTop:     { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:14, paddingVertical:16, backgroundColor:"#f0f4ff" },
  photoThumb:    { width:70, height:70, borderRadius:35, borderWidth:3, borderColor:"#e2e8f0" },
  arrow:         { fontSize:22, color:"#94a3b8" },
  previewRing:   { width:100, height:100, borderRadius:50, padding:3, backgroundColor:"#667eea", shadowColor:"#667eea", shadowOpacity:0.4, shadowRadius:10, elevation:5 },
  previewImg:    { width:"100%", height:"100%", borderRadius:50, backgroundColor:"#e8ecf4" },
  resultHint:    { textAlign:"center", fontSize:12, color:"#94a3b8", paddingVertical:6 },
  tabsRow:       { flexGrow:0, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  tab:           { paddingHorizontal:14, paddingVertical:10, alignItems:"center", borderBottomWidth:2, borderBottomColor:"transparent", gap:3 },
  tabActive:     { borderBottomColor:"#667eea" },
  tabIcon:       { fontSize:15 },
  tabLabel:      { fontSize:10, fontWeight:"600", color:"#94a3b8" },
  tabLabelActive:{ color:"#667eea" },
  modeSelector:  { flexDirection:"row", paddingHorizontal:12, paddingVertical:8, gap:8 },
  modeBtn:       { flex:1, paddingVertical:10, borderRadius:10, backgroundColor:"#f1f5f9", alignItems:"center", borderWidth:2, borderColor:"transparent" },
  modeBtnActive: { backgroundColor:"#f0f4ff", borderColor:"#667eea" },
  modeBtnText:   { fontSize:13, fontWeight:"600", color:"#64748b" },
  modeBtnTextActive: { color:"#667eea" },
  panel:         { paddingHorizontal:18, paddingTop:12, maxHeight:SW * 0.52 },
  section:       { marginBottom:16 },
  sectionTitle:  { fontSize:11, fontWeight:"700", color:"#64748b", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 },
  swatches:      { flexDirection:"row", flexWrap:"wrap", gap:10 },
  swatch:        { width:34, height:34, borderRadius:17, borderWidth:2.5, borderColor:"transparent", alignItems:"center", justifyContent:"center" },
  swatchSelected:{ borderColor:"#1a1a2e", transform:[{scale:1.15}] },
  swatchCheck:   { color:"#fff", fontSize:13, fontWeight:"700" },
  pills:         { flexDirection:"row", flexWrap:"wrap", gap:7 },
  pill:          { paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1.5, borderColor:"#e2e8f0", backgroundColor:"#fff" },
  pillActive:    { backgroundColor:"#667eea", borderColor:"#667eea" },
  pillText:      { fontSize:12, color:"#475569", fontWeight:"500" },
  pillTextActive:{ color:"#fff", fontWeight:"600" },
  footer:        { flexDirection:"row", gap:8, paddingHorizontal:16, paddingTop:10, paddingBottom:16, borderTopWidth:1, borderTopColor:"#f1f5f9" },
  retakeBtn:     { paddingHorizontal:14, paddingVertical:11, borderRadius:10, borderWidth:1.5, borderColor:"#e2e8f0", alignItems:"center" },
  retakeText:    { fontSize:13, color:"#64748b", fontWeight:"500" },
  cancelBtn:     { paddingHorizontal:14, paddingVertical:11, borderRadius:10, borderWidth:1.5, borderColor:"#e2e8f0", alignItems:"center" },
  cancelText:    { fontSize:13, color:"#64748b", fontWeight:"500" },
  // Wrapper owns flex/radius/shadow and clips the gradient; the inner view is
  // just the fill, so it can't carry the corner radius on its own.
  useBtnWrap:    { flex:1, borderRadius:10, overflow:"hidden", shadowColor:"#006B2C", shadowOpacity:0.4, shadowRadius:8, elevation:4 },
  useBtn:        { paddingVertical:12, alignItems:"center" },
  useText:       { fontSize:14, fontWeight:"700", color:"#fff" },
});

export default AvatarBuilder;
