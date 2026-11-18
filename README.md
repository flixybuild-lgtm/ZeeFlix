# ZeeFlix — Entertainment Without Limits.

A lightweight, Rust-first streaming platform built with WebAssembly, HTML5 video, and a translucent Liquid Glass interface with ZeeFlix's original seven-colour identity.

- **Creator:** Zeeshan Haider (9th Class, Government High School No. 1)
- **Teacher:** Waqas Ashraf

## Architecture

- **Rust + WebAssembly (`src/model.rs`, `src/view.rs`, `src/pages.rs`, `src/wasm.rs`):** Owns the catalogue, search/filter engine, collections, provider validation, bounded local persistence (`v1` state format), and HTML view rendering compiled to a zero-dependency ~204 KB `.wasm` module.
- **Static Pre-renderer (`src/bin/site.rs`, `templates/index.html`):** Pre-renders the initial Home route into `dist/index.html` with local WOFF2 fonts and base-relative paths so it deploys cleanly on any subpath (e.g., `/ZeeFlix/` or `/zeeflix/`) or custom domain root (`/`).
- **Minimal Browser Host (`public/app.js`, `public/player.js`, `public/sources.js`, `public/downloads.js`):** Handles WebAssembly loading, `localStorage` persistence, custom HTML5 video controls, on-demand `hls.js`/`dash.js` loading, real provider connection probing, and authorized HTTP Range-resumable downloads.

## Local Development & Verification

```bash
# Rust checks & unit/integration tests
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --locked

# Web module unit tests & production static build (outputs to dist/)
npm ci --ignore-scripts
npm run test:web
npm run build

# End-to-end Playwright browser suite (with system/local Chromium)
npm run test:browser

# Local preview server (supports HTTP 206 byte ranges)
npm start
```

## Reports & Deployment Docs

- [Automated Test & Performance Report](docs/TEST_AND_PERFORMANCE_REPORT.md)
- [GitHub Student Pack Domain & Deployment Status](docs/DOMAIN_AND_DEPLOYMENT_REPORT.md)
- [Film Credits & Attributions](public/credits.html)
