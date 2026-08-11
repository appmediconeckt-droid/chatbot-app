# PowerShell helper to generate a JKS keystore for Android release builds.
# Requires a JDK (keytool) on PATH. Run from project root.
param(
  [string]$KeystorePath = "android/app/my-release-key.keystore",
  [string]$Alias = "my-key-alias",
  [string]$StorePass = "ChangeIt2026!",
  [string]$KeyPass = "ChangeIt2026!",
  [string]$DName = "CN=App Release, OU=Dev, O=Company, L=City, S=State, C=IN"
)

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  Write-Error "keytool not found. Install the JDK and ensure 'keytool' is on PATH."
  exit 1
}

$keytoolArgs = "-genkeypair -v -keystore \"$KeystorePath\" -alias $Alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $StorePass -keypass $KeyPass -dname \"$DName\""
Write-Host "Generating keystore at: $KeystorePath"
Write-Host "Running: keytool $keytoolArgs"

& keytool $keytoolArgs

if ($LASTEXITCODE -ne 0) {
  Write-Error "keytool failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "Keystore generated. Next: copy keystore.properties.example -> keystore.properties and fill values, then run 'cd android; .\gradlew.bat bundleRelease'"
