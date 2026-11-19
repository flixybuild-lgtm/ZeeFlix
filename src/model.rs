use std::collections::BTreeSet;

pub const GENRES: &[&str] = &[
    "Action",
    "Adventure",
    "Sci-Fi",
    "Fantasy",
    "Comedy",
    "Horror",
    "Romance",
    "Documentary",
    "Drama",
];
pub const SPOTLIGHT: &[&str] = &["steel", "sintel", "spring", "cosmos"];

#[derive(Clone, Debug)]
pub struct Film {
    pub id: String,
    pub title: String,
    pub art: String,
    pub year: String,
    pub minutes: String,
    pub genres: String,
    pub cast: String,
    pub source: String,
    pub episode: u8,
    pub description: String,
    pub format: String,
    pub download: bool,
}
impl Film {
    pub fn genre(&self) -> &str {
        self.genres.split(',').next().unwrap_or("Independent")
    }
    pub fn kind(&self) -> &str {
        if self.episode > 0 {
            "Series"
        } else if self.genre() == "Documentary" {
            "Documentary"
        } else {
            "Film"
        }
    }
    pub fn provider(&self) -> &str {
        if self.format == "local" {
            "ZeeFlix Library"
        } else if self.id.starts_with("custom-") {
            "Personal provider"
        } else {
            "Blender Open Movies"
        }
    }
}
/// Discovery sort order. `Default` preserves catalogue order so every existing
/// route and test keeps behaving exactly as before.
#[derive(Default, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sort {
    #[default]
    Default,
    Newest,
    Oldest,
    Shortest,
    Longest,
    Title,
}
impl Sort {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_lowercase().as_str() {
            "newest" | "latest" => Self::Newest,
            "oldest" => Self::Oldest,
            "shortest" => Self::Shortest,
            "longest" => Self::Longest,
            "title" | "a-z" | "az" => Self::Title,
            _ => Self::Default,
        }
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::Newest => "newest",
            Self::Oldest => "oldest",
            Self::Shortest => "shortest",
            Self::Longest => "longest",
            Self::Title => "title",
        }
    }
}

/// A ready-to-render outbound share link.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ShareTarget {
    pub id: &'static str,
    pub label: &'static str,
    pub url: String,
    pub target: &'static str,
}

#[derive(Default, Clone, Copy)]
pub struct Filter<'a> {
    pub query: &'a str,
    pub genre: &'a str,
    pub actor: &'a str,
    pub year: &'a str,
    /// "Movies" | "Documentaries" | "Series" | anything else == everything.
    pub kind: &'a str,
    pub sort: Sort,
}
impl Filter<'_> {
    fn matches(&self, f: &Film) -> bool {
        let q = self.query.trim().to_lowercase();
        (q.is_empty()
            || [&f.title, &f.genres, &f.cast]
                .iter()
                .any(|s| s.to_lowercase().contains(&q)))
            && (self.genre.is_empty()
                || self.genre == "All"
                || f.genres
                    .split(',')
                    .any(|s| s.eq_ignore_ascii_case(self.genre)))
            && (self.actor.is_empty()
                || f.cast
                    .split(',')
                    .any(|s| s.eq_ignore_ascii_case(self.actor)))
            && (self.year.is_empty() || f.year == self.year)
            && Self::kind_matches(self.kind, f)
    }
    /// Kind buckets are derived from the existing `kind()` classification, so a
    /// documentary is never also listed as a movie.
    fn kind_matches(kind: &str, f: &Film) -> bool {
        match kind {
            "Movies" => f.kind() != "Documentary" && f.episode == 0,
            "Documentaries" => f.genre() == "Documentary",
            "Series" => f.episode > 0,
            _ => true,
        }
    }
}

