# Free custom domain for ZeeFlix — DigitalPlat FreeDomain

You asked for a **free domain from DigitalPlat (DigitalPlatDev/FreeDomain)**.
This is how to point one at ZeeFlix's GitHub Pages site in about 15 minutes.

> **Important:** this step has to be done by you, once, in a browser. It needs a
> DigitalPlat account (sign-in with GitHub), and it must be your account so the
> domain is yours to keep. Nothing here is automated on purpose — a domain is
> the one thing that should never be scripted.

---

## 1. Claim the domain (5 min)

1. Open **https://dash.domain.digitalplat.org/** and sign in with GitHub
   (the account that owns this repository).
2. Star **[DigitalPlatDev/FreeDomain](https://github.com/DigitalPlatDev/FreeDomain)** —
   they credit one extra domain slot for stars.
3. **Register a new domain.** Available extensions:

   | Extension | Notes |
   | :--- | :--- |
   | `.dpdns.org` | easiest, no key needed |
   | `.qzz.io` | short and clean |
   | `.us.kg` | may require a registration key |
   | `.xx.kg` | may require a registration key |
   | `.qd.je` | newer, lower availability |

   Suggested names: `zeeflix.dpdns.org`, `zeeflix.qzz.io`, `watchzeeflix.dpdns.org`.
4. Submit the request and wait for **Approved** in the dashboard
   (usually minutes; can take longer when they are reviewing volume).

---

## 2. Point it at ZeeFlix (5 min)

GitHub Pages does **not** host DNS, and DigitalPlat does not either — you pick a
free DNS host. **Cloudflare** is the easiest (free plan, free TLS).

### 2a. Add the site in Cloudflare
1. Create a free account at **https://dash.cloudflare.com/** → **Add a site**.
2. Enter your new domain, choose the **Free** plan.
3. Cloudflare shows two nameservers, e.g. `ada.ns.cloudflare.com`,
   `bob.ns.cloudflare.com`. Copy them.

### 2b. Give those nameservers to DigitalPlat
1. Back in **dash.domain.digitalplat.org** → your domain → **Nameservers**.
2. Replace the defaults with the two Cloudflare nameservers → **Save**.
3. Wait for propagation (5–30 min). Cloudflare emails you when the zone is active.

### 2c. Add the DNS records in Cloudflare
In **DNS → Records**, add:

| Type | Name | Content | Proxy |
| :--- | :--- | :--- | :--- |
| `A` | `@` | `185.199.108.153` | DNS only (grey) |
| `A` | `@` | `185.199.109.153` | DNS only (grey) |
| `A` | `@` | `185.199.110.153` | DNS only (grey) |
| `A` | `@` | `185.199.111.153` | DNS only (grey) |
| `CNAME` | `www` | `flixybuild-lgtm.github.io` | DNS only (grey) |

> **Keep them grey (DNS only).** GitHub needs to issue its own HTTPS certificate;
> Cloudflare's orange-cloud proxy interferes with that. You can turn the proxy on
> later if you also set SSL mode to **Full (strict)**.

---

## 3. Attach the domain to the repository (3 min)

These steps need the repository to be **public** and **Pages enabled**
(see `docs/LAUNCH_KIT.md` §1).

1. Repo → **Settings → Pages**
2. **Custom domain** → type `zeeflix.dpdns.org` → **Save**
   (this writes a `CNAME` file to the `gh-pages`/artifact deploy)
3. Wait for the DNS check to pass, then tick **Enforce HTTPS**.

Then verify:

```bash
curl -sI https://zeeflix.dpdns.org/ | head -3        # 200 OK
curl -s  https://zeeflix.dpdns.org/install.html | grep -c "ZeeFlix-latest.apk"
```

---

## 4. Update the project to use it

Everything in ZeeFlix uses **relative paths**, so the site works at
`https://flixybuild-lgtm.github.io/ZeeFlix/` *and* at a domain root with no code
changes. Four places mention the old URL and should be updated:

```bash
# 1. the QR code on the install page
python3 scripts/make_qr.py https://zeeflix.dpdns.org/install.html

# 2. README + install page links
grep -rl "flixybuild-lgtm.github.io/ZeeFlix" README.md public/install.html docs/LAUNCH_KIT.md \
  | xargs sed -i 's|https://flixybuild-lgtm.github.io/ZeeFlix|https://zeeflix.dpdns.org|g'
```

3. **GitHub repo settings → Website** → `https://zeeflix.dpdns.org/`
4. **Social preview / OG image** in `public/install.html` (`og:image`) — make it
   absolute against the new domain.

Commit, let Pages redeploy, and confirm the APK button and QR code both resolve.

---

## 5. Honest caveats about free domains

| Caveat | What it means for ZeeFlix |
| :--- | :--- |
| **Not `.com`** | `.dpdns.org` and friends are real delegations, but some school/corporate networks block unknown TLDs. Keep the `github.io` URL working as a fallback. |
| **Manual renewal** | Free, but you must renew before expiry. Set a calendar reminder 30 days before. |
| **Shared reputation** | Abuse on the service can affect the whole TLD's spam reputation. Fine for a portfolio project; don't use it for email. |
| **No SLA** | Run by a non-profit with volunteers. Never make it your only copy — the repo is the source of truth. |
| **Cloudflare proxy + GitHub** | The single most common failure. DNS-only (grey cloud) until HTTPS is issued. |

---

## 6. Alternative if DigitalPlat is out of slots

- **Name.com / Namecheap / .TECH** via the **GitHub Student Developer Pack** —
  free first year for verified students, and your school details qualify.
  See `docs/DOMAIN_AND_DEPLOYMENT_REPORT.md` for the exact steps.
- **`is-a.dev`** or **`js.org`** — free subdomains claimed by a pull request;
  good fit for a JavaScript project like this one.

---

## 7. Checklist

- [ ] Domain approved in the DigitalPlat dashboard
- [ ] Cloudflare zone active, nameservers swapped at DigitalPlat
- [ ] Four `A` records + `www` CNAME, all **DNS only**
- [ ] Repository public, Pages enabled
- [ ] Custom domain saved in Settings → Pages, HTTPS enforced
- [ ] `python3 scripts/make_qr.py https://<domain>/install.html` re-run
- [ ] Links updated in README, install page, launch kit, repo website field
- [ ] APK button, QR code and web app all verified on the new domain
- [ ] Renewal reminder set
