# NetShare Flutter app

## Run on a physical Android device with a local backend

Start the backend on port 8000 and connect the phone by USB with debugging enabled. From this directory, run:

```powershell
& "C:\Android\Sdk\platform-tools\adb.exe" reverse tcp:8000 tcp:8000
flutter run --dart-define=NETSHARE_API_URL=http://127.0.0.1:8000/api
```

`10.0.2.2` is the build's default API host and works only in the Android emulator. On a physical phone, use the command above each time you run Flutter. `adb reverse` is tied to the USB connection; reapply it after reconnecting. To run without USB, pass a reachable HTTPS backend URL instead.

Check connectivity from the phone with:

```powershell
& "C:\Android\Sdk\platform-tools\adb.exe" shell curl -sS http://127.0.0.1:8000/health/ready
```
