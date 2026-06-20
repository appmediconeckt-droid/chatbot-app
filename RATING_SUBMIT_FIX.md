# ✅ Rating Submission - Enhanced Error Handling

## What I Fixed

Added detailed logging and better error messages to help diagnose rating submission issues.

### Change 1: Enhanced submitRating Logging
**File:** `c:/chatbot-app/src/services/ratingService.js` (Line 31-48)

**Before:**
```javascript
export async function submitRating({ counselorId, stars, comment = "", chatId }) {
  if (!counselorId) throw new Error("counselorId is required");
  if (!stars || stars < 1 || stars > 5) throw new Error("stars must be 1-5");

  const response = await api.post(`/api/counselors/${counselorId}/ratings`, {
    stars,
    comment: comment?.trim() || "",
    chatId: chatId || null,
  });

  if (counselorId) await markAsRated(counselorId);
  if (chatId) await removePendingRating(chatId);

  return response.data;
}
```

**After:**
```javascript
export async function submitRating({ counselorId, stars, comment = "", chatId }) {
  if (!counselorId) throw new Error("counselorId is required");
  if (!stars || stars < 1 || stars > 5) throw new Error("stars must be 1-5");

  try {
    console.log("DEBUG: submitRating called with:", { counselorId, stars, chatId });

    const response = await api.post(`/api/counselors/${counselorId}/ratings`, {
      stars,
      comment: comment?.trim() || "",
      chatId: chatId || null,
    });

    console.log("DEBUG: Rating submitted successfully:", response.data);

    if (counselorId) await markAsRated(counselorId);
    if (chatId) await removePendingRating(chatId);

    return response.data;
  } catch (error) {
    console.log("DEBUG: Rating submission failed!");
    console.log("Error status:", error.response?.status);
    console.log("Error data:", error.response?.data);
    console.log("Error message:", error.message);
    throw error;  // Re-throw so caller sees it
  }
}
```

**What Changed:**
- ✅ Added logging before API call
- ✅ Added logging for success
- ✅ Added try-catch to log errors
- ✅ Logs error status code (400, 401, 403, 404, 500)
- ✅ Logs error response from backend
- ✅ Logs error message for network issues

---

### Change 2: Better Error Messages in UI
**File:** `c:/chatbot-app/src/screens/user/Component/UserDashboard/Tab/ChatBox/ChatBox.jsx` (Line 559-588)

**Before:**
```javascript
const handleSubmitRating = async ({ stars, comment }) => {
  if (!ratingTarget) return;
  setRatingSubmitting(true);
  try {
    await ratingService.submitRating({
      counselorId: ratingTarget.counselorId,
      stars,
      comment,
      chatId: ratingTarget.chatId,
    });
    setShowRatingModal(false);
    Alert.alert("Thank you!", "Your rating helps others find the right counselor.");
    setTimeout(() => navigation.goBack(), 500);
  } catch (e) {
    console.log("submitRating failed:", e?.message);
    Alert.alert("Couldn't submit", "Please try again in a moment.");
  } finally {
    setRatingSubmitting(false);
  }
};
```

**After:**
```javascript
const handleSubmitRating = async ({ stars, comment }) => {
  if (!ratingTarget) return;
  setRatingSubmitting(true);
  try {
    console.log("handleSubmitRating: Submitting rating for counselorId:", ratingTarget.counselorId);

    await ratingService.submitRating({
      counselorId: ratingTarget.counselorId,
      stars,
      comment,
      chatId: ratingTarget.chatId,
    });

    console.log("handleSubmitRating: Rating submitted successfully!");
    setShowRatingModal(false);
    Alert.alert("Thank you!", "Your rating helps others find the right counselor.");
    setTimeout(() => navigation.goBack(), 500);
  } catch (e) {
    console.log("handleSubmitRating: ERROR -", e);
    const errorMsg = e?.response?.data?.error || e?.message || "Unknown error";
    const statusCode = e?.response?.status;
    const detailedMsg = statusCode
      ? `Error: ${statusCode} - ${errorMsg}`
      : errorMsg;

    console.log("Detailed error:", detailedMsg);
    Alert.alert("Couldn't submit rating", detailedMsg);  // ← Shows actual error to user!
  } finally {
    setRatingSubmitting(false);
  }
};
```

