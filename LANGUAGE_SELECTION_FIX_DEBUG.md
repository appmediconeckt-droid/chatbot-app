# Language Selection - Debug & Test Guide

## Issue Summary
When user selects a language, it's not changing the app display globally. Languages selected don't persist.

## What Was Fixed in v2

### Changes Made:
1. **LanguageContext.js** - Simplified to listen to i18n language changes
2. **LanguageSelector.jsx** - Now directly calls `i18n.changeLanguage()` AND context
3. **Local state tracking** - Added `selectedLang` state for immediate UI feedback

### How It Works Now:
```
User clicks language
    ↓
selectLanguage(code) called
    ↓
setSelectedLang(code) → Local state updates immediately
    ↓
i18n.changeLanguage(code) → All useTranslation() hooks re-render
    ↓
setContextLanguage(code) → Persists to storage
    ↓
close() → Modal closes with new language applied
```

## Testing Steps

### Test 1: Basic Language Change
**Steps**:
1. Open language selector (tap 🌐 icon)
2. Type "Hindi" in search
3. Click "हिंदी (Hindi)"
4. Check console for `[LanguageSelector] Language changed successfully to: hi-IN`
5. App text should change to Hindi IMMEDIATELY
6. Modal should close

**Expected Result**: ✅ App shows Hindi text

**If it doesn't work**:
- Check console for errors
- Check "Console" tab for `[LanguageSelector]` logs
- Take screenshot and share console logs

---

### Test 2: Language Persistence
**Steps**:
1. Select "Tamil" (தமிழ்)
2. Close app completely (kill it)
3. Reopen app
4. Check if still showing Tamil

**Expected Result**: ✅ App restarts in Tamil language

**If it doesn't work**:
- Clear app data and try again
- Check `[LanguageContext] Initialized with language:` in console
- Check AsyncStorage is working (check Android Logcat)

---

### Test 3: Search Feature
**Steps**:
1. Open language selector
2. Type "en" → Should show all English variants
3. Type "हि" → Should show Hindi
4. Type "xxx" → Should show "No languages found"
5. Click ✕ to clear search

**Expected Result**: ✅ Search filters correctly, clear button works

---

### Test 4: Multiple Language Switches
**Steps**:
1. Select English → Verify text is English
2. Select Hindi → Verify text is Hindi
3. Select Spanish → Verify text is Spanish
4. Select back to English → Verify text is English

**Expected Result**: ✅ Switches smoothly without errors

---

## Debug Console Output

### What You Should See:

```
[LanguageContext] Initialized with language: en-US
```
When app starts.

```
[LanguageSelector] Changing language to: hi-IN
[LanguageContext] Successfully changed to: hi-IN
[LanguageSelector] Language changed successfully to: hi-IN
```
When user selects language.

### If You See Errors:

```
[LanguageContext] Failed to change language: Error: ...
[LanguageSelector] Failed to change language: Error: ...
```

This means:
- i18n doesn't have that language
- AsyncStorage failed
- Network/permission issue

**How to Check**:
1. Open Chrome DevTools (if using Expo web)
2. Go to Console tab
3. Look for `[LanguageSelector]` or `[LanguageContext]` messages
4. Share full error message

---

## Common Issues & Solutions

### Issue 1: Language changes but reverts to English
**Cause**: AsyncStorage is failing or context isn't wrapping properly
**Fix**:
- Check `[LanguageContext]` logs
- Verify `<LanguageProvider>` wraps entire app in App.tsx
- Check file exists: `/src/contexts/LanguageContext.js`

### Issue 2: Modal doesn't close after selecting language
**Cause**: Language change failed
**Fix**:
- Check console for errors
- Try a different language
- Clear search before selecting

### Issue 3: Search doesn't work
**Cause**: Search implementation issue
**Fix**:
- Already implemented - should work
- Check `LANGUAGES` array exists in i18n
- Clear cache and restart

### Issue 4: App crashes when selecting language
**Cause**: i18n doesn't have that language resource
**Fix**:
- Check i18n resources include all language codes
- Use language codes like 'en-US', 'hi-IN', not 'en', 'hi'

---

## Key Files

### New/Modified Files:
1. **`/src/contexts/LanguageContext.js`** (NEW)
   - Manages language state
   - Listens to i18n changes
   - Persists language to AsyncStorage

2. **`/src/components/common/LanguageSelector.jsx`** (UPDATED)
   - Uses context hook
   - Calls i18n.changeLanguage()
   - Has search functionality
   - Shows loading state

3. **`/App.tsx`** (UPDATED)
   - Wraps app with `<LanguageProvider>`

### Existing Files (No Changes):
- `/src/i18n/index.js` - i18next config
- `/src/i18n/locales/*.json` - Translation files

---

## Manual Testing Checklist

- [ ] Select English → Entire app shows English
- [ ] Select Hindi → Entire app shows Hindi  
- [ ] Select Tamil → Entire app shows Tamil
- [ ] Search works (filter by typing)
- [ ] Clear button (✕) works in search
- [ ] Close and reopen → Language persists
- [ ] No console errors
- [ ] Modal closes after selection
- [ ] Rapid language switches work smoothly
- [ ] Can switch to all 56+ languages

---

## If Still Not Working

1. **Check these files exist**:
   ```
   /src/contexts/LanguageContext.js ✓
   /src/components/common/LanguageSelector.jsx ✓
   /App.tsx (has LanguageProvider) ✓
   ```

2. **Clear cache and rebuild**:
   ```bash
   cd /c/chatbot-app
   npm start -- --reset-cache
   # Or on native: 
   # npx react-native start --reset-cache
   ```

3. **Check console logs** for:
   - `[LanguageContext]` messages
   - `[LanguageSelector]` messages
   - Any errors starting with `Error` or `Warning`

4. **Verify i18n has the language**:
   - Check `/src/i18n/index.js` line 217
   - Find the `const resources = { ... }`
   - Verify it has entries like `'hi-IN': hiIN`

5. **Test with Chrome DevTools** (if using Expo web):
   - Open DevTools → Console
   - Filter by `LanguageContext` or `LanguageSelector`
   - Watch logs as you select language

---

## Report Format

If nothing works, provide:

```
App Version: [React Native / Expo version]
Language Tested: [e.g., Hindi]
Device/Platform: [Android/iOS/Web]

Console Output:
[paste all console logs starting from app load]

Steps Taken:
1. [step 1]
2. [step 2]
3. [step 3]
```

---

**Status**: Updated with better logging ✅  
**Next**: Test and report results
