# Framewave 1.2.0

This update makes Zenda-Cross the only configurable provider in the web and Android apps. Provider setup now asks for a trusted running bridge's HTTPS `manifest.json` endpoint—not a GitHub repository or a standalone media URL. The app does not install extension code.

- **Zenda-Cross connection help:** clearer setup instructions, HTTPS manifest validation, and CORS / availability troubleshooting for web users.
- **Adult-result control:** results explicitly marked 18+ or adult are hidden by default; enable them in Settings. Provider labels are not verified, so this is not a parental lock.
- **More useful settings:** clear playback history or reset local library/preferences and the saved bridge connection.
- **Player controls:** Android adds direct ten-second back/forward buttons, alongside quality/audio/subtitle selection, speed, fullscreen, picture-in-picture, and resume playback.
- **New app icon:** custom engraved great white shark artwork with a mint signal motif, applied to web, PWA, and Android launcher icons.
- **Deployment improvements:** CI preserves a downloadable site artifact when GitHub Pages is not configured and explains why the live URL may still show a GitHub 404.

**Install:** Android 7.0+; the release workflow publishes `Framewave-v1.2.0-debug.apk` and the stable `ZeeFlix-latest.apk` alias. This is a debug-signed sideload build, not a Play Store release. Verify against `SHA256SUMS.txt`.
