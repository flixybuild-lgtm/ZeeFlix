# ZeeFlix — Launch Kit

Copy-paste launch material. Every image referenced here already exists in
[`docs/marketing/`](marketing/) and is generated from real screenshots.

- **Web app:** https://flixybuild-lgtm.github.io/ZeeFlix/
- **Install page:** https://flixybuild-lgtm.github.io/ZeeFlix/install.html
- **APK (stable link):** https://github.com/flixybuild-lgtm/ZeeFlix/releases/latest/download/ZeeFlix-latest.apk
- **Repo:** https://github.com/flixybuild-lgtm/ZeeFlix

> ⚠️ **Before you post anything:** the repository must be **public** and the
> **Publish ZeeFlix APK & Screenshots** workflow must have run once, otherwise the
> APK link 404s and the Pages site shows "There isn't a GitHub Pages site here".

---

## 1. Repository settings (do this first — 3 minutes)

| Setting | Value |
| :--- | :--- |
| Visibility | **Public** (Settings → General → Danger Zone → Change visibility) |
| Description | `Free open-cinema streaming for Android + web · Rust/WASM · Kotlin/Media3 · no ads, no tracking · built by a 9th-grade student` |
| Website | `https://flixybuild-lgtm.github.io/ZeeFlix/` |
| Topics | `android` `kotlin` `rust` `wasm` `webassembly` `streaming` `exoplayer` `media3` `pwa` `open-source` `student-project` `video-player` `hls` `dash` `creative-commons` |
| Social preview | Settings → General → Social preview → upload `docs/marketing/social-card.png` |
| Pages | Settings → Pages → Source: **GitHub Actions** |
| Licence | MIT is already committed (`LICENSE`). Films keep their CC licences. |
| Custom domain | Optional: [FREE_DOMAIN_SETUP.md](FREE_DOMAIN_SETUP.md) (DigitalPlat `.dpdns.org` → Cloudflare → Pages) |
| Actions | Actions → *Publish ZeeFlix APK & Screenshots* → **Run workflow** (creates the `v1.0.0` release + APK) |

Then check: `install.html` loads, the download button works, and the QR code scans.

---

## 2. Show HN

**Title**
```
Show HN: ZeeFlix – a streaming app I built in 9th grade (Rust/WASM + Kotlin)
```

**URL:** `https://github.com/flixybuild-lgtm/ZeeFlix`

**First comment (post immediately after submitting):**
```
Hi HN! I'm Zeeshan, 15, in 9th class at Government High School No. 1.

ZeeFlix started because I wanted a streaming app that felt like Netflix but I had
no money, no cloud and no team. So I built the whole thing myself:

• Android app: Kotlin + AndroidX Media3/ExoPlayer (PiP, quality switching,
  subtitles, downloads). It's a real 45 MB APK you can sideload.
• Web app: a Rust core compiled to WebAssembly (~201 KiB) that does catalogue,
  search, library and HTML rendering. The DOM layer is plain JS, no framework.
• The films are legal: 12 Creative Commons open movies from Blender (Sintel,
  Tears of Steel, Big Buck Bunny, Spring, Cosmos Laundromat...).
• No accounts, no analytics, no ad SDK. The APK requests only INTERNET and
  ACCESS_NETWORK_STATE.

You can also add your own provider URL (a video you own, an HLS/DASH manifest or
an official embed) and it tests the connection before playing.

Things I'm proud of: the seven-colour "liquid glass" UI is hand-written CSS, and
the player remembers where I stopped.

Things I know are rough: the APK is debug-signed, there's no iOS build, and the
catalogue is small because I only use films I'm allowed to stream.

I'd love feedback on the Rust↔JS boundary — it's a string command protocol
because I'm not good enough at wasm-bindgen yet. Thanks for looking!
```

**Reply material**
- *"Why not React?"* → The home page is pre-rendered HTML from Rust so there is no loading flash and it works without JS for browsing; JS only takes over interactions.
- *"Is this legal?"* → All films are CC-BY from Blender; the provider feature is for content you own or are licensed to stream. Nothing is scraped, proxied or DRM-broken.
- *"45 MB is big."* → Most of it is the bundled Sintel film + Media3; the web app core is 201 KiB.

---

## 3. Reddit

### r/AndroidApps

**Title:** `ZeeFlix — I built a free streaming app in 9th grade. No ads, no account, no trackers. 45 MB APK.`

