# Framewave Android engine migration

## Decision and scope

The Android app now uses the Vega React Native / Expo application as its engine. ZeeFlix/Framewave branding, the existing web app, and the liquid-glass visual direction are retained. The website is still the original Rust/WebAssembly project and does not import Vega.

Upstream source: [`vega-org/vega-app`](https://github.com/vega-org/vega-app), commit `fb0e51110c1a55e138628828c58236aa20d3b282`. Its `LICENSE` and `NOTICE` are preserved in `android-app/`.

## License — important

The upstream version at the pinned commit is licensed under **PolyForm Noncommercial 1.0.0**. The project’s intended use is noncommercial. Do not add ads, monetization, commercial distribution, or use this code in a commercial product without obtaining separate permission from the Vega licensor. `android-app/LICENSE` and `android-app/NOTICE` are the applicable upstream texts; the upstream notice includes placeholder licensor and contact fields, which remain unverified. Root `LICENSE` does not relicense the Android subtree. Third-party libraries and provider code have separate terms.

The README and release notes must retain this restriction. Do not describe the whole repository as MIT-only.

## Provider configuration

`ExtensionManager` seeds the official Zenda-Cross source (`Zenda-Cross/vega-providers`) and permits only manifest value `vega`, displayed as VMovies. The provider modules themselves are fetched from Zenda-Cross at runtime; they are not vendored into this repository. The normal UI has no source URL or JSON editor, and source deep links are not accepted. The provider catalog can change upstream, but all entries except VMovies are filtered out. Only install/use provider modules from the pinned trusted source.

This is an extension integration, not a hosted bridge service. It needs network access to fetch the manifest/modules and to contact provider sites. The web app’s bridge flow is unchanged and still needs a running compatible HTTPS manifest endpoint and browser CORS.

## Branding and compatibility

- Android application ID remains `com.zeeflix.app` so a correctly signed update can retain the package identity.
- Display name and URI scheme use Framewave branding.
- App version is 1.3.0; Android version code 4.
- Minimum supported Android version is API 28 / Android 9 (higher than the retired Kotlin app) because Vega’s selected native engine requires it.
- Translucent surfaces, mint accents, and the existing engraved icon approximate the requested liquid-glass look; this is not a pixel-identical port of the prior UI.
- The prior native Android source remains in `android/` as a historical fallback while the new Expo path is validated. CI and release builds use only `android-app/`.
- The retired Kotlin app used Android SharedPreferences (`zeeflix_state_v1`), while Vega stores state in MMKV. There is no migration importer yet: old watch history, favorites, and settings may remain in the app's private storage after an in-place update but are not automatically shown in Framewave. Export or record anything important before updating.

## Build and checks

```bash
cd android-app
npm ci
npm run build:sandbox
npx tsc --noEmit
npm run lint:framewave
npx jest __tests__/manifestProviderPath.test.ts __tests__/settingsStorage.test.ts --runInBand
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew testDebugUnitTest assembleDebug --no-daemon
```

Requires Node 22, Java 17, and Android SDK/build tools. GitHub Actions runs this build for PRs and `main`. Build output: `android-app/android/app/build/outputs/apk/debug/app-debug.apk`.

## Readiness and security

Local dependency audit (`npm audit --omit=dev`) reported **36 production dependency advisories** in this upstream dependency tree: 16 high, 18 moderate, and 2 low. These have not been resolved or reviewed yet. `npm audit fix --dry-run` also fails against the upstream `$react-native` override. Do not treat the Android APK as release-ready until maintainers review the advisories and decide on safe upgrades/removals.

The full upstream Jest run also had failures in unrelated existing suites/native Jest shims; the two targeted Framewave policy suites and TypeScript check pass. Local Expo prebuild/APK compilation could not be completed in this sandbox because the sharp binary download from GitHub failed TLS/network setup and Java/Gradle are not installed. GitHub Actions still needs to validate the generated Android project before release.

## Carried-forward settings

The app has a clear-watch-progress/history action under Data Management. `Include 18+ results` is disabled by default and only applies to provider posts with explicit maturity labels; provider labeling is not independently verified, so this is a convenience filter, not parental control.
