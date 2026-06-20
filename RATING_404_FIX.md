# 🔧 Fix: 404 Counselor Not Found + Swipe Back Issues

## Problem 1: 404 Error When Submitting Rating

**Error Message:** `Error: 404 - Counselor not found`

**Root Causes:**
1. Counselor ID is missing or invalid
2. Counselor doesn't exist in database
3. Counselor role is not "counsellor" (British spelling)

---

## Problem 2: Swipe Back Not Showing Rating Popup

**Issue:** Users swipe back (iOS) but rating popup doesn't appear

**Root Cause:** beforeRemove listener not properly preventing swipe navigation

---

## Fixes Applied

### Fix 1: Better Counselor ID Resolution (Line 292)
**Added detailed logging to identify where counselor ID is missing:**

```javascript
const resolveCounselorId = () => {
  const id =
    currentCounselor?.id?.toString() ||
    currentCounselor?._id?.toString() ||
    counselorId ||
    currentChat?.counselorId?.toString() ||
    null;

  if (!id) {
    console.warn("❌ resolveCounselorId: No counselor ID found!");
    console.log("  currentCounselor:", currentCounselor);
    console.log("  counselorId param:", counselorId);
    console.log("  currentChat:", currentChat);
  } else {
    console.log("✅ resolveCounselorId resolved to:", id);
  }
  return id;
};
```

**What it does:**
- Warns if counselor ID is not found
- Shows where the ID came from
- Helps identify missing data

### Fix 2: Enhanced beforeRemove Listener (Line 558)
**Added detailed logging for swipe/back navigation:**

```javascript
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
    console.log("📱 beforeRemove listener triggered - action:", e.data?.action?.type);

    if (showRatingModal || ratingPromptedRef.current) {
      console.log("⏭️  Skipping: modal showing or already prompted");
      return;
    }

    const shouldBlock = await handleBackNavigation();

    if (shouldBlock) {
      console.log("🛑 Preventing navigation - showing rating popup");
      e.preventDefault();
    } else {
      console.log("✅ Allowing navigation - no rating needed");
    }
  });

  return unsubscribe;
}, [navigation, showRatingModal]);
```

**What it does:**
- Logs when beforeRemove is triggered (including swipe)
- Confirms prevention is working
- Helps debug swipe issues

### Fix 3: Improved submitRating Validation (ratingService.js)
**Validates counselor ID format before API call:**

```javascript
if (!counselorId) throw new Error("counselorId is required");

if (counselorId === "undefined" || counselorId === "null" || counselorId.trim?.() === "") {
  throw new Error(`Invalid counselorId: "${counselorId}". Must be a valid MongoDB ID.`);
}
```

**What it does:**
- Catches invalid ID format early
- Prevents API call with bad data
- Logs full ID value for debugging

---

## How to Diagnose 404 Issue

### Step 1: Check Console for Counselor ID
Look for these logs:

**Good (ID found):**
```
✅ resolveCounselorId resolved to: 507f1f77bcf86cd799439011
```

**Bad (ID missing):**
```
❌ resolveCounselorId: No counselor ID found!
   currentCounselor: null
   counselorId param: undefined
   currentChat: null
```

### Step 2: If ID is Found, Check the Format
Should look like:
```
507f1f77bcf86cd799439011  ← 24 hex characters
```

NOT like:
```
undefined
null
""
"Counselor A"
[object Object]
```

### Step 3: If Format is Good, Check Backend
Verify counselor exists in database:

```bash
# MongoDB
db.users.findOne({
  _id: ObjectId("507f1f77bcf86cd799439011"),
  role: "counsellor"  # Note: 2 L's!
})

# Should return counselor document, NOT null
```

### Step 4: If Counselor Exists, Check Rating Endpoint
Verify API is working:

```bash
curl -X POST \
  https://chatbot-backend-production-ea76.up.railway.app/api/counselors/507f1f77bcf86cd799439011/ratings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stars": 4, "comment": "test", "chatId": "test"}'

# Should return: {rating: X, ratingCount: Y}
# NOT 404
```

---

## How to Diagnose Swipe Back Issue

### Step 1: Open Console/Logs

**iOS:** Xcode → Console (Cmd+Shift+C)
**Android:** `adb logcat | grep "beforeRemove\|Rating\|navigate"`

### Step 2: Swipe Back from Chat

Look for these logs:

**Working (Popup should show):**
```
📱 beforeRemove listener triggered - action: GoBack
🔍 Checking if rating needed...
🛑 Preventing navigation - showing rating popup
[Rating modal appears on screen]
```

**Broken (No popup):**
```
📱 beforeRemove listener triggered - action: GoBack
🔍 Checking if rating needed...
✅ Allowing navigation - no rating needed
[No popup, user leaves immediately]
```

### Step 3: If Not Working, Check:

**Issue 1: Pending Rating Not Saved**
```
// In console, check if chat was marked as pending:
AsyncStorage.getItem('@pending_ratings').then(r => console.log(JSON.parse(r)));

// Should show array with current chat ID
// If empty or null, savePendingRating() wasn't called on mount
```

**Issue 2: Handler Not Being Called**
```
// Check if beforeRemove listener is registered:
// Should see "beforeRemove listener triggered" when you swipe

// If not seeing this log, the listener might not be properly set up
```