**Body:**
```
Hey r/AndroidApps 👋

I'm 15 and this is ZeeFlix, my first real Android app. It's a small cinema for
open-licensed films, and I built the whole thing myself.

Why you might like it
• No login, no ads, no analytics SDK, no subscription. Ever.
• Material 3 "liquid glass" UI with a custom 7-colour prism identity.
• Media3/ExoPlayer: MP4, WebM, HLS, DASH. Quality switcher, subtitles, audio
  tracks, speed 0.5×–2×, double-tap ±10 s, PiP, resume.
• Authorized downloads via DownloadManager.
• Add your own source (direct link / HLS / DASH / official embed) and test it
  before playing.
• Only 2 permissions: INTERNET + ACCESS_NETWORK_STATE.

The films are Creative Commons open movies from the Blender Foundation
(Sintel, Tears of Steel, Big Buck Bunny, Spring...), so everything is legal.

Download (APK, Android 7+): https://github.com/flixybuild-lgtm/ZeeFlix/releases/latest/download/ZeeFlix-latest.apk
Install guide + screenshots: https://flixybuild-lgtm.github.io/ZeeFlix/install.html
Source: https://github.com/flixybuild-lgtm/ZeeFlix

It's debug-signed because I can't pay the $25 Play Store fee yet. I'd genuinely
love feedback — especially bugs on your specific phone (please tell me the model
and Android version). If you like it, a ⭐ on GitHub helps a lot.
```

### r/opensource

**Title:** `I'm 15 and I built a streaming platform: Rust→WASM web app + Kotlin Android app, no ads, no tracking`

**Body:** use the Show HN first comment, lead with the architecture diagram section of the README, and link `docs/ANDROID_APP_AUDIT.md` + `docs/TEST_AND_PERFORMANCE_REPORT.md`. Open-source audiences reward *evidence* — mention the TDD unit tests, the Playwright suite and the CI that verifies APK signature/alignment.

### r/webdev

**Title:** `A streaming UI in plain CSS + a 201 KiB Rust/WASM core — no React, no Tailwind`

Focus on: pre-rendered HTML from Rust, the seven-colour liquid-glass tokens, the byte-range download queue, the service worker that refuses to cache media, and the ~201 KiB core size claim.

### r/rust

**Title:** `My 201 KiB Rust→WASM core for a streaming app (catalogue, search, library, HTML rendering)`

Ask specifically: *how would you replace my string command protocol with a typed wasm-bindgen boundary without bloating the binary?*

---

## 4. X / Twitter thread

```
1/ I'm 15 and I built a streaming app. From scratch.

Rust → WebAssembly on the web. Kotlin + Media3 on Android.
Free, no ads, no accounts, no trackers.

Here's how it works 🧵
```

```
2/ The web core is Rust compiled to WASM — 201 KiB. It owns the catalogue,
search, library and even the HTML rendering, so the home page is pre-rendered
with zero loading flash.

The UI? Hand-written CSS. No Tailwind, no React.
```

```
3/ The Android app is real Kotlin: ExoPlayer (Media3), PiP, quality switching,
subtitles, audio tracks, 0.5×–2× speed, double-tap ±10s seek, resume, and
authorized downloads.

45 MB APK. Two permissions: INTERNET + network state. That's it.
```

```
4/ Everything streamed is legal: 12 Creative Commons films from Blender —
Sintel, Tears of Steel, Big Buck Bunny, Spring, Cosmos Laundromat.

You can also plug in your own video / HLS / DASH source and it tests the
connection before playing.
```

```
5/ The UI is a "liquid glass" system with a seven-colour prism mark. Posters,
splash, player — all designed and coded by me in 9th class.
```

```
6/ Try it (Android 7+, free):

📱 APK → [link]
🌐 Web → [link]
⭐ Source → [link]

No ads. No subscription. If it makes you smile, star the repo — that's my
entire marketing budget. 🙏
```

**Post image:** `docs/marketing/social-card.png` (first tweet), then one screenshot per tweet.

---

## 5. LinkedIn (teachers, school, family network — surprisingly high reach)

```
I'm 15 and I just shipped my first real product.

ZeeFlix is a streaming app — the kind of thing you normally need a team for.
I built the Android app in Kotlin with AndroidX Media3, and the web version with
a Rust core compiled to WebAssembly.

It's completely free: no ads, no accounts, no tracking. The films are legal
open-licensed movies from the Blender Foundation.

What I actually learned:
→ How to design a UI system (seven-colour "liquid glass") instead of copying one
→ How a video player really works: buffering, byte ranges, HLS/DASH manifests
→ How to ship: CI builds the APK, tests it, signs and verifies it, and publishes it
→ How to say "this is debug-signed and has no iOS build" and still be proud of it

Thank you to my teacher Waqas Ashraf at Government High School No. 1 for pushing
me to finish it, and to everyone who tests it on their phone.

📱 Download: [link]
🌐 Try in your browser: [link]

#Android #Kotlin #Rust #WebAssembly #OpenSource #StudentDeveloper
```

