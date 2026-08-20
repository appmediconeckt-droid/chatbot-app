# Play upload key reset

Use this file in Google Play Console after the upload-key reset request is accepted:

`android/app/humaeli-upload-certificate-reset-2026.pem`

This is the public upload certificate only. Do not upload the `.jks` keystore file to Play Console.

The local release signing config uses:

`android/app/humaeli-upload-key-reset-2026.jks`

The generated signed bundle is:

`android/app/release/app-release.aab`

Certificate fingerprints:

SHA-1: `FE:CD:50:4A:DB:B1:DA:57:AB:62:98:49:C5:34:5E:76:B4:A6:CD:24`

SHA-256: `AA:2C:CC:CB:A0:4C:2A:A5:98:C3:69:4E:F4:3B:F5:CE:EE:09:F7:AF:C9:C3:30:A4:A1:21:AD:A4:E5:6E:B8:29`

After Play accepts this certificate, build future releases with:

```sh
cd android
./gradlew bundleRelease
```
