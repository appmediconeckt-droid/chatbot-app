# Role File Structure

This structure is prepared for adding role-based access and role-wise dashboards without changing existing app code yet.

```text
src/features/
  roles/
    constants/
    config/
    permissions/
    navigation/
    services/
    hooks/
    components/
      RoleCard/
      RoleBadge/
      RoleGuard/
      PermissionGate/
    screens/
      RoleSelector/
      RoleSignupRouter/
      RolePendingApproval/
      Unauthorized/
    utils/
    data/

  patient/
    screens/
    components/
    navigation/
    services/
    hooks/

  hospital-admin/
    screens/
    components/
    navigation/
    services/
    hooks/

  branch-admin/
    screens/
    components/
    navigation/
    services/
    hooks/

  doctor/
    screens/
    components/
    navigation/
    services/
    hooks/

  counselor/
    screens/
    components/
    navigation/
    services/
    hooks/

  nurse-lab-technician/
    screens/
    components/
    navigation/
    services/
    hooks/

  pharmacist/
    screens/
    components/
    navigation/
    services/
    hooks/

  receptionist/
    screens/
    components/
    navigation/
    services/
    hooks/

  billing-accounts/
    screens/
    components/
    navigation/
    services/
    hooks/

  housekeeping/
    screens/
    components/
    navigation/
    services/
    hooks/

  super-admin/
    screens/
    components/
    navigation/
    services/
    hooks/
```

Role list covered:

- Patient
- Counselor / Psychologist / Doctor Specialist
- Hospital Admin
- Branch Admin
- Nurse / Lab Technician
- Pharmacist
- Receptionist
- Billing / Accounts
- Housekeeping
- Super Admin

## Step-by-Step Role Setup

### Step 1: Shared role system

Common role logic is now kept in:

```text
src/features/roles/
  constants/roleTypes.js
  utils/normalizeRole.js
  navigation/roleRoutes.js
  config/roleModules.js
  permissions/rolePermissions.js
  index.js
```

Use this module for:

- role names
- old role aliases like `counsellor`
- dashboard route mapping
- permission mapping
- future role signup/routing rules

### Step 2: Patient code added under role folder

Patient/user code now has role-based entry files here:

```text
src/features/patient/
  index.js
  screens/
    UserDashboard.jsx
    ChatBox.jsx
    CounselorDirectory.jsx
    CheckoutPage.jsx
    TransactionsHistory.jsx
    AppLockSettings.jsx
    index.js
```

These files currently export the existing working patient screens from:

```text
src/screens/user/Component/UserDashboard/
```

This keeps the current app stable while the role structure becomes active.

### Step 3: Counselor code added under role folder

Counselor code now has role-based entry files here:

```text
src/features/counselor/
  index.js
  screens/
    CounselorDashboard.jsx
    SMSInput.jsx
    Dashboard.jsx
    Messages.jsx
    PatientRequests.jsx
    CounselorProfile.jsx
    CounselorNotifications.jsx
    CounselorWallet.jsx
    PrescriptionReviews.jsx
    CounselorSettings.jsx
    CounselorHelpSupport.jsx
    CounselorPrivacyPolicy.jsx
    index.js
```

These files currently export the existing working counselor screens from:

```text
src/screens/user/Component/counselor-dashboard/
```

### Step 4: App navigation connected to role folders

`App.tsx` now imports patient and counselor screens from:

```text
src/features/patient/screens/
src/features/counselor/screens/
src/features/roles/
```

This means the app has started using the new role-based structure.

### Step 5: Next role implementation pattern

For any new role, follow this pattern:

```text
src/features/<role-name>/
  screens/
  components/
  navigation/
  services/
  hooks/
  index.js
```

Then add the role in:

```text
src/features/roles/constants/roleTypes.js
src/features/roles/navigation/roleRoutes.js
src/features/roles/config/roleModules.js
src/features/roles/permissions/rolePermissions.js
```
