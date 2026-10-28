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
let pendingLoginReset = false;

// The shared Login screen (every role signs in there), with Landing under it so
// Back from Login lands on Landing instead of leaving a blank stack. Used after
// logout and when a session ends — signing out must not drop the user on the
// Sign Up flow (RoleSelector / *Signup), which is for new accounts.
const LOGIN_STACK = { index: 1, routes: [{ name: 'Landing' }, { name: 'Login' }] };

export const resetToLoginScreen = (navigation) => {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.reset(LOGIN_STACK));
    return;
  }
  navigation?.replace?.('Login');
};

// Session ended elsewhere (401 / signed in on another device). Several failing
// requests call this at once; only the first navigates.
export const resetToLogin = () => {
  if (resetting) return false;
  if (!navigationRef.isReady()) {
    pendingLoginReset = true;
    return true;
  }
  resetting = true;
  pendingLoginReset = false;
  navigationRef.dispatch(CommonActions.reset(LOGIN_STACK));
  setTimeout(() => {
    resetting = false;
  }, 1500);
  return true;
};

export const flushPendingLoginReset = () => {
  if (!pendingLoginReset || resetting || !navigationRef.isReady()) return false;
  return resetToLogin();
};
