const fs = require('fs');
const path = require('path');

const patchFile = ({ target, label, original, patched, warnOnMissingOriginal = true }) => {
  if (!fs.existsSync(target)) {
    console.log(`apply-patches: ${label} not found, skipping.`);
    return;
  }

  const src = fs.readFileSync(target, 'utf8');

  if (src.includes(patched)) {
    console.log(`apply-patches: ${label} patch already applied.`);
  } else if (src.includes(original)) {
    fs.writeFileSync(target, src.replace(original, patched), 'utf8');
    console.log(`apply-patches: ${label} patch applied successfully.`);
  } else if (warnOnMissingOriginal) {
    console.warn(`apply-patches: ${label} patch target not found - may have changed in a new version.`);
  } else {
    console.log(`apply-patches: ${label} patch target not found, skipping.`);
  }
};

patchFile({
  target: path.join(__dirname, '..', 'node_modules', 'react-native-incall-manager', 'android', 'src', 'main', 'java', 'com', 'zxcpoiu', 'incallmanager', 'InCallManagerModule.java'),
  label: 'incall-manager volume',
  original: `                    // --- Force ring volume up so ringtone plays even in silent/vibrate mode (WhatsApp-like)
                    int maxRingVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    if (audioManager.getStreamVolume(AudioManager.STREAM_RING) == 0) {
                        audioManager.setStreamVolume(AudioManager.STREAM_RING, (int)(maxRingVolume * 0.7), 0);
                    }`,
  patched: `                    // --- Force ring volume to max so ringtone plays at full volume (WhatsApp-like)
                    int maxRingVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    audioManager.setStreamVolume(AudioManager.STREAM_RING, maxRingVolume, 0);`,
  warnOnMissingOriginal: false,
});

patchFile({
  target: path.join(__dirname, '..', 'node_modules', 'react-native', 'ReactAndroid', 'src', 'main', 'java', 'com', 'facebook', 'react', 'views', 'view', 'WindowUtil.kt'),
  label: 'react-native Android 15 edge-to-edge bars',
  original: `  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    isStatusBarContrastEnforced = false
    isNavigationBarContrastEnforced = true
  }

  statusBarColor = Color.TRANSPARENT
  navigationBarColor =
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isDarkMode -> LightNavigationBarColor
        else -> DarkNavigationBarColor
      }`,
  patched: `  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && Build.VERSION.SDK_INT < 35) {
    isStatusBarContrastEnforced = false
    isNavigationBarContrastEnforced = true
  }

  if (Build.VERSION.SDK_INT < 35) {
    statusBarColor = Color.TRANSPARENT
    navigationBarColor =
        when {
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isDarkMode -> LightNavigationBarColor
          else -> DarkNavigationBarColor
        }
  }`,
});
