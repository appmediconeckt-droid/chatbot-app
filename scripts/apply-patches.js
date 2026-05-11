const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'react-native-incall-manager', 'android', 'src', 'main', 'java', 'com', 'zxcpoiu', 'incallmanager', 'InCallManagerModule.java');

if (!fs.existsSync(target)) {
  console.log('apply-patches: InCallManagerModule.java not found, skipping.');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

const original = `                    // --- Force ring volume up so ringtone plays even in silent/vibrate mode (WhatsApp-like)
                    int maxRingVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    if (audioManager.getStreamVolume(AudioManager.STREAM_RING) == 0) {
                        audioManager.setStreamVolume(AudioManager.STREAM_RING, (int)(maxRingVolume * 0.7), 0);
                    }`;

const patched = `                    // --- Force ring volume to max so ringtone plays at full volume (WhatsApp-like)
                    int maxRingVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    audioManager.setStreamVolume(AudioManager.STREAM_RING, maxRingVolume, 0);`;

if (src.includes(patched)) {
  console.log('apply-patches: incall-manager volume patch already applied.');
} else if (src.includes(original)) {
  fs.writeFileSync(target, src.replace(original, patched), 'utf8');
  console.log('apply-patches: incall-manager volume patch applied successfully.');
} else {
  console.warn('apply-patches: incall-manager patch target not found — may have changed in a new version.');
}
