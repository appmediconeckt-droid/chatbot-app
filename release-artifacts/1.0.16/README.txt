Humaeli 1.0.16 (build 18)
Package: com.mindcrawller.humaeli

PLAY STORE UPLOAD
Select Humaeli-1.0.16-build18.aab in Play Console > App bundles > Upload.
The .apk file is for direct installation/testing on an Android phone.
In the macOS file picker, press Command+Shift+G and paste this folder path:
/Users/mediconeckt_it/Documents/Arun/AndroidApp/chatbot-app/release-artifacts/1.0.16

CHANGES
- User, consultant and doctor signup OTP dialogs keep Verify/Cancel above the keyboard.
- OTP headings and fields can scroll on smaller screens.
- Shared login/device-conflict verification covers user, consultant, doctor and staff login.
- Password-reset OTP flows and user/consultant password settings use measured keyboard overlap.
- Existing OTP drafts stay intact when the keyboard opens, closes or resizes the viewport.
- Version 1.0.16 is read from shared release metadata on all role screens.

CHECKS
- Release APK and AAB builds succeeded.
- 19 Jest suites / 148 tests passed.
- ESLint: no errors in changed production files.
- APK signature and AAB JAR signature verified.
- AAB validated with Android bundletool; manifest inspected.
- APK ZIP 16 KB alignment and all 46 included 64-bit ELF library alignments checked.
- Manual verification of the OTP flow on a phone remains to be done.

These artifacts use the project's existing configured release upload key.
Google Play Console determines upload-key acceptance and release eligibility.