/// Sort key for titles: lowercase and without a leading article, so
/// "The Making of Sintel" files under M like a library catalogue would.
pub fn sort_key(title: &str) -> String {
    let lower = title.trim().to_lowercase();
    let stripped = ["the ", "a ", "an "]
        .iter()
        .find_map(|prefix| lower.strip_prefix(prefix))
        .unwrap_or(&lower);
    stripped.to_string()
}
fn catalogue() -> Vec<Film> {
    include_str!("../public/catalog.tsv")
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .map(|l| {
            let v: Vec<_> = l.split('\t').collect();
            assert_eq!(v.len(), 10, "invalid catalogue row");
            let (format, source) = if v[7] == "local" {
                ("local", "media/sintel.webm".into())
            } else if let Some(id) = v[7].strip_prefix("web:") {
                (
                    "embed",
                    format!("https://www.youtube-nocookie.com/embed/{id}"),
                )
            } else {
                ("peer", v[7].into())
            };
            Film {
                id: v[0].into(),
                title: v[1].into(),
                art: v[2].into(),
                year: v[3].into(),
                minutes: v[4].into(),
                genres: v[5].into(),
                cast: v[6].into(),
                source,
                episode: v[8].parse().unwrap(),
                description: v[9].into(),
                format: format.into(),
                download: format != "embed" && v[0] != "making-sintel" && v[0] != "agent",
            }
        })
        .collect()
}
pub fn safe_source(s: &str) -> bool {
    if s.len() > 2048
        || s.chars().any(|c| {
            c.is_control() || c.is_whitespace() || matches!(c, '<' | '>' | '"' | '\'' | '\\')
        })
    {
        return false;
    }
    if let Some(name) = s.strip_prefix("media/") {
        return !name.is_empty()
            && !name.contains("..")
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c));
    }
    let Some(rest) = s.strip_prefix("https://") else {
        return false;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    !host.is_empty()
        && !host.contains('@')
        && host
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-.:[]".contains(&c))
}
fn safe_embed(s: &str) -> bool {
    [
        "https://www.youtube-nocookie.com/embed/",
        "https://www.youtube.com/embed/",
        "https://player.vimeo.com/video/",
        "https://video.blender.org/videos/embed/",
    ]
    .iter()
    .any(|p| {
        s.strip_prefix(p).is_some_and(|id| {
            !id.is_empty()
                && id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"-_".contains(&c))
        })
    })
}
#[derive(Clone, Debug)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub url: String,
    pub format: String,
    pub enabled: bool,
    pub download: bool,
}
impl Provider {
    pub fn new(name: &str, url: &str, format: &str, download: bool) -> Result<Self, &'static str> {
        let name = name.trim();
        let url = url.trim();
        if name.is_empty() || name.chars().count() > 90 || name.chars().any(char::is_control) {
            return Err("Use a title of 1–90 characters.");
        }
        if !safe_source(url) {
            return Err("Use a direct HTTPS URL without credentials, or a file under media/.");
        }
        if !["mp4", "webm", "hls", "dash", "embed"].contains(&format) {
            return Err("Choose a supported format.");
        }
        if format == "embed" && !safe_embed(url) {
            return Err(
                "Use an official YouTube, Vimeo or Blender embed URL, without query parameters.",
            );
        }
        Ok(Self {
            id: String::new(),
            name: name.into(),
            url: url.into(),
            format: format.into(),
            enabled: true,
            download: download && ["mp4", "webm"].contains(&format),
        })
    }
    fn film(&self) -> Film {
        Film {
            id: self.id.clone(),
            title: self.name.clone(),
            source: self.url.clone(),
            format: self.format.clone(),
            art: "personal".into(),
            genres: "Independent".into(),
            description: "An authorized title from your personal media collection.".into(),
            download: self.download,
            year: String::new(),
            minutes: String::new(),
            cast: String::new(),
            episode: 0,
        }
    }
}
#[derive(Clone, Debug)]
pub struct Progress {
    pub id: String,
    pub time: u32,
    pub duration: u32,
}
impl Progress {
    pub fn unfinished(&self) -> bool {
        self.time >= 3
            && self.time.saturating_add(3) < self.duration
            && u64::from(self.time) * 100 < u64::from(self.duration) * 98
    }
}
pub struct App {
    films: Vec<Film>,
    pub providers: Vec<Provider>,
    pub list: BTreeSet<String>,
    pub favorites: BTreeSet<String>,
    pub history: Vec<Progress>,
    pub local: bool,
    pub blender: bool,
    pub splash: bool,
    pub autoplay: bool,
    pub theme: String,
}
impl Default for App {
    fn default() -> Self {
        Self {
            films: catalogue(),
            providers: vec![],
            list: BTreeSet::new(),
            favorites: BTreeSet::new(),
            history: vec![],
            local: true,
            blender: true,
            splash: true,
            autoplay: true,
            theme: "cinema".into(),
        }
    }
}
impl App {
    pub fn titles(&self) -> Vec<Film> {
        self.films
            .iter()
            .filter(|f| {
                if f.format == "local" {
                    self.local
                } else {
                    self.blender
                }
            })
            .cloned()
            .chain(
                self.providers
                    .iter()
                    .filter(|p| p.enabled)
                    .map(Provider::film),
            )
            .collect()
    }
    pub fn find(&self, id: &str) -> Option<Film> {
        self.titles().into_iter().find(|f| f.id == id)
    }
    fn known(&self, id: &str) -> bool {
        self.films.iter().any(|f| f.id == id) || self.providers.iter().any(|p| p.id == id)
    }
    pub fn search(&self, f: &Filter) -> Vec<Film> {
        let mut hits: Vec<Film> = self.titles().into_iter().filter(|m| f.matches(m)).collect();
        // `sort_by_key` is stable, so equal keys keep catalogue order.
        match f.sort {
            Sort::Default => {}
            Sort::Newest => hits.sort_by_key(|f| std::cmp::Reverse(f.year.clone())),
            Sort::Oldest => hits.sort_by_key(|f| f.year.clone()),
            Sort::Shortest => hits.sort_by_key(minutes_key),
            Sort::Longest => hits.sort_by_key(|f| std::cmp::Reverse(minutes_key(f))),
            Sort::Title => hits.sort_by_key(|f| sort_key(&f.title)),
        }
        hits
    }