**What Changed:**
- ✅ Added logging at start
- ✅ Added logging on success
- ✅ Better error extraction: status code + backend error message
- ✅ Shows actual error to user instead of generic "please try again"
- ✅ Catches backend errors like "Only users can rate" or "Counselor not found"

---

## How to Use for Debugging

### Step 1: Enable Console/Logs
- **iOS:** Open Xcode → Run app → Console tab (Cmd+Shift+C)
- **Android:** Run `adb logcat` in terminal

### Step 2: Try Submitting a Rating
1. Open chat
2. Go back → rating popup shows
3. Select rating
4. Click "Submit rating"
5. Watch console/logs

### Step 3: Look for Debug Messages

**Success Case:**
```
DEBUG: submitRating called with: {counselorId: "507f...", stars: 4, chatId: "chat_..."}
handleSubmitRating: Submitting rating for counselorId: 507f...
DEBUG: Rating submitted successfully: {rating: 4.5, ratingCount: 12}
handleSubmitRating: Rating submitted successfully!
```

**Error Case:**
```
DEBUG: submitRating called with: {counselorId: "507f...", stars: 4, chatId: "chat_..."}
handleSubmitRating: Submitting rating for counselorId: 507f...
DEBUG: Rating submission failed!
Error status: 403
Error data: {error: "Only users can rate counselors"}
Error message: Request failed with status code 403
handleSubmitRating: ERROR - [error object]
Detailed error: Error: 403 - Only users can rate counselors
[User sees alert: "Couldn't submit rating - Error: 403 - Only users can rate counselors"]
```

---

## Common Error Codes & Fixes

| Status | Error | Cause | Fix |
|--------|-------|-------|-----|
| **400** | Invalid counselor id | Counselor ID not valid format | Check ID is 24-char hex string |
| **400** | stars must be between 1 and 5 | Invalid stars value | Make sure stars is 1-5 |
| **401** | Unauthorized | No token in request | Check token in AsyncStorage |
| **403** | Only users can rate | User role is not "user" | Check user role is correct |
| **404** | Counselor not found | Counselor doesn't exist | Verify counselor exists in DB |
| **500** | Server error | Backend crashed | Check backend logs |
| Network | Network Error | Backend unreachable | Check API_BASE_URL |

---

## Testing the Fix

### Test 1: Successful Rating
```
✅ Expected: Alert says "Thank you!"
✅ Console: Shows "Rating submitted successfully"
✅ Navigation: Auto-goes back
✅ Next time: No rating popup (already rated)
```

### Test 2: Error Case (Test 403)
```
1. Manually change user role in AsyncStorage to "counselor"
2. Try to submit rating
3. Should see: "Error: 403 - Only users can rate counselors"
4. Console shows all debug info
```

### Test 3: Network Error
```
1. Turn off wifi/mobile data
2. Try to submit rating
3. Should see: "Network Error"
4. Console shows connection failed
```

---

## Files Modified

| File | Changes |
|------|---------|
| `ratingService.js` | Added try-catch with detailed logging |
| `ChatBox.jsx` | Better error message extraction and display |

---

## Next Steps

1. **Build and run the app**
2. **Try submitting a rating**
3. **Check console for debug messages**
4. **If error:**
   - Note the status code and error message
   - Check the error table above
   - Follow the fix for that error code
   - Share the debug logs if stuck

---

## Example Debug Session

```
User opens chat
User tries to go back
Rating popup appears
User selects 4 stars + comment
User taps "Submit rating"

[Console Output:]
handleSubmitRating: Submitting rating for counselorId: 507f1f77bcf86cd799439011
DEBUG: submitRating called with: {
  counselorId: "507f1f77bcf86cd799439011",
  stars: 4,
  chatId: "chat_1718439600000"
}
DEBUG: Rating submitted successfully: {
  rating: 4.3,
  ratingCount: 15
}
handleSubmitRating: Rating submitted successfully!

[Alert shows:]
"Thank you! Your rating helps others find the right counselor."

[Navigation:]
User auto-navigates back to chat list

[Success! ✅]
```

---

## Debugging Guide

For detailed debugging steps and all possible error codes, see: **`RATING_SUBMIT_DEBUGGING.md`**

---

## Status: ✅ ENHANCED ERROR HANDLING

The rating submission now provides:
- ✅ Detailed logging at every step
- ✅ Clear error messages to users
- ✅ Complete error information in console
- ✅ Easy troubleshooting path

**Ready to test!**
