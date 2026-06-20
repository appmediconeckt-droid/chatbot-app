# Frontend Rating Feature - Verification & Testing Guide

## ✅ CODE INTEGRATION VERIFIED

### 1. RatingPrompt Component
```
Location: src/components/RatingPrompt.jsx
Status: ✅ VERIFIED
- Imports ratingService correctly
- Calls checkEligibility on mount
- Shows RatingModal when eligible
- Handles submit, remind-later, never-ask-again
- Fresh key per open (prevents state cache issues)
```

### 2. RatingModal Component
```
Location: src/components/RatingModal.jsx
Status: ✅ VERIFIED
- Beautiful UI with avatar, stars, review
- Interactive 1-5 star selector
- Optional review text (500 char max)
- Submit button (blue, disabled until star selected)
- Remind later button (gray)
- Never ask again button (red)
- Success state with 🎉 emoji
- Dark overlay (55% opacity)
- Card with shadow & border-radius
```

### 3. StarRating Component
```
Location: src/components/StarRating.jsx
Status: ✅ VERIFIED
- Interactive mode: whole stars only
- Display mode: allows half stars
- Dynamic labels ("Poor", "Fair", etc.)
- Gold color (#F5A623)
- Proper touch target size
```

### 4. ratingService
```
Location: src/services/ratingService.js
Status: ✅ VERIFIED
- checkEligibility() → GET /api/ratings/check-eligibility
- submitRating() → POST /api/ratings/submit
- remindLater() → POST /api/ratings/remind-later
- neverAskAgain() → POST /api/ratings/never-ask-again
- Proper error handling with try/catch
- Returns sensible defaults on error
```

### 5. UserDashboard Integration
```
Location: src/screens/user/.../UserDashboard.jsx
Status: ✅ VERIFIED
- Line 45: RatingPrompt imported
- Line 1666: <RatingPrompt triggerKey={active} />
- Mounted in shell (runs on every screen change)
- triggerKey={active} ensures re-check on tab change
```

### 6. axiosConfig Setup
```
Location: src/axiosConfig.js
Status: ✅ VERIFIED
- API_BASE_URL set to http://localhost:5001
- Supports multiple environments
- Token interceptor adds Authorization header
- 401 refresh token handling
- Proper timeout (30 seconds)
```

### 7. Old Code Cleanup
```
Location: src/screens/user/.../ChatBox.jsx
Status: ✅ CLEANED
- RatingModal import REMOVED
- ratingService import REMOVED
- All old rating state variables REMOVED
- All old rating useEffects REMOVED
- handleSubmitRating function REMOVED
- handleDismissRating function REMOVED
- RatingModal component rendering REMOVED
- File is now clean (no dead code)
```

---

## 🧪 FRONTEND TESTING CHECKLIST

### Setup Phase
```
□ Backend running on http://localhost:5001
  Verify: curl http://localhost:5001/api/ratings/check-eligibility (should 401 without token)

□ Frontend running (npm start)
  Verify: App loads without errors in browser console

□ User logged in
  Verify: Token exists in localStorage/AsyncStorage
```

### Test 1: No Eligibility Yet
```
Steps:
  1. Login to app
  2. Open chat with counselor
  3. Send 5-10 messages (less than 20)
  4. Navigate away → back to UserDashboard (Dashboard tab)
  5. Open browser console (DevTools)

Expected:
  □ No rating popup appears
  □ Console shows: "RatingPrompt: Checking eligibility..."
  □ Popup does NOT show (showPopup: false from API)
  □ Dashboard functions normally
```

### Test 2: 20 Messages Eligibility
```
Steps:
  1. Open same chat
  2. Send 20+ messages (count them or use browser DevTools to count messages)
  3. Send final message to trigger 48h clock
  4. Navigate away → back to UserDashboard
  5. Note current time

Expected:
  □ Messages saved to backend
  □ No popup yet (still waiting 48h from last message time)
  □ Console shows: "RatingPrompt: Checking eligibility..."
  □ API returns: showPopup: false (because 48h not elapsed)
```

### Test 3: Eligibility Triggered (After 48h)
```
Steps:
  1. Device time: Skip forward 48+ hours
     - iOS: Settings → Date & Time → Set to future
     - Android: Developer Settings → Set system time forward
     - Desktop: System time forward
  
  2. Close app completely
  3. Reopen app
  4. Navigate to UserDashboard (or switch tabs)
  5. Open browser DevTools console

Expected:
  □ Rating popup appears centered on screen ✅
  □ Shows counselor avatar (or fallback initials in blue circle)
  □ Title: "Rate your counselor"
  □ Subtitle: "How was your experience with [Name]?"
  □ 5 interactive stars (gray, tappable)
  □ Label below stars: "Tap a star to rate"
  □ Review text area: "Add a review (optional)"
  □ Buttons: [Submit rating] [Remind me later] [Never ask again]
  □ Close button (X) top-right
  □ Dark overlay behind modal
  □ Console logs: "RatingPrompt: Showing popup for counselor..."
```