    /// "More like this": titles ranked by how many genres they share, never
    /// including the current title and never including an unrelated one.
    pub fn related(&self, id: &str, limit: usize) -> Vec<Film> {
        let Some(current) = self.find(id) else {
            return Vec::new();
        };
        if limit == 0 {
            return Vec::new();
        }
        let genres: Vec<&str> = current.genres.split(',').map(str::trim).collect();
        let mut scored: Vec<(usize, usize, Film)> = self
            .titles()
            .into_iter()
            .filter(|m| m.id != current.id)
            .enumerate()
            .map(|(order, m)| {
                let score = m
                    .genres
                    .split(',')
                    .filter(|g| genres.iter().any(|x| x.eq_ignore_ascii_case(g.trim())))
                    .count();
                (score, order, m)
            })
            .filter(|(score, _, _)| *score > 0)
            .collect();
        scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        scored.into_iter().take(limit).map(|(_, _, m)| m).collect()
    }

    /// Canonical shareable deep link for a title, or an empty string when the
    /// title does not exist (callers render nothing rather than a dead link).
    pub fn share_link(&self, id: &str, base: &str) -> String {
        if self.find(id).is_none() {
            return String::new();
        }
        format!("{}#title/{}", normalise_base(base), encode_component(id))
    }

    /// Install page URL for the given deployment base.
    pub fn install_url(&self, base: &str) -> String {
        format!("{}install.html", normalise_base(base))
    }

