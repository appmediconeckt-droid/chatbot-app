import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

/**
 * Navigation handle usable from outside React — the axios interceptor needs to
 * send the user to the login screen when the backend says the session is dead,
 * and it has no component to call navigation from.
 */
export const navigationRef = createNavigationContainerRef();

// Several requests usually fail at once when a session dies, and every one of
// them tries to bounce the user out. Only the first should actually navigate.
let resetting = false;

export const resetToLogin = (role) => {
  if (!navigationRef.isReady() || resetting) return false;
  resetting = true;

  // Send the user to the SAME login screen RoleSelector uses, not the standalone
  // 'Login' route. UserSignup / CounselorSignup host the login form the app
  // normally shows; landing on 'Login' instead looked like a different, larger
  // page because it is a different component.
  // counsell?or matches BOTH spellings the app stores: counselor / counsellor.
  const isCounselor = /counsell?or/i.test(String(role || ''));
  const screen = isCounselor ? 'CounselorSignup' : 'UserSignup';
  const params = { role: isCounselor ? 'counselor' : 'user' };

  navigationRef.dispatch(
    CommonActions.reset({
      // RoleSelector sits underneath so back from the login screen returns
      // there instead of closing the app. index 1 = the login screen is shown.
      index: 1,
      // reset, not navigate: the dashboard must not stay on the back stack for
      // a session that no longer exists.
      routes: [{ name: 'RoleSelector' }, { name: screen, params }],
    }),
  );
  setTimeout(() => {
    resetting = false;
  }, 1500);
  return true;
};
