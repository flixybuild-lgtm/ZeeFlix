# Framewave Android app

This Android project is a Framewave-branded adaptation of [Vega](https://github.com/vega-org/vega-app), pinned to upstream commit `fb0e51110c1a55e138628828c58236aa20d3b282`. The upstream `LICENSE` and `NOTICE` are kept in this directory.

**License restriction:** the copied Vega code is under PolyForm Noncommercial 1.0.0. This subtree may be used and distributed only for noncommercial purposes under those terms. Ads, monetization, commercial products, or commercial distribution require separate permission from the Vega licensor. The upstream notice currently contains placeholder licensor/contact fields; those have not been replaced or represented as verified.

## Framewave changes

- Android app ID `com.zeeflix.app`, Framewave name, mint engraved icon and translucent surface treatment.
- Provider source is pinned in-app to `Zenda-Cross/vega-providers`; only manifest entry `value: "vega"` (VMovies) is exposed. End users do not enter source URLs or JSON.
- Android minimum SDK is API 28 because of upstream native runtime requirements.
- Mature-content preference is opt-in and filters only posts explicitly labeled adult/18+. It is not a parental control.

See [`../docs/VEGA_ANDROID_MIGRATION.md`](../docs/VEGA_ANDROID_MIGRATION.md) for migration, build and attribution notes.
