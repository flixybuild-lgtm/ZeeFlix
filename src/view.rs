use crate::{normalise_base, App, Film, Filter, Sort, GENRES, SPOTLIGHT};
use std::fmt::Write;
pub fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
pub fn icon(id: &str) -> String {
    format!(
        r##"<svg class="ico" aria-hidden="true" focusable="false"><use href="icons.svg#{id}"></use></svg>"##
    )
}
pub fn genre_icon(s: &str) -> &str {
    match s {
        "Action" => "bolt",
        "Adventure" => "compass",
        "Sci-Fi" => "planet",
        "Comedy" => "smile",
        "Horror" => "ghost",
        "Romance" => "heart",
        "Fantasy" => "spark",
        "Documentary" => "film",
        "Drama" => "screen",
        _ => "grid",
    }
}
pub fn slug(s: &str) -> String {
    s.to_ascii_lowercase().replace(' ', "-")
}
pub fn head(kicker: &str, title: &str, copy: &str) -> String {
    format!(
        r#"<div class="page-head"><p class="eyebrow"><i></i>{}</p><h1>{}</h1><p class="lede">{}</p></div>"#,
        esc(kicker),
        esc(title),
        esc(copy)
    )
}
pub fn empty(ic: &str, title: &str, copy: &str, link: &str, label: &str) -> String {
    format!(
        r#"<div class="empty"><span class="empty-icon">{}</span><h2>{}</h2><p>{}</p><a class="btn subtle" href="{}">{} {}</a></div>"#,
        icon(ic),
        esc(title),
        esc(copy),
        esc(link),
        esc(label),
        icon("arrow")
    )
}
pub fn opt(value: &str, label: &str, sel: &str) -> String {
    format!(
        "<option value=\"{}\" {}>{}</option>",
        esc(value),
        if value == sel { "selected" } else { "" },
        esc(label)
    )
}
impl App {
    pub fn save_btn(&self, f: &Film, mini: bool) -> String {
        let s = self.list.contains(&f.id);
        let name = if s { "In My List" } else { "My List" };
        format!(
            r#"<button type="button" class="{} save {}" data-act="list" data-id="{}" aria-pressed="{s}" aria-label="{} {} {} My List">{}{}</button>"#,
            if mini { "tile-save" } else { "btn glass" },
            if s { "saved" } else { "" },
            esc(&f.id),
            if s { "Remove" } else { "Add" },
            esc(&f.title),
            if s { "from" } else { "to" },
            icon(if s {
                "check"
            } else if mini {
                "bookmark"
            } else {
                "plus"
            }),
            if mini {
                String::new()
            } else {
                format!("<span>{name}</span>")
            }
        )
    }
    pub fn hero(&self, num: usize) -> String {
        let all: Vec<_> = SPOTLIGHT.iter().filter_map(|s| self.find(s)).collect();
        if all.is_empty() {
            return empty(
                "film",
                "Your cinema is on standby",
                "Enable a library provider to discover a featured film.",
                "#providers",
                "Manage providers",
            );
        }
        let i = num % all.len();
        let f = &all[i];
        let still = match f.id.as_str() {
            "steel" => "steel-wide",
            "sintel" => "sintel-wide",
            "spring" => "spring-wide",
            "cosmos" => "cosmos-wide",
            _ => &f.art,
        };
        let small = if f.id == "steel" {
            "steel-small"
        } else {
            &f.art
        };
        let dots=(0..all.len()).fold(String::new(), |mut out, n| {write!(out,r#"<button class="slide-dot {}" data-act="slide" data-n="{n}" aria-label="Feature {}" aria-pressed="{}"><span></span></button>"#,if n==i{"active"}else{""},esc(&all[n].title),n==i).unwrap(); out});
        format!(
            r##"<section class="hero hero-{}" aria-label="Featured film" data-slide="{i}" data-slides="{}"><picture><source media="(max-width:640px)" srcset="art/{small}.webp"><img class="hero-art" src="art/{still}.webp" alt="" fetchpriority="high"></picture><div class="hero-vignette"></div><div class="hero-inner"><div class="spot-label">{} FRAMEWAVE SELECTS</div><h1>{}</h1><div class="hero-meta"><b class="open-film">OPEN FILM</b><span>{}</span><i></i><span>{} min</span><i></i><span>{}</span>{}</div><p class="synopsis">{}</p><div class="actions"><a class="btn gold" href="#watch/{}">{} Watch Now</a>{}</div></div><div class="hero-foot"><div class="slide-index"><b>{:02}</b><span>/</span>{:02}</div><div class="slide-dots">{dots}</div><div class="hero-arrows"><button class="circle" data-act="prev-slide" aria-label="Previous featured film">{}</button><button class="circle" data-act="next-slide" aria-label="Next featured film">{}</button></div></div></section>"##,
            esc(&f.id),
            all.len(),
            icon("spark"),
            esc(&f.title),
            f.year,
            f.minutes,
            esc(&f.genres.split(',').take(2).collect::<Vec<_>>().join(" · ")),
            if f.id == "steel" {
                "<b class=\"hd\">HD</b>"
            } else {
                ""
            },
            esc(&f.description),
            f.id,
            icon("play"),
            self.save_btn(f, false),
            i + 1,
            all.len(),
            icon("left"),
            icon("right")
        )
    }
    pub fn chips(&self, sel: &str) -> String {
        std::iter::once("All").chain(["Action","Adventure","Sci-Fi","Comedy","Horror","Romance","Documentary"]).fold(String::new(), |mut out, g| {write!(out,r#"<button class="chip {}" aria-pressed="{}" data-act="genre" data-genre="{}">{}{}</button>"#,if sel==g{"active"}else{""},sel==g,g,icon(genre_icon(g)),match g{"All"=>"All Genres","Documentary"=>"Documentaries",_=>g}).unwrap(); out})
    }
    pub fn card(&self, f: &Film, rank: Option<usize>) -> String {
        let mut mark = String::new();
        if let Some(n) = rank {
            write!(mark, "<span class=\"rank\"><small>#</small>{n}</span>").unwrap();
        }
        let progress = self
            .history
            .iter()
            .find(|h| h.id == f.id && h.unfinished())
            .map(|p| {
                format!(
                    "<span class=\"progress-line\"><i style=\"width:{}%\"></i></span>",
                    100 * u64::from(p.time) / u64::from(p.duration)
                )
            })
            .unwrap_or_default();
        let text = esc(&f.title);
        let label = match f.id.as_str() {
            "cosmos" => "Cosmos<br>Laundromat".to_string(),
            "gran-dillama" | "llamigos" => "Caminandes".into(),
            _ => text.clone(),
        };
        format!(
            r##"<article class="card"><div class="poster-wrap"><a href="#title/{}" class="poster art-{}" aria-label="Details for {text}"><img src="art/{}.webp" alt="" loading="lazy" decoding="async" width="480" height="720"><span class="poster-shade"></span>{mark}<span class="poster-type">{}</span><span class="print-title">{label}</span><span class="hover-play">{}</span>{progress}</a>{}</div><a class="card-name" href="#title/{}">{text}</a><p class="card-meta">{}<i></i>{}</p></article>"##,
            esc(&f.id),
            esc(&f.art),
            esc(&f.art),
            f.kind(),
            icon("play"),
            self.save_btn(f, true),
            esc(&f.id),
            if f.year.is_empty() {
                "Personal"
            } else {
                &f.year
            },
            esc(f.genre())
        )
    }
    pub fn grid(&self, films: &[Film], ranked: bool) -> String {
        let cards = films
            .iter()
            .enumerate()
            .map(|(n, f)| self.card(f, ranked.then_some(n + 1)))
            .collect::<String>();
        format!("<div class=\"card-grid\">{cards}</div>")
    }
    fn shelf(&self, name: &str, kicker: &str, items: &[Film], ranked: bool, route: &str) -> String {
        if items.is_empty() {
            return String::new();
        }
        let cards = items
            .iter()
            .take(8)
            .enumerate()
            .map(|(n, f)| self.card(f, ranked.then_some(n + 1)))
            .collect::<String>();
        format!(
            r##"<section class="shelf" aria-label="{}"><div class="section-head"><div><p class="overline"><i></i>{}</p><h2>{}</h2></div><a class="view-all" href="#{route}">View all {}</a></div><div class="rail">{cards}</div></section>"##,
            esc(name),
            esc(kicker),
            esc(name),
            icon("right")
        )
    }
    pub fn history_titles(&self, unfinished: bool) -> Vec<Film> {
        self.history
            .iter()
            .filter(|p| !unfinished || p.unfinished())
            .filter_map(|p| self.find(&p.id))
            .collect()
    }
    pub fn collection(&self, name: &str) -> Vec<Film> {
        let mut all = self.titles();
        match name {
            "popular-movies" => {
                all.retain(|f| f.episode == 0);
                all.sort_by_key(|f| {
                    [
                        "steel", "bunny", "sintel", "spring", "agent", "fright", "charge",
                    ]
                    .iter()
                    .position(|s| *s == f.id)
                    .unwrap_or(8)
                });
            }
            "popular-series" => all.retain(|f| f.episode > 0),
            "recently-added" => all.reverse(),
            _ => {}
        }
        all
    }
    pub fn feed(&self, genre: &str) -> String {
        if genre != "All" {
            let films = self.search(&Filter {
                genre,
                ..Filter::default()
            });
            return if films.is_empty() {
                empty(
                    "film",
                    "No titles in this genre",
                    "Try another genre or enable a provider.",
                    "#movies",
                    "Browse movies",
                )
            } else {
                format!("<section class=\"shelf\"><div class=\"section-head\"><div><p class=\"overline\"><i></i>GENRE COLLECTION</p><h2>{}</h2></div><span class=\"muted\">{} titles</span></div>{}</section>",esc(genre),films.len(),self.grid(&films,false))
            };
        }
        let mut h = self.shelf(
            "Continue Watching",
            "PICK UP WHERE YOU LEFT OFF",
            &self.history_titles(true),
            false,
            "continue",
        );
        h += &self.shelf(
            "Trending Now",
            "THE HOT LIST",
            &self.collection("trending-now"),
            true,
            "collection/trending-now",
        );
        h += &self.shelf(
            "Popular Movies",
            "THE SCREENING ROOM",
            &self.collection("popular-movies"),
            false,
            "collection/popular-movies",
        );
        h += &self.shelf(
            "Popular Series",
            "IN EPISODES",
            &self.collection("popular-series"),
            false,
            "shows",
        );
        h += &self.shelf(
            "Recently Added",
            "NEW TO THE LIBRARY",
            &self.collection("recently-added"),
            false,
            "collection/recently-added",
        );
        for (genre_key, title, kicker) in [
            ("Action", "Action", "HIGH-OCTANE"),
            ("Adventure", "Adventure", "EXPEDITIONS"),
            ("Sci-Fi", "Science Fiction", "FUTURES & WORLDS"),
            ("Horror", "Horror", "AFTER DARK"),
            ("Comedy", "Comedy", "LIGHTER MOMENTS"),
            ("Romance", "Romance", "HEARTS & STORIES"),
            ("Documentary", "Documentaries", "BEHIND THE LENS"),
        ] {
            let films = self.search(&Filter {
                genre: genre_key,
                ..Filter::default()
            });
            h += &self.shelf(
                title,
                kicker,
                &films,
                false,
                &format!("genre/{}", slug(genre_key)),
            );
        }
        h
    }
    pub fn results(&self, f: Filter) -> String {
        let r = self.search(&f);
        let suggestions = if !f.query.trim().is_empty() {
            r.iter().take(3).fold(String::new(), |mut out, m| {
                write!(
                    out,
                    r##"<a class="suggest" href="#title/{}">{} {}</a>"##,
                    m.id,
                    icon("external"),
                    esc(&m.title)
                )
                .unwrap();
                out
            })
        } else {
            String::new()
        };
        let content = if r.is_empty() {
            empty(
                "search",
                "No matches this time",
                "Try another spelling, a different genre, or clear your filters.",
                "#movies",
                "Browse movies",
            )
        } else {
            self.grid(&r, false)
        };
        let caption = match f.sort {
            Sort::Newest => " · newest first",
            Sort::Oldest => " · oldest first",
            Sort::Shortest => " · shortest first",
            Sort::Longest => " · longest first",
            Sort::Title => " · A–Z",
            Sort::Default => "",
        };
        let heading = match (f.kind, f.query.trim().is_empty()) {
            ("Movies", _) => "Movies",
            ("Documentaries", _) => "Documentaries",
            ("Series", _) => "Series",
            (_, true) => "Explore the library",
            (_, false) => "Search results",
        };
        format!("<div class=\"suggestions\">{suggestions}</div><div class=\"section-head compact\"><h2>{heading}</h2><span class=\"muted\">{} titles{caption}</span></div>{content}", r.len())
    }
    /// "More like this" rail appended to a title page.
    pub fn related_rail(&self, id: &str, limit: usize) -> String {
        let items = self.related(id, limit);
        if items.is_empty() {
            return String::new();
        }
        format!(
            r##"<section class="shelf related-shelf" aria-labelledby="related-head"><div class="section-head"><div><p class="overline"><i></i>KEEP WATCHING NEXT</p><h2 id="related-head">More like this</h2></div><a class="view-all" href="#movies">Browse all {}</a></div><div class="rail" role="list">{}</div></section>"##,
            icon("right"),
            items.iter().map(|m| self.card(m, None)).collect::<String>()
        )
    }

    /// Share sheet: native buttons are wired in app.js; these are the guaranteed
    /// fallbacks for platforms without the Web Share API.
    pub fn share_sheet(&self, id: &str, base: &str) -> String {
        let Some(film) = self.find(id) else {
            return String::new();
        };
        let link = self.share_link(id, base);
        if link.is_empty() {
            return String::new();
        }
        let targets = self
            .share_targets(id, base)
            .iter()
            .fold(String::new(), |mut out, t| {
                write!(
                    out,
                    r##"<a class="share-target" data-share="{}" href="{}" target="{}" rel="noopener noreferrer">{}</a>"##,
                    t.id,
                    esc(&t.url),
                    t.target,
                    esc(t.label)
                )
                .unwrap();
                out
            });
        format!(
            r##"<div class="share-sheet" data-share-id="{}"><p class="eyebrow"><i></i>SHARE THIS FILM</p><h2>{}</h2><div class="share-native"><button class="btn gold" data-act="share-native" data-id="{}">{} Share…</button><button class="btn subtle" data-act="copy-link" data-id="{}">{} Copy link</button><button class="btn subtle" data-act="download-poster" data-art="{}" data-id="{}">{} Save poster</button></div><div class="share-targets">{targets}</div><label class="share-field">Direct link<input type="text" readonly value="{}" aria-label="Shareable link" onclick="this.select()"></label><p class="fine">Link opens the title straight away on any device. No account needed.</p></div>"##,
            esc(id),
            esc(&film.title),
            esc(id),
            icon("link"),
            esc(id),
            icon("link"),
            esc(&film.art),
            esc(id),
            icon("download"),
            esc(&link)
        )
    }

    pub fn search_page(&self) -> String {
        let all = self.titles();
        let genres = GENRES.iter().map(|s| opt(s, s, "")).collect::<String>();
        let actors = all
            .iter()
            .flat_map(|f| f.cast.split(','))
            .filter(|s| !s.is_empty())
            .collect::<std::collections::BTreeSet<_>>()
            .iter()
            .map(|s| opt(s, s, ""))
            .collect::<String>();
        let years = all
            .iter()
            .map(|f| f.year.as_str())
            .filter(|s| !s.is_empty())
            .collect::<std::collections::BTreeSet<_>>()
            .iter()
            .rev()
            .map(|s| opt(s, s, ""))
            .collect::<String>();
        format!(
            r#"{}<div class="search-box">{}<input id="query" type="search" placeholder="Search films, genres or cast…" maxlength="100" autocomplete="off" aria-label="Search titles"></div><div class="filters"><label>Genre<select id="genre-filter"><option value="">All genres</option>{genres}</select></label><label>Actor<select id="actor-filter"><option value="">All actors</option>{actors}</select></label><label>Year<select id="year-filter"><option value="">All years</option>{years}</select></label><label>Type<select id="kind-filter"><option value="">Everything</option><option value="Movies">Movies</option><option value="Documentaries">Documentaries</option><option value="Series">Series</option></select></label><label>Sort<select id="sort-filter"><option value="default">Featured</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option><option value="title">A–Z</option></select></label><button class="textbtn" data-act="reset-search">Reset filters</button></div><div id="results">{}</div>"#,
            head(
                "DISCOVERY",
                "Search",
                "Find your next watch by title, genre, release year or cast."
            ),
            icon("search"),
            self.results(Filter::default())
        )
    }
    /// A self-contained, crawlable document for one title. The body is exactly
    /// the markup the in-app router injects, so hydration cannot disagree with
    /// what a search engine or a chat scraper first saw. Written without a
    /// template engine: the Wasm build stays dependency-free.
    pub fn title_document(&self, id: &str, base: &str) -> String {
        let base = normalise_base(base);
        // `find` returns an owned Film, so the copy used in the head tags is
        // owned too: the fallbacks outlive the closures that read them.
        let film = self.find(id);
        let title = film
            .as_ref()
            .map_or("Title unavailable", |f| f.title.as_str())
            .to_string();
        let description = film
            .as_ref()
            .map_or(
                "This title may belong to a disabled or removed provider.",
                |f| f.description.as_str(),
            )
            .to_string();
        let canonical = self.share_link(id, &base);
        let canonical = if canonical.is_empty() {
            format!("{base}#movies")
        } else {
            canonical
        };
        let image = film
            .as_ref()
            .map_or("steel-wide", |f| f.art.as_str())
            .to_string();
        let og_title = format!("{title} — free open film on Framewave");
        let meta = if let Some(f) = film.as_ref() {
            let json = format!(
                r#"{{"@context":"https://schema.org","@type":"Movie","name":"{}","description":"{}","image":"{}art/{}.webp","datePublished":"{}","genre":"{}","url":"{}","isFamilyFriendly":true,"contentLocation":"Open cinema collection","productionCompany":{{"@type":"Organization","name":"Blender Foundation"}},"potentialAction":{{"@type":"WatchAction","target":"{}#watch/{}"}}}}"#,
                json_esc(&f.title),
                json_esc(&f.description),
                base,
                esc(&f.art),
                json_esc(&f.year),
                json_esc(f.genre()),
                canonical,
                base,
                esc(&f.id)
            );
            format!(
                r#"<meta property="og:type" content="video.movie"><meta property="og:title" content="{}"><meta property="og:description" content="{}"><meta property="og:image" content="{}art/{}.webp"><meta property="og:url" content="{}"><meta property="video:release_date" content="{}"><script type="application/ld+json">{json}</script>"#,
                esc(&og_title),
                esc(&description),
                base,
                esc(&f.art),
                esc(&canonical),
                esc(&f.year)
            )
        } else {
            r#"<meta name="robots" content="noindex"><meta property="og:type" content="website">"#
                .to_string()
        };
        format!(
            r##"<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="{}"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#091513"><title>{}</title><meta name="description" content="{}"><link rel="canonical" href="{}"><meta property="og:site_name" content="Framewave"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{}"><meta name="twitter:description" content="{}"><meta name="twitter:image" content="{}art/{}.webp">{}<link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="style.css"><script type="module" src="app.js"></script></head><body><main id="main" tabindex="-1">{}</main><footer class="footer wrap"><div><a href="index.html" class="brand"><img src="logo.svg" alt="" width="28" height="28"><span>Framewave</span></a><p>Cinema on your wavelength.</p></div><nav aria-label="Footer"><a href="index.html">Library</a><a href="install.html">Download</a><a href="index.html#about">About</a></nav><p class="footer-bottom"><span>Created by Zeeshan Haider</span><span class="spectrum"></span><span>Open cinema collection</span></p></footer></body></html>"##,
            base,
            esc(&og_title),
            esc(&description),
            esc(&canonical),
            esc(&og_title),
            esc(&description),
            base,
            esc(&image),
            meta,
            if film.is_some() {
                self.detail(id)
            } else {
                self.unavailable()
            }
        )
    }

    /// XML sitemap for the deployed base. Every entry is a route the client can
    /// actually render, so crawlers never index a dead end.
    pub fn sitemap(&self, base: &str) -> String {
        let base = normalise_base(base);
        let mut routes: Vec<String> = vec![
            String::new(),
            "#movies".into(),
            "#shows".into(),
            "#categories".into(),
            "#search".into(),
            "install.html".into(),
            "credits.html".into(),
            "index.html#about".into(),
        ];
        for f in self.titles() {
            // Each of these is a document the build writes to disk.
            routes.push(format!("title/{}.html", f.id));
        }
        for g in GENRES {
            routes.push(format!("#genre/{}", slug(g)));
        }
        let mut seen = std::collections::BTreeSet::new();
        let mut body = String::new();
        for route in routes {
            let loc = format!("{base}{route}");
            if !seen.insert(loc.clone()) {
                continue;
            }
            let priority = if route.is_empty() { "1.0" } else { "0.8" };
            write!(
                body,
                "<url><loc>{}</loc><changefreq>weekly</changefreq><priority>{priority}</priority></url>",
                esc(&loc)
            )
            .unwrap();
        }
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">{body}</urlset>"
        )
    }
}

/// Escape a string for a JSON string literal (also keeps `</script>` harmless).
fn json_esc(s: &str) -> String {
    s.replace(['\n', '\r', '\t'], " ")
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
}
