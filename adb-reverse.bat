@echo off
REM Re-maps the phone's localhost ports to this PC over USB.
REM Run this after every replug / reboot if the app shows "Network Error".
REM   5001 = backend API, 8081 = Metro bundler
adb reverse tcp:5001 tcp:5001
adb reverse tcp:8081 tcp:8081
echo.
echo Current adb reverse mappings:
adb reverse --list
echo.
echo Done. If both 5001 and 8081 are listed above, the app can reach the backend.
pause
