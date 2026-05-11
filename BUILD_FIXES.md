# React Native Android Build Fixes

## Issues Fixed

### 1. Gradle Daemon Crashing (JVM Heap)
**Problem:** Build failed with "Gradle build daemon disappeared unexpectedly"  
**Root Cause:** Insufficient JVM memory (2GB) for compiling large React Native projects with many dependencies

**Solution Applied:**
- Updated `android/gradle.properties`:
  - Increased JVM heap: `-Xmx2048m` → `-Xmx4g`  
  - Increased MetaspaceSize: `-XX:MaxMetaspaceSize=512m` → `-Xmx4g -XX:MaxMetaspaceSize=1024m`
  - Added file encoding: `-Dfile.encoding=UTF-8`
  - Reduced architectures from `armeabi-v7a,arm64-v8a,x86,x86_64` → `arm64-v8a` (faster builds, modern devices)

### 2. Code Changes Not Applying (Hot Reload)
**Problem:** JavaScript changes not reflected when running app  
**Root Cause:** Stale Metro bundler cache + Gradle build cache

**Solution Applied:**
- Cleared Metro cache: `npx react-native start --reset-cache`
- Cleared Gradle build cache: `cd android && .\gradlew.bat clean`

---

## APK Build Commands

### Debug APK (for testing/development)
```powershell
cd "C:\Users\vsing\OneDrive\Desktop\New folder (4)\chatbots\android"
.\gradlew.bat assembleDebug
```

**Output location:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (for Play Store)
Requires signing configuration in `android/app/build.gradle`

```powershell
cd "C:\Users\vsing\OneDrive\Desktop\New folder (4)\chatbots\android"
.\gradlew.bat assembleRelease
```

**Output location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Fast Refresh (Hot Reload) Setup

To ensure code changes apply without rebuilding:

1. Start Metro dev server in one terminal:
```powershell
npx react-native start --reset-cache
```

2. In another terminal, run the app:
```powershell
npx react-native run-android
```

3. Edit your code in `src/` folder
4. Press `R` twice in Metro terminal to reload, or use Fast Refresh (auto-reload on save)

---

## Updated gradle.properties

```properties
# JVM memory settings (INCREASED)
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8

# Architecture (REDUCED for faster builds)
reactNativeArchitectures=arm64-v8a
```

---

## Testing the APK

Install and test the debug APK:
```powershell
# Connect Android device via USB or use emulator
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Next Steps if Issues Persist

If Gradle still crashes:
1. Increase JVM args further: `-Xmx6g` or `-Xmx8g`
2. Move project out of OneDrive to `C:\chatbots` (OneDrive sync can interfere)
3. Kill all Java/Node processes: `Stop-Process -Name "java", "node" -Force`
4. Run Gradle clean again: `cd android && .\gradlew.bat clean`
