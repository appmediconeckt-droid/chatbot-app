# 🧪 Test Rating Popup - Complete Guide

## Quick Test (2 minutes)

### Test 1: Rating Popup Appears on Back Button
```
1. Run the app: npm start
2. Login as a user
3. Open ANY chat with a counselor
4. TAP BACK BUTTON (don't just navigate away - use the back arrow)
5. Rating popup should appear asking "Rate your session"
   ✅ If popup appears → Working!
   ❌ If popup doesn't appear → Check logs
```

### Test 2: Submit a Rating
```
1. Popup appears (from Test 1)
2. TAP any star (1-5) to rate
   - Watch the label change (Poor/Fair/Good/Very good/Excellent)
3. (Optional) Type a comment in the text box
4. TAP "Submit rating" button
5. See "Thank you!" alert pop up
6. Auto-navigate back to chat list after alert
   ✅ If auto-navigated back → Working!
   ❌ If stayed on chat → Check navigation.goBack()
```

### Test 3: Already Rated - No Popup
```
1. Just completed Test 2 (rated a counselor)
2. Open SAME counselor's chat again
3. TAP BACK button
4. Rating popup should NOT appear
5. Navigate back immediately to chat list
   ✅ If no popup → Working correctly!
   ❌ If popup appears → Rating wasn't marked as submitted
```

### Test 4: Maybe Later Button
```
1. Open a DIFFERENT counselor's chat (one you haven't rated)
2. TAP BACK button
3. Rating popup appears
4. TAP "Maybe later" button (blue text at bottom)
5. Popup closes, navigate back immediately
   ✅ If navigated back → Working!
   ❌ If stuck on popup → Check dismissal logic
6. Note: Rating will re-appear after 24h (or can check AsyncStorage)
```

---

## What to Check in Logs

If rating popup doesn't appear, check:

### 1. AsyncStorage Logs
```javascript
// In browser/Xcode console, after opening a chat:
// You should see something like:
// "Rating service: saved pending rating for chatId: chat_123456789"
```

### 2. Component Mount Logs
Add this temporary log to verify `savePendingRating` is called:
```javascript
// In ChatBox.jsx useEffect (line 509):
useEffect(() => {
  const counselorIdResolved = resolveCounselorId();
  const apiChatId = getChatIdForAPI();
  console.log("DEBUG: Rating mount effect - counselorId:", counselorIdResolved, "chatId:", apiChatId);
  if (counselorIdResolved && apiChatId) {
    ratingService.savePendingRating({...})
    console.log("DEBUG: Saved pending rating for:", apiChatId);
  }
}, []);
```

### 3. Back Navigation Logs
Add logs to `handleBackNavigation`:
```javascript
const handleBackNavigation = async () => {
  const counselorIdResolved = resolveCounselorId();
  const apiChatId = getChatIdForAPI();
  
  const alreadyRatedCounselor = await ratingService.isAlreadyRated(counselorIdResolved);
  console.log("DEBUG: Already rated?", alreadyRatedCounselor);
  
  const allPending = await ratingService.getAllPendingRatings();
  console.log("DEBUG: All pending ratings:", allPending);
  
  const hasPendingRating = allPending.some(r => r.chatId === apiChatId);
  console.log("DEBUG: Has pending for this chat?", hasPendingRating);
  // ... rest of function
```

---

## Detailed Test Scenarios

### Scenario A: Fresh User (Never Rated Anyone)

**Expected Flow:**
```
1. Open chat with Counselor A
   → savePendingRating() called (line 509)
   → Rating saved: {chatId: "abc123", counselorId: "A", ...}

2. Tap back
   → handleBackNavigation() called
   → isAlreadyRated("A") = false
   → getAllPendingRatings() = [{chatId: "abc123", ...}]
   → hasPendingRating = true
   → Popup shows ✅

3. Rate 5 stars + comment
   → submitRating() API called
   → Backend returns success
   → showRatingModal = false
   → Alert shows
   → navigation.goBack() called (500ms delay)
   → Back to chat list ✅

4. Open Counselor A again
   → savePendingRating() called again (creates duplicate but service de-dupes)
   → Tap back
   → isAlreadyRated("A") = true ✅
   → Return false (allow navigation)
   → No popup, navigate back immediately ✅
```

### Scenario B: User Clicks "Maybe Later"

