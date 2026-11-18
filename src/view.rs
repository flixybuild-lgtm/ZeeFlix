use crate::{App, Film, Filter, GENRES, SPOTLIGHT};
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
            r##"<section class="hero hero-{}" aria-label="Featured film" data-slide="{i}" data-slides="{}"><picture><source media="(max-width:640px)" srcset="art/{small}.webp"><img class="hero-art" src="art/{still}.webp" alt="" fetchpriority="high"></picture><div class="hero-vignette"></div><div class="hero-inner"><div class="spot-label">{} FEATURED SPOTLIGHT</div><h1>{}</h1><div class="hero-meta"><b class="open-film">OPEN FILM</b><span>{}</span><i></i><span>{} min</span><i></i><span>{}</span>{}</div><p class="synopsis">{}</p><div class="actions"><a class="btn gold" href="#watch/{}">{} Watch Now</a>{}</div></div><div class="hero-foot"><div class="slide-index"><b>{:02}</b><span>/</span>{:02}</div><div class="slide-dots">{dots}</div><div class="hero-arrows"><button class="circle" data-act="prev-slide" aria-label="Previous featured film">{}</button><button class="circle" data-act="next-slide" aria-label="Next featured film">{}</button></div></div></section>"##,
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
        format!("<div class=\"suggestions\">{suggestions}</div><div class=\"section-head compact\"><h2>{}</h2><span class=\"muted\">{} titles</span></div>{content}",if f.query.trim().is_empty(){"Explore the library"}else{"Search results"},r.len())
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
            r#"{}<div class="search-box">{}<input id="query" type="search" placeholder="Search films, genres or cast…" maxlength="100" autocomplete="off" aria-label="Search titles"></div><div class="filters"><label>Genre<select id="genre-filter"><option value="">All genres</option>{genres}</select></label><label>Actor<select id="actor-filter"><option value="">All actors</option>{actors}</select></label><label>Year<select id="year-filter"><option value="">All years</option>{years}</select></label><button class="textbtn" data-act="reset-search">Reset filters</button></div><div id="results">{}</div>"#,
            head(
                "DISCOVERY",
                "Search",
                "Find your next watch by title, genre, release year or cast."
            ),
            icon("search"),
            self.results(Filter::default())
        )
    }
}