### Test 4: Submit Rating
```
Steps:
  1. When popup appears (after 48h)
  2. Tap star #4 (Very good)
  3. Verify: Label changes to "Very good" ✅
  4. Type in review: "Great counseling session!"
  5. Tap [Submit rating] button
  6. Open browser console

Expected:
  □ Submit button briefly shows loading spinner
  □ Console logs: "Submitting rating..."
  □ Modal changes to success state
  □ Shows: 🎉 emoji
  □ Shows: "Thank you!" title
  □ Shows: "Your rating has been submitted." subtitle
  □ Modal auto-closes after 1.5 seconds
  □ Popup completely disappears ✅
  □ Dashboard visible again
  □ No errors in console
```

### Test 5: Verify Rating Saved
```
Steps:
  1. After successful submit
  2. Navigate to counselor profile
  3. Check rating display

Expected:
  □ Counselor shows new rating (e.g., "4.0 (5 ratings)")
  □ Or "Very good" indicator visible
  □ Rating was saved to backend ✅
```

### Test 6: Duplicate Rating Blocked
```
Steps:
  1. Reset device time to current (undo the 48h skip)
  2. Close and reopen app
  3. Go to UserDashboard again
  4. Trigger checkEligibility

Expected:
  □ Rating popup does NOT appear
  □ API returns: showPopup: false
  □ Backend blocks duplicate: hasRated=true
  □ Console shows no popup trigger ✅
```

### Test 7: Remind Me Later (7-Day Snooze)
```
Steps:
  1. (Skip device time back to 48h eligibility point)
  2. Rating popup appears
  3. Tap [Remind me later] button
  4. Open console

Expected:
  □ Console logs: "Calling remindLater..."
  □ Popup closes immediately
  □ Dark overlay disappears
  □ Dashboard visible
  □ remindLaterUntil set to now + 7 days
```

### Test 8: Verify 7-Day Snooze Works
```
Steps:
  1. Immediately after "Remind me later"
  2. Navigate away → back to UserDashboard
  3. Trigger checkEligibility again

Expected:
  □ Rating popup does NOT appear
  □ API returns: showPopup: false (remindLaterUntil still in future)
```

### Test 9: Snooze Expires After 7 Days
```
Steps:
  1. Skip device time forward 7+ days
  2. Close and reopen app
  3. Navigate to UserDashboard
  4. Trigger checkEligibility

Expected:
  □ Rating popup reappears ✅
  □ 7-day snooze expired
  □ Can now rate again (or remind later again)
```

### Test 10: Never Ask Again (Permanent)
```
Steps:
  1. (Reset time to 48h eligibility again)
  2. Rating popup appears
  3. Tap [Never ask again] button
  4. Open console

Expected:
  □ Console logs: "Calling neverAskAgain..."
  □ Popup closes
  □ neverAskAgain=true set in backend
```

### Test 11: Verify Permanent Suppression
```
Steps:
  1. Immediately after "Never ask again"
  2. Navigate away → back to UserDashboard
  3. Trigger checkEligibility

Expected:
  □ Rating popup does NOT appear
  □ API returns: showPopup: false (neverAskAgain=true)
```

### Test 12: Permanent Works Forever
```
Steps:
  1. Skip device time forward 100 days
  2. Close and reopen app
  3. Navigate to UserDashboard
  4. Trigger checkEligibility

Expected:
  □ Rating popup still does NOT appear
  □ Permanently suppressed forever ✅
  □ No way to re-enable (by design)
```

### Test 13: Close Button (X)
```
Steps:
  1. (Reset time to 48h eligibility)
  2. Rating popup appears
  3. Tap X button (top-right)
  4. Open console

Expected:
  □ Popup closes
  □ Console shows: "Calling remindLater..." (X defaults to remind-later)
  □ Popup won't show for 7 days ✅
```

### Test 14: Multiple Counselors
```
Steps:
  1. Chat with Counselor A → 20+ messages
  2. Chat with Counselor B → 20+ messages
  3. Both become eligible at different times
  4. Skip time 48+ hours
  5. Open UserDashboard
  6. Open console

Expected:
  □ Popup for oldest-eligible appears (e.g., Counselor A)
  □ Rate Counselor A (or remind later)
  □ Close popup
  □ Navigate away → back to UserDashboard
  □ Popup for Counselor B appears ✅
  □ Shows correct counselor name/avatar
  □ Oldest-eligible shown first
```