    /// Outbound share destinations for one title.
    pub fn share_targets(&self, id: &str, base: &str) -> Vec<ShareTarget> {
        let Some(film) = self.find(id) else {
            return Vec::new();
        };
        let link = self.share_link(id, base);
        let message = format!(
            "{} — streaming free on ZeeFlix. No account, no ads, no tracking.",
            film.title
        );
        let encoded = encode_component(&format!("{message}\n{link}"));
        let encoded_link = encode_component(&link);
        let encoded_message = encode_component(&message);
        vec![
            ShareTarget {
                id: "whatsapp",
                label: "WhatsApp",
                url: format!("https://wa.me/?text={encoded}"),
                target: "_blank",
            },
            ShareTarget {
                id: "x",
                label: "X / Twitter",
                url: format!(
                    "https://twitter.com/intent/tweet?text={encoded_message}&url={encoded_link}"
                ),
                target: "_blank",
            },
            ShareTarget {
                id: "telegram",
                label: "Telegram",
                url: format!("https://t.me/share/url?url={encoded_link}&text={encoded_message}"),
                target: "_blank",
            },
            ShareTarget {
                id: "reddit",
                label: "Reddit",
                url: format!(
                    "https://www.reddit.com/submit?url={encoded_link}&title={encoded_message}"
                ),
                target: "_blank",
            },
            ShareTarget {
                id: "facebook",
                label: "Facebook",
                url: format!("https://www.facebook.com/sharer/sharer.php?u={encoded_link}"),
                target: "_blank",
            },
            ShareTarget {
                id: "email",
                label: "Email",
                url: format!("mailto:?subject={encoded_message}&body={encoded}",),
                target: "_blank",
            },
        ]
    }
    pub fn resume(&self, id: &str) -> u32 {
        self.history
            .iter()
            .find(|p| p.id == id && p.unfinished())
            .map_or(0, |p| p.time)
    }
    pub fn add_provider(&mut self, mut p: Provider) -> Result<String, &'static str> {
        if self.providers.len() >= 100 {
            return Err("The local limit is 100 providers.");
        }
        let mut n = 1;
        while self.known(&format!("custom-{n}")) {
            n += 1;
        }
        p.id = format!("custom-{n}");
        let id = p.id.clone();
        self.providers.push(p);
        Ok(id)
    }
    pub fn pack(&self) -> String {
        let mut lines = vec![
            "v1".to_string(),
            format!(
                "prefs\t{}\t{}\t{}\t{}\t{}",
                self.splash as u8,
                self.autoplay as u8,
                self.theme,
                self.blender as u8,
                self.local as u8
            ),
        ];
        for p in &self.providers {
            lines.push(format!(
                "source\t{}\t{}\t{}\t{}\t{}\t{}",
                p.id, p.name, p.url, p.format, p.download as u8, p.enabled as u8
            ));
        }
        for id in &self.list {
            lines.push(format!("list\t{id}"));
        }
        for id in &self.favorites {
            lines.push(format!("fav\t{id}"));
        }
        for p in &self.history {
            lines.push(format!("pos\t{}\t{}\t{}", p.id, p.time, p.duration));
        }
        lines.join("\n")
    }
    pub fn restore(raw: &str) -> Self {
        let mut app = Self::default();
        if raw.len() > 512_000 || raw.lines().next() != Some("v1") {
            return app;
        }
        for l in raw.lines().skip(1).take(1000) {
            let parts: Vec<_> = l.split('\t').collect();
            match parts.as_slice() {
                ["prefs", sp, au, th, b, l] => {
                    app.splash = *sp != "0";
                    app.autoplay = *au != "0";
                    app.theme = if *th == "midnight" {
                        "midnight"
                    } else {
                        "cinema"
                    }
                    .into();
                    app.blender = *b != "0";
                    app.local = *l != "0";
                }
                ["source", id, name, url, fmt, dl, on]
                    if id
                        .strip_prefix("custom-")
                        .is_some_and(|x| x.parse::<u32>().is_ok())
                        && !app.known(id)
                        && app.providers.len() < 100 =>
                {
                    if let Ok(mut p) = Provider::new(name, url, fmt, *dl == "1") {
                        p.id = id.to_string();
                        p.enabled = *on == "1";
                        app.providers.push(p);
                    }
                }
                ["list", id] if app.known(id) => {
                    app.list.insert(id.to_string());
                }
                ["fav", id] if app.known(id) => {
                    app.favorites.insert(id.to_string());
                }
                ["pos", id, t, d] if app.known(id) => {
                    if let Some(p) = progress(id, t, d) {
                        app.history.push(p);
                    }
                }
                _ => {}
            }
        }
        app
    }
    pub fn mutate(&mut self, v: &[&str]) -> Option<String> {
        let id = *v.get(1).unwrap_or(&"");
        Some(match v {
            ["list", _] | ["favorite", _] if self.known(id) => {
                let set = if v[0] == "list" {
                    &mut self.list
                } else {
                    &mut self.favorites
                };
                if set.remove(id) {
                    "0"
                } else {
                    set.insert(id.into());
                    "1"
                }
                .into()
            }
            ["progress", _, t, d] if self.known(id) => {
                if let Some(p) = progress(id, t, d) {
                    self.history.retain(|p| p.id != id);
                    self.history.insert(0, p);
                    self.history.truncate(256);
                }
                String::new()
            }
            ["clear-history"] => {
                self.history.clear();
                "ok".into()
            }
            ["enable", _] => {
                match id {
                    "blender" => self.blender = !self.blender,
                    "local" => self.local = !self.local,
                    _ => {
                        if let Some(p) = self.providers.iter_mut().find(|p| p.id == id) {
                            p.enabled = !p.enabled;
                        }
                    }
                };
                "ok".into()
            }
            ["provider", key, name, url, fmt, dl, "authorized"] => {
                match Provider::new(name, url, fmt, *dl == "1") {
                    Err(e) => e.into(),
                    Ok(mut p) => {
                        if key.is_empty() {
                            self.add_provider(p)
                                .map_or_else(String::from, |_| "ok".into())
                        } else if let Some(old) = self.providers.iter_mut().find(|p| p.id == *key) {
                            p.enabled = old.enabled;
                            p.id = key.to_string();
                            *old = p;
                            "ok".into()
                        } else {
                            "Provider not found.".into()
                        }
                    }
                }
            }
            ["delete", _] => {
                self.providers.retain(|p| p.id != id);
                self.list.remove(id);
                self.favorites.remove(id);
                self.history.retain(|p| p.id != id);
                "ok".into()
            }
            ["pref", "splash", value] => {
                self.splash = *value == "1";
                "ok".into()
            }
            ["pref", "autoplay", value] => {
                self.autoplay = *value == "1";
                "ok".into()
            }
            ["pref", "theme", value] => {
                self.theme = if *value == "midnight" {
                    "midnight"
                } else {
                    "cinema"
                }
                .into();
                "ok".into()
            }
            _ => return None,
        })
    }
}
fn progress(id: &str, t: &str, d: &str) -> Option<Progress> {
    let d: u32 = d.parse().ok()?;
    let t: u32 = t.parse().ok()?;
    if d == 0 || t == 0 || t > d.saturating_add(2) {
        return None;
    }
    Some(Progress {
        id: id.into(),
        time: t.min(d),
        duration: d,
    })
}
/// Runtime in minutes for sorting; unparseable or empty values sort last.
fn minutes_key(f: &Film) -> u32 {
    f.minutes.parse().unwrap_or(u32::MAX)
}

/// Guarantees exactly one trailing slash so links compose predictably whether the
/// site is served from a domain root or a `/ZeeFlix/` subpath.
fn normalise_base(base: &str) -> String {
    let trimmed = base.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    }
}

/// Percent-encode for a query parameter (RFC 3986 unreserved set only).
/// Hand-rolled so the Wasm build keeps zero dependencies.
pub fn encode_component(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for byte in raw.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}


#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resume_thresholds() {
        for (t, d, res) in [
            (0, 20, false),
            (2, 20, false),
            (3, 20, true),
            (16, 20, true),
            (17, 20, false),
            (990, 1000, false),
        ] {
            assert_eq!(
                Progress {
                    id: "x".into(),
                    time: t,
                    duration: d
                }
                .unfinished(),
                res
            );
        }
    }
    #[test]
    fn source_schemes() {
        assert!(safe_source("https://example.org/video.mp4?q=123&x=4"));
        assert!(!safe_source("https:///clip"));
        assert!(!safe_source("media/../../x"));
    }
}