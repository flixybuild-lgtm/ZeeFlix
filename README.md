<div align="center">

<img src="docs/marketing/readme-hero.png" alt="Framewave — Cinema on your wavelength. Free open-cinema streaming for Android and the web." width="100%">

# Framewave

### Cinema on your wavelength.

**A streaming app for Android and the web — built from scratch by a 9th-class student.**

[![Download APK](https://img.shields.io/badge/⬇_Download-Android_APK-f8b74f?style=for-the-badge&logo=android&logoColor=0b0c0f)](https://github.com/flixybuild-lgtm/ZeeFlix/releases/latest/download/ZeeFlix-latest.apk)
[![Web App](https://img.shields.io/badge/▶_Open-Web_App-54bbef?style=for-the-badge&logo=googlechrome&logoColor=0b0c0f)](https://flixybuild-lgtm.github.io/ZeeFlix/)
[![Install Page](https://img.shields.io/badge/📱_Install-Guide-bf7efb?style=for-the-badge&logo=readthedocs&logoColor=0b0c0f)](https://flixybuild-lgtm.github.io/ZeeFlix/install.html)

[![Release](https://img.shields.io/github/v/release/flixybuild-lgtm/ZeeFlix?style=flat-square&color=f8b74f)](https://github.com/flixybuild-lgtm/ZeeFlix/releases)
![Platforms](https://img.shields.io/badge/platforms-Android_7.0%2B_·_Web-15161a?style=flat-square)
![Size](https://img.shields.io/badge/APK-45_MB-15161a?style=flat-square)
![No tracking](https://img.shields.io/badge/trackers-0-6bdbab?style=flat-square)
![No ads](https://img.shields.io/badge/ads-none-6bdbab?style=flat-square)
![License](https://img.shields.io/badge/code-MIT-6bdbab?style=flat-square)
![Films](https://img.shields.io/badge/films-Creative_Commons-9c9c9c?style=flat-square)

**No account. No ads. No subscriptions. No trackers. Just films.**

</div>

---

## 📲 Install in 30 seconds

| You want… | Do this |
| :--- | :--- |
| **Android app** | **[Download `ZeeFlix-latest.apk`](https://github.com/flixybuild-lgtm/ZeeFlix/releases/latest/download/ZeeFlix-latest.apk)** → open it → allow *install unknown apps* → Install. <br><sub>Android 7.0+ · 45 MB · arm64 + armv7</sub> |
| **Nothing to install** | **[Open the web app](https://flixybuild-lgtm.github.io/ZeeFlix/)** — works in Chrome, Safari, Firefox, Edge. |
| **Home-screen app** | Open the web app → browser menu → **Add to Home screen**. |
| **Full walkthrough** | **[Install guide with screenshots, FAQ & checksums](https://flixybuild-lgtm.github.io/ZeeFlix/install.html)** |
| **Own domain** | **[Free `.dpdns.org` domain guide](docs/FREE_DOMAIN_SETUP.md)** — DigitalPlat FreeDomain → Cloudflare → GitHub Pages |

> **Verify your download:** every release publishes `SHA256SUMS.txt` next to the APK. Only install builds from this repository's own [Releases](https://github.com/flixybuild-lgtm/ZeeFlix/releases) page.

---

## Play your own provider link

Choose **Enter provider HTTPS** on Home. Paste an authorized HTTPS media URL, check the permission box and save it. The suggested display title is **Zenda-Cross**; change it for other providers. A name alone does not route playback, and a Vega plugin repository is not a video URL.

Auto detects WebM, HLS, DASH and supported official embeds; other URLs use direct playback. Choose the format yourself if the link has no file extension. On Android choose **Save & Watch**; on the web select **Watch →** beside the saved provider. Saved sources can be tested, disabled, edited or removed under Providers.

<img src="docs/screenshots/provider-entry-mobile.png" alt="Framewave HTTPS provider entry on the mobile web app" width="310">

## ▶️ See it move

<div align="center">
<img src="docs/marketing/demo.gif" alt="Framewave app tour: home spotlight, player controls, film details, providers and downloads" width="320">
</div>

<sub>Ten seconds through the real app — captured with the same harness that produces every screenshot below.</sub>

---

## ✨ Why it feels different

<div align="center">
<img src="docs/marketing/social-card.png" alt="Framewave desktop and mobile UI" width="100%">
</div>

- **A real app, not a template.** Kotlin + Jetpack + **AndroidX Media3 ExoPlayer** on Android; **Rust compiled to WebAssembly** on the web. Same catalogue, same design language, two engines.
- **Screening-room UI** with a mint signal mark, custom poster art and the Anton / Manrope / Bebas Neue type system. Light enough to load instantly, dense enough to feel like a paid product.
- **Plays almost anything.** MP4, WebM, HLS and DASH with real quality switching, subtitle tracks, audio tracks, `0.5×–2×` speed, ±10 s double-tap seeking, Picture-in-Picture and resume-where-you-left-off.
- **Your own sources.** Add a direct video link, an HLS/DASH manifest or an official embed you are allowed to use, test the connection, then press play. Nothing is scraped, proxied or decrypted.
- **Offline when permitted.** Authorized progressive files download through the Android `DownloadManager` with pause/resume; the web app streams with resumable byte ranges.
- **Private by architecture.** No login, no analytics SDK, no ad network. Lists, favorites, watch positions and provider links live on your device.

---

## 📸 Screenshots

<div align="center">

### Mobile

| Home & spotlight | Player controls | Providers |
| :---: | :---: | :---: |
| <img src="docs/screenshots/home-mobile.png" width="230" alt="Framewave mobile home with Tears of Steel spotlight"> | <img src="docs/screenshots/player-mobile.png" width="230" alt="Framewave mobile player with quality and subtitle controls"> | <img src="docs/screenshots/providers-mobile.png" width="230" alt="Framewave provider manager on mobile"> |
| **Title details** | **Instant search** | **Downloads** |
| <img src="docs/screenshots/detail-mobile.png" width="230" alt="Framewave film detail page"> | <img src="docs/screenshots/search-mobile.png" width="230" alt="Framewave search with genre filters"> | <img src="docs/screenshots/downloads-mobile.png" width="230" alt="Framewave downloads screen"> |

### Desktop

| Home & spotlight carousel | Custom HTML5 / Media3 player |
| :---: | :---: |
| <img src="docs/screenshots/home-desktop.png" alt="Framewave desktop home page"> | <img src="docs/screenshots/player-desktop.png" alt="Framewave desktop player"> |

| Add & test media providers | Instant search & filters |
| :---: | :---: |
| <img src="docs/screenshots/providers-desktop.png" alt="Framewave provider manager"> | <img src="docs/screenshots/search-desktop.png" alt="Framewave search page"> |

| Film details | About Framewave |
| :---: | :---: |
| <img src="docs/screenshots/detail-desktop.png" alt="Framewave film detail page"> | <img src="docs/screenshots/about-desktop.png" alt="About Framewave page"> |

</div>

<sub>Screenshots are captured from the real running app by [`scripts/screenshots.mjs`](scripts/screenshots.mjs) — nothing here is a mockup.</sub>

---

## 🎬 What's inside

Twelve hand-picked films from the **Blender open-movie collection**, playable instantly with subtitles and credits retained:

`Sintel` · `Tears of Steel` · `Big Buck Bunny` · `Spring` · `Cosmos Laundromat` · `Charge` · `Agent 327` · `Sprite Fright` · `Caminandes: Gran Dillama` · `Caminandes: Llamigos` · `The Making of Sintel`

All films are published under Creative Commons licences by the Blender Foundation. Rights stay with their creators — see **[credits & attributions](https://flixybuild-lgtm.github.io/ZeeFlix/credits.html)**.

---

## 🛠️ Build it yourself

### Web — Rust + WebAssembly

```bash
npm ci --ignore-scripts
npm run build          # cargo → wasm, pre-render, bundle, service worker
npm start              # preview on http://0.0.0.0:4173
npm run test:web       # unit tests (sources, downloads, player helpers)
npm run test:browser   # Playwright end-to-end suite
```

### Android — Kotlin + Media3

```bash
cd android
gradle testDebugUnitTest assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Or skip the toolchain entirely: **Actions → “Publish Framewave APK & Screenshots” → Run workflow.** CI builds the APK, captures fresh screenshots, renders the marketing images and attaches everything to a GitHub Release.

---

## 🗺️ Architecture

```
src/                  Rust core  (catalogue, search, library, rendering) → WASM
public/               Hand-written UI: app.js, player.js, sources.js, downloads.js, CSS
templates/            Pre-rendered shell (SEO-friendly, no client-side router flash)
android/              Kotlin app: Splash → Main → Detail → Player (Media3 ExoPlayer)
scripts/              build.py · serve.py · screenshots.mjs · make_marketing.py · make_qr.py
docs/                 Screenshots, marketing assets, audit & performance reports
.github/workflows/    CI: Pages deploy · APK build · release publisher
```

The Rust boundary is deliberately tiny: the UI sends line-based commands (`page`, `hero`, `feed`, `results`, `detail`, `player`, `provider`, `dump`) and receives HTML or state strings back. That keeps the domain logic testable in plain `cargo test` while the DOM layer stays dumb and fast.

---

## 🤝 Contributing

Issues and pull requests are welcome — especially device reports (tell me your phone model and Android version), accessibility fixes and translations.

1. **Star the repo** ⭐ — it genuinely helps a student project get discovered.
2. **Report a bug** → [open an issue](https://github.com/flixybuild-lgtm/ZeeFlix/issues)
3. **Licence** → code is [MIT](LICENSE); films keep their Creative Commons licences.
4. **Read the audit** → [Android app audit](docs/ANDROID_APP_AUDIT.md) · [test & performance report](docs/TEST_AND_PERFORMANCE_REPORT.md) · [domain & deployment notes](docs/DOMAIN_AND_DEPLOYMENT_REPORT.md)

---

## 👤 The builder

<div align="center">

**Zeeshan Haider** — 9th Class
Government High School No. 1
Teacher: **Waqas Ashraf**

*“I wanted a streaming app that felt expensive but stayed free and private. So I built one.”*

</div>

---

<div align="center">

### ⭐ If Framewave made you smile, star it — that's the whole marketing budget.

<sub>Framewave is an independent student project. It is not affiliated with Google, the Play Store, Blender, or any film studio. Included films remain under their original Creative Commons licences; downloading a film is not a grant of new distribution rights.</sub>

</div>
