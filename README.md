# NZB-7/24

A local-first control room for Sonarr, Radarr, Lidarr, SABnzbd and NZBGet: one
place to watch service health, browse the combined library, work the download
queue and add new titles.

Runs as a web app while you develop it, and ships to **Windows**, **macOS** and
**Android** from the same codebase.

```
npm install
npm run dev        # http://localhost:5173
```

No account, no cloud, no telemetry. Everything is stored on the device that runs
it and only ever talks to the server addresses you enter.

---

## What it does

| Area | Behaviour |
| --- | --- |
| Control room | Live health for every configured service, combined throughput, recent arrivals |
| Library | One searchable, filterable grid across every media manager, with per-title detail |
| Queue | Unified download list with progress, speed, ETA, pause/resume/remove where the API supports it |
| Search | Fan-out lookup against each media manager, add straight to the library |
| Services | Add, edit, test, pause or remove connections; credentials stay local |
| Settings | Refresh cadence, density, demo mode, integration catalogue, export/import |

Capabilities are per-integration, so the UI never shows a button that a service
cannot honour.

## Connecting your stack

Each service needs its address and credentials. Nothing is pre-filled except the
default port.

| Service | Address | Credential |
| --- | --- | --- |
| Sonarr | `http://host:8989` | Settings → General → API Key |
| Radarr | `http://host:7878` | Settings → General → API Key |
| Lidarr | `http://host:8686` | Settings → General → API Key |
| SABnzbd | `http://host:8080` | Config → General → API Key |
| NZBGet | `http://host:6789` | Control → username + password |

Use **Add service → (pick one)** and the form fills the default port. Test it
from the Services list at any time.

### Demo mode

Settings → *Load the demo stack* adds a sample library and a simulated queue, so
the whole app is usable before you connect anything. Removing it deletes only
the demo connections.

## Architecture

```
src/
  core/
    types.ts              shared domain model
    http.ts               fetch wrapper, timeouts, readable errors
    format.ts             bytes / speed / ETA / relative time
    api.ts                fan-out across servers, plugin lookup
    integrations/
      contract.ts         the plugin interface
      registry.ts         register / resolve / list
      context.ts          per-server client with auth + URL assembly
      builtin/            sonarr, radarr, lidarr, sabnzbd, nzbget
      demo.ts             sample provider
  store/                  state, persistence, actions
  ui/                     shell, primitives, views
electron/                 desktop shell (window, CORS, external links)
capacitor.config.ts       Android/iOS wrapper config
```

State lives in a tiny observable store backed by `localStorage`, so the same
bundle works in a browser, in Electron and in a Capacitor WebView.

### Why the desktop shell relaxes CORS

Sonarr and friends do not send CORS headers for arbitrary origins, so a desktop
window cannot call them directly under the default policy. The Electron window
loads only the bundled app (external links open in the system browser) and
disables web security for that window alone. On Android, `CapacitorHttp` sends
requests through the native stack instead.

## Packaging

### Windows and macOS

```bash
npm i -D electron electron-builder
npm run desktop:run     # unpackaged, from dist/
npm run desktop:pack    # installer / dmg in release/
```

macOS builds must be produced on macOS. Windows NSIS + portable targets are
configured in `package.json`.

### Android

The `android/` native project is checked in, so a fresh clone only needs the
toolchain:

1. **JDK 21** — `winget install Microsoft.OpenJDK.21`
2. **Android SDK** — download the command-line tools, then:

   ```powershell
   sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
   ```

3. Point Gradle at the SDK. `android/local.properties` is git-ignored:

   ```
   sdk.dir=C:/Android/sdk
   ```

Then build:

```bash
npm run android:apk       # debug APK, no signing needed
npm run android:release   # signed release APK
```

| Build | Output |
| --- | --- |
| Debug | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release | `android/app/build/outputs/apk/release/app-release.apk` |

Install over USB or a file manager: `adb install -r app-release.apk`.

`npm run android:open` opens the project in Android Studio if you prefer the GUI.

#### Signing

`android/app/nzb724-release.jks` and `android/keystore.properties` hold the
release key; both are git-ignored. **Back them up.** Android will not install an
update signed with a different key, so losing them means uninstalling the app
before any future build installs.

`scripts/make-icons.ps1` regenerates the launcher icons and splash screens at
every density from the app's own brand mark.

#### Cleartext HTTP

`targetSdk` 36 blocks plain `http://` by default, but your services are almost
certainly served over HTTP on the LAN, so the manifest sets
`android:usesCleartextTraffic="true"`. Without it, every request fails with
`CLEARTEXT communication not permitted`.

Reaching those services from a phone needs the phone on the same network, or a
VPN/Tailscale route to those ports.

## Extending

Adding a service is one file plus one line in the registry. See
[PLUGINS.md](./PLUGINS.md) for the contract, two worked examples and the rules
that keep the UI service-agnostic.

## Notes

- **Design:** the interface is an original design for this project. It is not a
  copy of any existing client's skin or assets.
- **Credentials:** stored unencrypted in local storage, like a browser session.
  Export files contain API keys - treat them as secrets.
- **Removing a service** only deletes the connection here; it never touches the
  remote server.
- Reaching LAN services from a phone needs the phone on the same network, or a
  VPN/Tailscale route to those ports.

## License

[MIT](./LICENSE) © 2026 don007shfx.

MIT covers this app's own code. It is not affiliated with, endorsed by, or
derived from Sonarr, Radarr, Lidarr, SABnzbd, NZBGet or any other third-party
client; those names belong to their respective projects.