**Issue 3: Swipe Not Firing Event**
```
// Some custom navigation might not trigger beforeRemove
// Try using visible back button first to test
```

---

## Complete Test Flow

### Test 1: Verify Counselor ID is Resolved
```
1. Open any chat
2. Check console for logs:
   ✅ resolveCounselorId resolved to: [some ID]
3. Copy the ID and verify it's 24 hex chars
4. ✅ ID found and valid → Continue
5. ❌ ID missing → Check where currentCounselor comes from
```

### Test 2: Verify Pending Rating is Saved
```
1. Open chat
2. In console:
   AsyncStorage.getItem('@pending_ratings').then(r => console.log(JSON.parse(r)));
3. Should see array with current chat
4. ✅ Pending rating saved → Continue
5. ❌ Not saved → Check savePendingRating() on mount
```

### Test 3: Test Back Button (Should Work)
```
1. Open chat
2. Tap visible back arrow
3. Rating popup should appear
4. ✅ Works → Hardware back/swipe should work too
5. ❌ Doesn't work → Debug rating popup flow
```

### Test 4: Test Swipe Back (iOS) or Hardware Back (Android)
```
1. Open chat
2. Swipe from left edge (iOS) or press back (Android)
3. Check console for beforeRemove logs
4. Rating popup should appear
5. ✅ Works → Issue fixed!
6. ❌ Doesn't work → Check swipe/hardware back logs
```

### Test 5: Test Rating Submission
```
1. Popup appears
2. Select rating
3. Click Submit
4. Check console for logs:
   📤 submitRating: Sending to backend
   counselorId: [ID]
   ✅ Rating submitted successfully!
5. ✅ Rating submitted → Complete!
6. ❌ 404 error → Check ID and counselor exists in DB
```

---

## Console Logs Reference

### Successful Flow Logs
```
✅ resolveCounselorId resolved to: 507f...
📱 beforeRemove listener triggered - action: GoBack
🔍 Checking if rating needed...
🛑 Preventing navigation - showing rating popup
📤 submitRating: Sending to backend
   counselorId: 507f...
   stars: 4
   chatId: chat_...
✅ Rating submitted successfully!
   Response: {rating: 4.3, ratingCount: 15}
```

### Error Flow Logs
```
❌ resolveCounselorId: No counselor ID found!
   currentCounselor: null
```

OR

```
📤 submitRating: Sending to backend
   counselorId: 507f...
❌ Rating submission failed!
   HTTP Status: 404
   Error Message: Counselor not found
```

---

## Common Issues & Fixes

### Issue 1: 404 - Counselor Not Found
**Check:**
1. Is counselor ID resolved? (Check log: ✅ resolveCounselorId resolved to: ...)
2. Is ID format valid? (Should be 24 hex chars, not "undefined")
3. Does counselor exist in DB? (MongoDB query above)
4. Is counselor role "counsellor"? (2 L's!)

**Fix:**
1. Verify counselor exists in database
2. Ensure counselor role is exactly "counsellor"
3. Use correct MongoDB ObjectId format

### Issue 2: Swipe Back Not Showing Popup
**Check:**
1. Is pending rating saved? (Check AsyncStorage)
2. Is beforeRemove listener registered? (Check logs)
3. Is preventDefault() being called? (Check "🛑 Preventing navigation" log)

**Fix:**
1. Ensure savePendingRating() is called on mount
2. Check beforeRemove listener is properly set up
3. Test with visible back button first

### Issue 3: Rating Submission Always Fails
**Check:**
1. Is counselorId invalid? (Check "Invalid counselorId" error)
2. Is counselor missing from DB?
3. Is user authenticated? (Check 401 error)
4. Is counselor role wrong? (Check 404 error)

**Fix:**
1. Verify counselor exists and has correct role
2. Check user is authenticated with valid token
3. Verify API endpoint is correct

---

## Quick Fix Checklist

- [ ] Check counselor ID is resolved (not "undefined")
- [ ] Check pending rating is saved on mount
- [ ] Test visible back button shows popup
- [ ] Test swipe back shows popup (check logs)
- [ ] Test rating submission (check console logs)
- [ ] Verify counselor exists in DB
- [ ] Verify counselor role is "counsellor" (2 L's)
- [ ] Verify user has valid token
- [ ] Check beforeRemove listener logs
- [ ] Verify e.preventDefault() is being called

---

## Files Modified

| File | Changes |
|------|---------|
| ChatBox.jsx | Better counselor ID logging + beforeRemove logging |
| ratingService.js | Counselor ID validation + better error messages |

---

## Next Steps

1. **Build app with changes**
2. **Check console logs during testing**
3. **Try all navigation methods** (button, hardware, swipe)
4. **Verify counselor exists in database**
5. **Check beforeRemove logs for swipe**
6. **Share console output if still failing**

---

## Still Getting 404?

Provide:
1. The counselor ID being sent (from "submitRating: Sending to backend" log)
2. Console log showing the error
3. Result of MongoDB query: `db.users.findOne({_id: ObjectId("...")})`
4. Verify counselor role is "counsellor" (2 L's)

I'll help you fix it! 🔧
