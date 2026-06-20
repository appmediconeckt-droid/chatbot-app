#!/bin/bash

# Add useTranslation to all screens that don't have it

SCREENS=(
  "src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx"
  "src/screens/user/Component/PatientProfile/PatientProfile.jsx"
  "src/screens/user/Component/UserDashboard/Tab/HelpSupport/HelpSupport.jsx"
  "src/screens/user/Component/UserDashboard/Tab/PrivacyPolicy/PrivacyPolicy.jsx"
  "src/screens/user/Component/UserDashboard/Tab/UserAccountSettings.jsx"
  "src/screens/user/Component/UserDashboard/Tab/Callls/CallHistory.jsx"
  "src/screens/account/ChangePassword.jsx"
  "src/screens/account/SetPassword.jsx"
  "src/screens/account/SetPasswordByOtp.jsx"
  "src/screens/auth/AppLockScreen.jsx"
  "src/screens/auth/CounselorSignup.jsx"
  "src/screens/auth/LocationGate.jsx"
  "src/screens/auth/OTPVerification.jsx"
  "src/screens/auth/PinSetupScreen.jsx"
  "src/screens/auth/RoleSelector.jsx"
  "src/screens/auth/UserSignup.jsx"
  "src/screens/user/Component/counselor-dashboard/Dashboard/dashboard.jsx"
  "src/screens/user/Component/counselor-dashboard/Tab/CounselorDashboard/Dashboardcou.jsx"
  "src/screens/user/Component/counselor-dashboard/Tab/PatientRequests/PatientRequests.jsx"
  "src/screens/user/Component/counselor-dashboard/Tab/Profile-Con/CounselorProfile.jsx"
  "src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput.jsx"
  "src/screens/user/Component/counselor-dashboard/Tab/Settings/CounselorSettings.jsx"
)

echo "✅ To add useTranslation to remaining screens:"
echo "1. In each file above, add: import { useTranslation } from 'react-i18next';"
echo "2. In component, add: const { t } = useTranslation();"
echo "3. Replace hardcoded text with t() calls"
echo ""
echo "Example:"
echo '<Text>Login</Text> → <Text>{t("auth:login")}</Text>'
echo '<Text>Loading</Text> → <Text>{t("common:loading")}</Text>'
