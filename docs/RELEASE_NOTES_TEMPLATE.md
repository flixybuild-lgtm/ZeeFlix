# Framewave 1.3.0

This release replaces the Android app engine with a Framewave-branded adaptation of Vega while keeping the Rust/WebAssembly website separate. Android now preconfigures the official Zenda-Cross source and exposes only the VMovies extension; users do not enter a URL or JSON manifest.

- **Android engine:** React Native / Expo, with Vega’s provider sandbox, playback, downloads, watchlist and casting capabilities.
- **Zenda-Cross setup:** one source, one surfaced extension (VMovies), no end-user source editor. The extension manifest and code are fetched from the Zenda-Cross repository at runtime.
- **Liquid-glass appearance:** mint accents, the Framewave launcher/splash icon, translucent cards and subtle edge highlights.
- **Settings carried forward:** explicit 18+ results remain opt-in and are filtered only when the provider labels them; watch progress/history can be cleared in Data Management.
- **Upgrade note:** the prior Kotlin app's watch history, favorites and settings are not automatically imported to the new MMKV-based app. Record anything important before updating; the legacy data may remain in private app storage but is not shown in Framewave.
- **Website:** remains a separate Rust/WebAssembly application with its existing bridge requirements.
- **Compatibility:** Android 9+ (API 28), arm64-v8a and armeabi-v7a. This is a debug-signed sideload build, not a Play Store release.

**License:** the Android source includes Vega code at upstream commit `fb0e51110c1a55e138628828c58236aa20d3b282` under PolyForm Noncommercial 1.0.0, with the upstream `LICENSE` and `NOTICE` retained. This build is for noncommercial use only. Commercial use, ads, monetization or commercial distribution needs separate permission from the licensor.

**Install:** the release workflow publishes `Framewave-v1.3.0-debug.apk` and the stable `ZeeFlix-latest.apk` alias. Verify against `SHA256SUMS.txt`.
