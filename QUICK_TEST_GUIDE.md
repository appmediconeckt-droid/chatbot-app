# Quick Test Guide - Language Selection Fix

## Quick Steps to Test ✅

### Step 1: Rebuild App
```bash
cd /c/chatbot-app
npm start -- --reset-cache
# Wait for app to reload
```

### Step 2: Open Console/Logcat
**Android:**
- Open Android Studio or terminal
- Run: `adb logcat | grep LanguageContext`

**Expo Web:**
- Open browser DevTools (F12)
- Go to Console tab
- Look for logs

### Step 3: Test Language Selection
1. **Tap 🌐 icon** to open language selector
2. **Type "Hindi"** in search box
3. **Tap "हिंदी (Hindi)"**
4. **Check console** for logs like:
   ```
   [LanguageContext] 🌐 Attempting to change language to: hi-IN
   [LanguageContext] Step 1: Changing i18n language...
   [LanguageContext] Step 1: ✅ i18n changed to hi-IN
   [LanguageContext] Step 2: Updating local state...
   [LanguageContext] Step 2: ✅ Local state updated
   [LanguageContext] Step 3: Saving to AsyncStorage...
   [LanguageContext] Step 3: ✅ Saved to storage
   [LanguageContext] ✅ Successfully changed language to: hi-IN
   ```

### Step 4: Verify Changes
- ✅ Modal closes
- ✅ App text changes to Hindi
- ✅ All screens show Hindi (navigate to different screens)
- ✅ No errors in console

### Step 5: Test Persistence
1. **Close app completely** (force close)
2. **Reopen app**
3. **Check**: Should still be in Hindi
4. **Check console**: Should see `[LanguageContext] Initialized with language: hi-IN`

---

## If You See Errors

### Error: "Cannot read property 'changeLanguage' of undefined"
**Cause**: i18n not initialized
**Fix**: Check if `/src/i18n/index.js` exports i18n

### Error: "Empty language code provided"
**Cause**: Language code is empty or null
**Fix**: Make sure to select a language from list

### Error: AsyncStorage failed
**Cause**: Storage permission issue
**Fix**: Check app permissions on device

### No console output at all
**Cause**: Logcat not running or LanguageContext not loaded
**Fix**: 
- Rebuild app
- Check LanguageProvider wraps entire App in App.tsx
- Check file exists: `/src/contexts/LanguageContext.js`

---

## What Should Happen Step-by-Step

```
App Starts
  ↓
[LanguageContext] Starting initialization...
[LanguageContext] Current i18n language: en-US
[LanguageContext] Saved language from storage: null (first time)
[LanguageContext] Using language: en-US
[LanguageContext] ✅ Successfully initialized with: en-US
  ↓
App shows English UI
  ↓
User taps 🌐 → Language selector opens
  ↓
User types "हिंदी" and taps it
  ↓
[LanguageContext] 🌐 Attempting to change language to: hi-IN
[LanguageContext] Step 1: Changing i18n language...
[LanguageContext] Step 1: ✅ i18n changed to hi-IN
[LanguageContext] Step 2: Updating local state...
[LanguageContext] Step 2: ✅ Local state updated
[LanguageContext] Step 3: Saving to AsyncStorage...
[LanguageContext] Step 3: ✅ Saved to storage
[LanguageContext] ✅ Successfully changed language to: hi-IN
  ↓
Modal closes → App shows हिंदी (Hindi)
  ↓
User closes and reopens app
  ↓
[LanguageContext] Saved language from storage: hi-IN
[LanguageContext] Using language: hi-IN
[LanguageContext] ✅ Successfully initialized with: hi-IN
  ↓
App starts in Hindi! 🎉
```

---

## Contact Info if Issue Persists

Share:
1. Screenshot of console output
2. Device/platform info (Android/iOS/Web)
3. Steps you took
4. Full error message from console

---

**Ready to test?** 🚀

Next run:
```bash
npm start -- --reset-cache
```

Then follow **Step 2-5** above.
