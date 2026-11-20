> **Historical document:** this audit concerns the retired Kotlin/Media3 Android implementation from November 2026. Since Framewave 1.3.0, the Android app is built from `android-app/` (React Native / Expo) with minimum Android API 28. This document is not a current audit of the new Android engine.

# ZeeFlix Native Android — Audit, Fixes and APK Delivery

Date: 2026-11-18
Branch: `arena/08765205-zeeflix` · PR: [#2](https://github.com/flixybuild-lgtm/ZeeFlix/pull/2)

## 1. Scope and method

The native app (`android/`, Kotlin + Media3 ExoPlayer, `minSdk 24`, `targetSdk 35`) was
reviewed against the Rust/WebAssembly reference implementation (`src/model.rs`,
`public/sources.js`, `public/player.js`), which defines the intended behaviour for
catalogue parsing, filtering, provider validation, resume rules and playback fallbacks.

Every fix is covered by a local unit test in `android/app/src/test/`, and the whole suite
is executed by CI (`gradle testDebugUnitTest`) on every pull request. The catalogue tests
read the live `public/catalog.tsv` through a Gradle-generated test resource, so parser and
data cannot drift apart silently.

## 2. Bugs found and fixed

| # | Severity | Bug | Fix |
| --- | --- | --- | --- |
| 1 | **High** (device support) | `minSdk 24` but `@mipmap/ic_launcher` existed only in `mipmap-anydpi-v26`. Android 7.0/7.1 (API 24–25) had **no matching resource**, so the launcher/app-info icon failed to resolve. | Added raster `ic_launcher.png` for `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`. |
| 2 | **High** (device support) | `targetSdk 35` is edge-to-edge on Android 15+: the window is no longer inset, so the top bar, detail scrolling, splash card and player overlays rendered **under the status and navigation bars**. | New `ui/WindowInsets.kt` applies `WindowInsetsCompat` (`systemBars() or displayCutout()`) padding to the top bar, detail scroll, splash and player overlays. Material's `BottomNavigationView` insets itself. |
| 3 | Medium | Embedded players hide the local Quality/Speed/Subtitles/Audio bar, but it **reappeared after leaving Picture-in-Picture** and those buttons cannot control an embed. | `embedMode` flag keeps `playerOptionsBar` hidden in `onPictureInPictureModeChanged`. |
| 4 | Medium | The spotlight film (*Tears of Steel*) could not play when the PeerTube discovery API was unreachable, although the web player has a direct-rendition fallback. | `PlaybackFallback` (pure model object) + `ProviderClient.resolvePeerStream`, used **only** on `IOException`; an explicit "not published" answer from the provider is still honoured. |
| 5 | Low | Source/media validation accepted non-ASCII hosts and paths (`Char.isLetterOrDigit`), unlike the web platform, so e.g. `https://münchen.de/a.mp4` passed. | ASCII-only host/media/embed matching, aligned with `safe_source`/`safe_embed` in `src/model.rs`. |

### Checked and found correct (no change needed)

* `asset:///` URIs for the bundled `sintel.webm` and the WebVTT subtitles, with
  `androidResources.noCompress` covering `webm/webp/vtt` — required so ExoPlayer can
  `mmap` the asset.
* Catalogue parsing, download flags, provider CRUD/id allocation, resume thresholds
  (`time >= 3`, `time + 3 < duration`, `time < 98 %`), collection ordering, My List /
  Favorites / History / Downloads persistence.
* `AndroidManifest` exported flags, PiP declaration, `usesCleartextTraffic="false"`.
* All `binding.*`, `R.id`, `R.drawable`, `R.color`, `R.string`, `R.layout` and `R.menu`
  references resolve (verified with a scripted cross-check of every layout and menu).
* Web-platform behaviour for `Continue Watching`, episode navigation
  (`gran-dillama` ↔ `llamigos`) and provider download gating.

## 3. Tests (TDD)

`android/app/src/test/java/com/zeeflix/app/model/`:

| Suite | Covers |
| --- | --- |
| `CatalogParserTest` | Live `catalog.tsv` (11 rows, unique ids), format/source mapping, download flags, spotlight ids, malformed-row tolerance |
| `SourceValidatorTest` | URL/embed allowlist, credentials, traversal, control characters, **ASCII-only hosts**, rights/name/format rules, download gating |
| `FilterTest` | Query trim + case, genre/actor/year intersection |
| `WatchProgressTest` | Resume thresholds incl. degenerate durations |
| `FilmTest` | `kind()`, `primaryGenre()`, `providerName()`, `Provider.toFilm()` |
| `PlaybackFallbackTest` | Spotlight fallback present and safe; no fallback for other titles |
| `ZeeFlixCoreTest` | Pre-existing suite (kept) |

**Red → green evidence.** The tests were written before the fixes and run locally against
a JDK 17 + Kotlin toolchain:

* `SourceValidatorTest.hostsAndMediaPathsAreAsciiOnly` **fails** against the previous
  `isLetterOrDigit` implementation (`AssertionError`) and passes after the ASCII fix.
* `PlaybackFallbackTest` does not compile without the new model object (compile error),
  and passes once `PlaybackFallback` exists.
* Final local run: **26/26 tests pass**; the same 26 run green in CI.

## 4. Build, lint and APK verification (CI)

`.github/workflows/android-apk.yml` runs on every pull request and on manual dispatch:

```bash
gradle testDebugUnitTest lintDebug assembleDebug --no-daemon
```

and then verifies the artifact before publishing it:

* `aapt2 dump badging` — package, `sdkVersion`, `targetSdkVersion`, label, launchable activity
* `apksigner verify --print-certs` — signature scheme and signing certificate
* `zipalign -c 4` — alignment
* artifact upload as `ZeeFlix-Android-APK`

### Delivered artifact

| | |
| --- | --- |
| File | `dist/ZeeFlix-1.0.0-debug.apk` (45 MB) |
| Package | `com.zeeflix.app` |
| Version | `1.0.0` (versionCode 1) |
| `minSdk` / `targetSdk` | 24 / 35 |
| Native libs | none — runs on every ABI (armeabi-v7a, arm64-v8a, x86, x86_64) |
| Signature | APK Signature Scheme **v2** (verified; required for `targetSdk 30+`) |
| Contents | `classes.dex`, `assets/catalog.tsv`, 15 poster WebP, `media/sintel.webm` (stored uncompressed) + English VTT subtitles |
| Integrity | ZIP CRC check passes; 1155 entries |

A permanent download URL is also published to the `ci-apk/latest` branch:

`https://github.com/flixybuild-lgtm/ZeeFlix/raw/ci-apk/latest/artifacts/ZeeFlix-1.0.0-debug.apk`

That branch exists only to host the 45 MB binary; delete it when the APK is no longer
needed.

### Install

```bash
adb install -r ZeeFlix-1.0.0-debug.apk
```

On a device: enable *Install unknown apps* for the source used (browser/file manager),
then open the APK. No Google Play account or signature upload is required — it is a
self-contained debug-signed APK.
