# ZeeFlix — Student Pack Domain & GitHub Deployment Report

Date: 2026-11-18

## 1. GitHub Student Developer Pack Domain Evaluation

Investigation conducted across official GitHub Education documentation (`education.github.com/pack`, `github.com/education/students`, `docs.github.com/en/education`) and the three domain registrar offers currently included in the Pack:

| Partner | Offer | Free Period | Standard Renewal (Verify at Checkout) | Preferred ZeeFlix Availability Checks | GitHub Pages DNS Compatibility |
| --- | --- | --- | --- | --- | --- |
| **Name.com** (`name.com/partner/github-students`) | 1 standard first-year domain across 15+ extensions (`.live`, `.studio`, `.app`, `.dev`, `.tech`) | 1 year ($0 if standard) | `.dev`: $22.99/yr listed on `name.com/domains/dev` (retail promo $14.99 / reg $19.99); `.live`/`.studio`/`.app` vary dynamically | `zeeflix.live`, `zeeflix.studio`, `zeeflix.dev`: RDAP 404 (not registered). `zeeflix.app`: **taken** (expires 2026-12-28). | Full DNS (`A` / `CNAME` records supported) |
| **Namecheap** (`nc.me/landing/github`) | 1-year `.me` registration + 1-year SSL | 1 year ($0 if standard; auto-renews unless canceled) | Localized €23.98/yr listed on Namecheap `.me` pricing | `zeeflix.me`: `rdap.org` lacks `.me` bootstrap; Google DNS `NS` returned `NXDOMAIN`; `rdap.identitydigital.services` returned 404. Must be verified inside `nc.me` portal. | Full DNS (`A` / `CNAME` records supported) |
| **.TECH** (`get.tech/github-student-developer-pack`) | 1-year standard `.tech` registration | 1 year ($0 if standard) | $49/yr standard renewal before promos (`get.tech/tech-domain`) | `zeeflix.tech`: Radix RDAP (`rdap.org/domain/zeeflix.tech`) explicitly returned 404 `"Domain zeeflix.tech is available for registration"`. | Full DNS (`A` / `CNAME` records supported) |

**Selection Summary:**
- **Best genuinely free candidates:** `zeeflix.me` (if confirmed available and standard $0 inside Namecheap's `nc.me` Student Pack portal, with auto-renew disabled) or `zeeflix.tech` / `zeeflix.live` / `zeeflix.studio` (if confirmed standard $0 in Name.com or .TECH Student Pack checkout).
- **Important constraint:** Registry 404 checks cannot confirm whether a registrar treats a domain as "standard" ($0) vs. "premium" at checkout. No domain was registered or paid for, and no `CNAME` file was added to `dist/`.
- **Free Fallback:** GitHub Pages project URL (`https://flixybuild-lgtm.github.io/ZeeFlix/` or `.../zeeflix/` if renamed). All assets and routes in ZeeFlix use relative paths and work identically at a subpath or a custom domain root.

## 2. Deployment Status

- **Repository:** `https://github.com/flixybuild-lgtm/ZeeFlix` (public).
- **GitHub Actions Workflow:** `.github/workflows/ci-pages.yml` builds and tests the static site, keeps a downloadable `Framewave-static-site` artifact, and deploys `dist/` with `actions/deploy-pages@v4` when Pages is configured.
- **Live URL check (2026-11-19):** `https://flixybuild-lgtm.github.io/ZeeFlix/` returned GitHub's standard Pages **404**. The repository Pages API returned 404 (site not configured). Creating the Pages site via the connected GitHub integration was denied with `403 Resource not accessible by integration`; no repository setting was changed.
- **Local preview:** `npm run dev` serves the built site on `0.0.0.0:4173`, including the `/ZeeFlix/` path.

## 3. Remaining External Actions Required from Owner

1. **Enable GitHub Pages (required to fix the public 404):**
   - Open `https://github.com/flixybuild-lgtm/ZeeFlix/settings/pages` while signed into an account with repository admin access.
   - Under **Build and deployment**, select **GitHub Actions** as the source, then rerun the **Build, Test, and Deploy ZeeFlix** workflow (or merge this active branch so the `main` workflow runs).
   - Wait for the deployment job to complete, then open `https://flixybuild-lgtm.github.io/ZeeFlix/`. Until Pages is enabled and deployed, GitHub itself serves the 404 page; an app-side code change cannot replace that response.

2. **GitHub Student Developer Pack Verification & Domain Claim (Optional $0 Custom Domain):**
   - Apply at `https://github.com/settings/education/benefits` using legitimate school-issued documentation for **Zeeshan Haider** (**9th Class**, **Government High School No. 1**) such as a dated student ID, class schedule, transcript, or official enrollment letter.
   - If your school does not issue student email addresses and GitHub requests one, submit an official school webpage or signed school letterhead statement explaining that policy, per GitHub Education docs (`docs.github.com/en/education`).
   - Once approved, visit **Namecheap (`nc.me/landing/github`)** for `zeeflix.me` or **Name.com (`name.com/partner/github-students`)** / **.TECH (`get.tech/github-student-developer-pack`)** for `zeeflix.tech` / `zeeflix.live` / `zeeflix.studio`, confirm the checkout total is **$0.00** (do not pay or enroll in unwanted paid renewals), and disable auto-renew if you do not plan to pay the renewal fee after Year 1.
   - Point DNS (`A` records to GitHub Pages IPs `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, or `CNAME` to `flixybuild-lgtm.github.io`), enter the custom domain in **Settings → Pages**, and enable **Enforce HTTPS**.