---

## 🔍 CONSOLE DEBUGGING

Open DevTools Console and look for:

### Good Logs (Expected)
```
"RatingPrompt: Checking eligibility..."
"ratingService.checkEligibility succeeded"
"RatingPrompt: Showing popup for counselor..."
"Submitting rating..."
"Rating submitted successfully!"
"Calling remindLater..."
"Calling neverAskAgain..."
```

### Bad Logs (Problematic)
```
"401 Unauthorized"              → Token missing or invalid
"Cannot read property of null"  → Component not mounted
"Network Error"                 → Backend not running
"ratingService.checkEligibility failed" → API error
"Unexpected token <"            → HTML error response
```

---

## 🔧 MANUAL API TESTING (Browser Console)

```javascript
// Get token
const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
console.log("Token:", token);

// Test checkEligibility
fetch('http://localhost:5001/api/ratings/check-eligibility', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log("Eligibility:", data));

// Test submitRating (after getting counselorId)
fetch('http://localhost:5001/api/ratings/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    counselorId: "PUT_COUNSELOR_ID_HERE",
    rating: 5,
    review: "Test review"
  })
})
.then(r => r.json())
.then(data => console.log("Submit response:", data));
```

---

## ✨ EXPECTED UI FLOW

```
UserDashboard loads
    ↓
RatingPrompt mounts
    ↓
checkEligibility() called
    ↓
Backend returns showPopup: true/false
    ↓
IF showPopup = true:
    ↓
    RatingModal appears (centered, with avatar)
    ↓
    User taps stars (visual feedback)
    ↓
    User types review (optional)
    ↓
    User taps [Submit/Remind/Never]
    ↓
    submitRating/remindLater/neverAskAgain() called
    ↓
    Backend updates RatingStatus & Rating
    ↓
    IF submitted: Success screen appears
    ↓
    Modal auto-closes after 1.5 seconds
    ↓
    Dashboard visible again ✅

ELSE:
    ↓
    No popup shown
    ↓
    Dashboard loads normally ✅
```

---

## ✅ FINAL VERIFICATION CHECKLIST

```
Code Integration:
  □ RatingPrompt imported in UserDashboard (line 45)
  □ RatingPrompt mounted in UserDashboard (line 1666)
  □ RatingModal component exists and works
  □ StarRating component interactive
  □ ratingService has all 4 functions
  □ axiosConfig set to localhost:5001
  □ Old rating code removed from ChatBox.jsx

UI Rendering:
  □ Popup appears centered on screen
  □ Counselor avatar displays (or fallback)
  □ 5 stars render and are interactive
  □ Review text area accepts input
  □ All 3 buttons visible and clickable
  □ Success screen shows after submit
  □ Modal auto-closes cleanly

API Communication:
  □ checkEligibility() calls correct endpoint
  □ Token sent in Authorization header
  □ API returns expected response format
  □ submitRating() sends all required data
  □ remindLater() calls correct endpoint
  □ neverAskAgain() calls correct endpoint

Business Logic:
  □ No popup when < 20 messages
  □ Popup appears after 20+ messages + 48h
  □ 7-day snooze works
  □ Permanent suppress works
  □ Duplicate ratings blocked
  □ Popup shows oldest-eligible first
  □ User choices persisted

Error Handling:
  □ No console errors
  □ 401 errors handled gracefully
  □ Network errors don't crash app
  □ Invalid token detected
  □ Missing backend handled
```

---

## 🚀 TEST EXECUTION

Run through tests in this order:
1. Test 1-2: Setup & basic flow
2. Test 3: Trigger eligibility (requires time skip)
3. Test 4-6: Submit & verify
4. Test 7-9: Remind later flow
5. Test 10-12: Never ask again flow
6. Test 13: Close button
7. Test 14: Multiple counselors

Expected time: **1-2 hours** (including time skips and app restarts)

---

## 📊 SUCCESS CRITERIA

All tests should pass:
- ✅ Popup appears only when eligible
- ✅ Submit rating works
- ✅ Remind later snoozes 7 days
- ✅ Never ask again suppresses forever
- ✅ Duplicate ratings blocked
- ✅ Multiple counselors handled correctly
- ✅ No console errors
- ✅ All UI elements render correctly

If all pass: **Frontend rating is working perfectly!** 🎉

---

**Status: READY FOR MANUAL TESTING**
