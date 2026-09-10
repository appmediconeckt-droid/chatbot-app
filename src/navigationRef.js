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

  const isCounselor = /counsell?or/i.test(String(role || ''));
  const screen = isCounselor ? 'CounselorSignup' : 'UserSignup';
  const params = { role: isCounselor ? 'counselor' : 'user' };

  navigationRef.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [{ name: 'RoleSelector' }, { name: screen, params }],
    }),
  );
  setTimeout(() => {
    resetting = false;
  }, 1500);
  return true;
};