---

## 6. WhatsApp / friend message (the one that actually spreads in school)

```
Bhai I finally finished my app 😭🔥

ZeeFlix — Netflix jaisa UI, par FREE. No ads, no login, kuch bhi nahi.
Sideload karo, chalega.
👉 [APK link]

Web version bhi hai, browser mein kholo: [web link]

Test karke batao, kis phone pe kya issue aata hai. Aur GitHub pe ⭐ de dena 🙏
```

---

## 7. Product Hunt (optional, needs a weekday launch)

- **Name:** ZeeFlix
- **Tagline:** `A student-built streaming app with zero ads, zero accounts, zero tracking.`
- **Topics:** Android, Open Source, Developer Tools, Design Tools(?), Streaming
- **Gallery (order):** `social-card.png`, `store-home-mobile.png`, `store-player-mobile.png`, `store-providers-mobile.png`, `feature-banner.png`
- **First comment:** the Show HN comment, plus "It's free and open source — star it if you want more features."

---

## 8. Where else to post (in order of payoff)

| Place | Why it works | Notes |
| :--- | :--- | :--- |
| r/AndroidApps | highest intent-to-install | Read their self-promo rules; post on a weekday morning UTC |
| Hacker News (Show HN) | one front page = thousands of stars | Post Tue–Thu, 13:00–15:00 UTC; reply to every comment fast |
| X + LinkedIn | your real network | LinkedIn reaches teachers/parents, X reaches devs |
| r/opensource, r/rust, r/webdev | technical credibility | tailor the post to each sub's rules |
| Discord: Rust, Kotlin, Android dev servers | friendly technical feedback | use the `#showcase` channel, not DMs |
| Dev.to / Hashnode | SEO for years | repost the architecture write-up |
| Product Hunt | burst of traffic | only after the repo is public and the APK link works |
| Awesome-Android lists | long-tail | you need a licence file first (see §10) |

---

## 9. What actually makes a project spread

1. **One link that instantly works.** The APK download and the web app must both work before you post. A 404 kills a launch.
2. **A GIF.** Record the player with PiP + speed + subtitle switching (10 s, < 5 MB). Static screenshots convert far worse.
3. **Show the person, not just the product.** "15-year-old, 9th class, no budget" is the story. Put it in the first two lines.
4. **Ask for something specific.** "Tell me your phone model if it crashes" gets replies. "Feedback welcome" doesn't.
5. **Reply to everyone in the first 3 hours.** Early comment velocity is what algorithms measure.
6. **Never argue about the debug signature or iOS.** Say "known limitation, on the roadmap" and move on.
7. **Ship a visible update within a week.** People who saw the launch post should see "v1.0.1 — fixed the bug YOU reported".

---

## 10. Before a big push — remaining owner actions

- **`LICENSE` is now committed (MIT).** That unblocks "awesome list" submissions and makes companies comfortable.
- **`docs/marketing/demo.gif` is generated** (`npm run demo`) from the real screenshots — attach it to the first tweet/Reddit post, not the static card.
- **Still needs you, in a browser:** make the repo public, enable Pages, run the publish workflow once. See §1.
- **Optional but high value:** the free custom domain in [FREE_DOMAIN_SETUP.md](FREE_DOMAIN_SETUP.md).

> A 10-second screen recording on a real phone still beats any generated asset.
> Record the player with PiP + subtitle + speed switching and post it natively
> (X and Reddit both boost native video over links).

## 11. Assets cheat-sheet

| File | Use |
| :--- | :--- |
| `docs/marketing/social-card.png` | GitHub social preview, OG image, first tweet |
| `docs/marketing/feature-banner.png` | HN/Reddit header, blog hero, LinkedIn |
| `docs/marketing/readme-hero.png` | README top strip |
| `docs/marketing/screenshot-sheet.png` | one-image overview for articles |
| `docs/marketing/store-*.png` | 9:16 store-style panels for phone-first posts |
| `docs/marketing/demo.gif` | 10-second app tour — best first-tweet / Reddit attachment |
| `docs/screenshots/*-mobile.png` | real device-width captures |
| `docs/screenshots/*-desktop.png` | real desktop captures |
