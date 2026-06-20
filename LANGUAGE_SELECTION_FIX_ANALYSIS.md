# Language Selection Not Persisting - Analysis & Fix

## Problem
When user selects a language in the React Native app (`c:/chatbot-app`), the language changes momentarily but then reverts to English or doesn't fully update across the app.

## Root Cause Analysis

### iOS App (Working ✅)
The iOS app correctly implements language changes:

```javascript
// iOS: appLanguage.tsx lines 2817-2826
const setLanguage = async (code: string) => {
  const supportedLanguage = getSupportedAppLanguageCode(code);
  setLanguageState(supportedLanguage);  // ← Updates local state for re-render
  ensureI18nextReady(supportedLanguage);  // ← Initializes i18next
  try {
    await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, supportedLanguage);  // ← Persists
  } catch (error) {
    console.warn('Failed to save language preference:', error);
  }
};
```

**Key Points:**
1. Sets LOCAL state (`setLanguageState`) → triggers React re-render
2. Calls `ensureI18nextReady()` → initializes i18next with new language
3. Saves to AsyncStorage → persistence across app restarts
4. Uses language state in Context → all consumers update

### React Native App (Broken ❌)
Current implementation has issues:

```javascript
// Current LanguageSelector.jsx - selectLanguage function
const selectLanguage = useCallback(
  async (code) => {
    if (code === currentLang) { close(); return; }
    if (userId && role) {
      await saveUserLanguage(userId, role, code);  // ✅ Saves to storage
    } else {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, code);  // ✅ Persists
      await i18n.changeLanguage(code);  // ✅ Changes i18next
    }
    close();  // ❌ Closes modal immediately
  },
  [currentLang, close, userId, role]
);
```

**Problems:**
1. ❌ No local state update in component
2. ❌ No re-render trigger after language change
3. ❌ `currentLang = i18n.language || 'en'` is not reactive
4. ❌ No listener/hook on i18n language changes
5. ❌ Modal closes before translations update

### Comparison Table

| Feature | iOS App | React Native App |
|---------|---------|-----------------|
| Local state update | ✅ `setLanguageState()` | ❌ Missing |
| i18next initialization | ✅ `ensureI18nextReady()` | ❌ No initialization |
| AsyncStorage persistence | ✅ Yes | ✅ Yes |
| Re-render trigger | ✅ Via Context | ❌ Not triggered |
| Language listener | ✅ Via state | ❌ Missing |
| Use translation hook | ✅ `useLanguage()` | ❌ `useTranslation()` is passive |

## Solution

Implement a language context hook similar to iOS app that:
1. Maintains language state locally
2. Listens to i18n language changes
3. Triggers re-renders across the app
4. Persists language selection
5. Initializes i18next properly on app load

### Implementation Steps

1. Create `LanguageContext.js` with:
   - Language state
   - setLanguage function
   - Provider component
   - useLanguageContext hook

2. Update LanguageSelector to:
   - Use the new context hook
   - Properly trigger language change
   - Show confirmation before close

3. Update App root to:
   - Wrap with LanguageProvider
   - Load saved language on startup

## File Changes Needed

1. Create: `/c/chatbot-app/src/contexts/LanguageContext.js` (NEW)
2. Update: `/c/chatbot-app/src/components/common/LanguageSelector.jsx`
3. Update: `/c/chatbot-app/App.jsx` (or main entry point)

---

**Status**: Analysis Complete ✅  
**Next**: Implement the fixes
