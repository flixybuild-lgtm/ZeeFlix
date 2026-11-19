# Use Zenda-Cross in Framewave

[Zenda-Cross/vega-providers](https://github.com/Zenda-Cross/vega-providers) publishes a Vega extension index and JavaScript modules. This is not a streaming endpoint and cannot be pasted into the direct media form. Framewave does not bundle the Vega app, install provider modules, or run downloaded JavaScript from extension repositories. The web extension index is a read-only view of the upstream manifest.

## Set up the connection

1. If you do not already have a bridge, see the [Vega Streams add-on’s self-hosting guide](https://github.com/Ashishsri2018/vega-stremio-addon#quick-start). This is a separate third-party service, not included in Framewave or its APK. Review what it runs before self-hosting: the add-on downloads and executes upstream provider JavaScript on its server. Only connect to a bridge you run or trust, and only enable sources you have permission to use.
2. Give the service a reachable **HTTPS** address with a valid certificate. Open the manifest at `https://your-bridge.example/manifest.json`. A configured prefix such as `https://your-bridge.example/config/manifest.json` also works. For web playback the bridge must allow your app’s web origin via CORS on the manifest and stream endpoints; HLS/DASH media servers must allow the necessary browser media requests too.
3. In Framewave, open **Providers → Zenda-Cross · Vega bridge**, paste that URL and select **Connect bridge**. Do not paste the GitHub repo link here. A saved connection is local to this device, and can be removed with **Disconnect**.
4. Enter an IMDb movie ID or an episode ID in `tt…:season:episode` format, confirm you are allowed to watch the media, and select **Find streams → Watch**. Framewave sends the ID to your bridge and loads the selected media URL. Bridge results and their media URLs are not saved to your watch history or library.

## Compatibility and limits

- The compatible endpoint advertises `community.vega.stremio`, the `stream` resource, and `movie` and `series` types. Lookups use `/stream/movie/<imdb-id>.json` or `/stream/series/<imdb-id>:<season>:<episode>.json` under the same manifest directory.
- This is a stream lookup integration, not a full Vega clone. It does not provide catalog browsing by title, native extension installation, private repo access, DRM, torrent playback, external web pages, arbitrary provider request headers, or downloads. Results need a playable HTTPS link (MP4/WebM, HLS `.m3u8` or DASH `.mpd` subject to device codec support).
- If no compatible streams are returned, check that the bridge is healthy and serving direct HTTPS links for authorized media. `Enter provider HTTPS` remains available for a standalone media URL.
- Browser tests use a mock compatible endpoint and included open film. They do not verify any third-party production stream.