**Expected Flow:**
```
1. Open chat with Counselor B (new)
   → savePendingRating() called
   → Rating saved

2. Tap back
   → Popup appears

3. Click "Maybe later"
   → setShowRatingModal(false)
   → ratingPromptedRef.current = false ← IMPORTANT
   → navigation.goBack()
   → Back to chat list ✅

4. Return to chat list
   → Go to different chat

5. Come back later (after 24h or manually change time)
   → DUE rating check on mount
   → getDuePendingRating() finds B's rating
   → Popup appears again ✅
```

### Scenario C: User Has Multiple Pending Ratings

**Expected Flow:**
```
1. Rate Counselor A → Done ✅
2. Go to Counselor B → savePendingRating() called
3. Go to Counselor C → savePendingRating() called
   → AsyncStorage now has: [B, C] as pending

4. Tap back from C
   → Popup for C appears
   → Rate or dismiss

5. Next time you visit app
   → getDuePendingRating() on mount checks all pending
   → Returns oldest/due one first
   → Popup appears for the next pending rating
```

---

## Files to Check

### Core Files
- ✅ `c:/chatbot-app/src/components/RatingModal.jsx` — Popup UI
- ✅ `c:/chatbot-app/src/components/StarRating.jsx` — Star rating component
- ✅ `c:/chatbot-app/src/services/ratingService.js` — Rating logic
- ✅ `c:/chatbot-app/src/screens/user/Component/UserDashboard/Tab/ChatBox/ChatBox.jsx` — **MODIFIED**

### Key Functions
- **savePendingRating()** → Called on mount (line 513)
- **handleBackNavigation()** → Called on back button (line 477)
- **getDuePendingRating()** → Called on component mount for 24h re-prompt (line 528)
- **handleSubmitRating()** → Called on submit, auto-navigates (line 540)
- **handleDismissRating()** → Called on "Maybe later", navigates back (line 560)

---

## Comparison with Web Version

Both should now work identically:

| Step | Web | React Native |
|------|-----|--------------|
| User opens chat | savePendingRating() ✅ | savePendingRating() ✅ |
| User taps back | handleBackClick() ✅ | handleBackNavigation() ✅ |
| Check pending | getAllPendingRatings() ✅ | getAllPendingRatings() ✅ |
| Popup appears | Yes ✅ | Yes ✅ |
| User rates | submitRating() API ✅ | submitRating() API ✅ |
| After rating | Alert + navigate ✅ | Alert + navigate ✅ |
| Maybe later | Close + navigate ✅ | Close + navigate ✅ |
| Already rated | Skip popup ✅ | Skip popup ✅ |

---

## Troubleshooting

### Popup Never Appears
❌ **Check:**
1. Is `savePendingRating()` being called on mount?
   - Add console.log in useEffect (line 509)
2. Is AsyncStorage working?
   - Check React Native debugger → AsyncStorage tab
3. Does `getChatIdForAPI()` return a valid ID?
   - Add console.log to verify

### Popup Appears But Submit Fails
❌ **Check:**
1. Is token/auth working?
2. Check network tab for API errors
3. Is `/api/counselors/:counselorId/ratings` endpoint correct?

### Navigation Not Working After Rating
❌ **Check:**
1. Is `navigation.goBack()` being called?
   - Add console.log after submit
2. Is there only 1 route in stack?
   - Need at least 2 screens for back to work

### Already-Rated Check Not Working
❌ **Check:**
1. Is `markAsRated()` being called after submit?
2. Check AsyncStorage for @rated_counselors key
3. Is counselorId consistent?

---

## Files Created for Reference

- `c:/chatbot-app/RATING_POPUP_FIX.md` — Complete fix explanation
- `c:/chatbot-app/RATING_POPUP_BEFORE_AFTER.md` — Before/after code comparison
- `c:/chatbot-app/TEST_RATING_POPUP.md` — This file

---

## ✅ Testing Complete Checklist

- [ ] Rating popup appears on back button
- [ ] Can select rating (1-5 stars)
- [ ] Star labels update (Poor/Fair/Good/etc.)
- [ ] Can type comment (optional)
- [ ] Submit button disabled until ≥1 star selected
- [ ] Submit button works and calls API
- [ ] "Thank you!" alert appears
- [ ] Auto-navigate back after alert
- [ ] No popup for already-rated counselor
- [ ] "Maybe later" closes popup and navigates back
- [ ] Can see stored rating in backend

**Ready to test!** 🚀
