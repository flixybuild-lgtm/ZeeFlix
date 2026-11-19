use crate::view::{empty, esc, genre_icon, head, icon, opt, slug};
use crate::{App, Film, Filter, GENRES};

/// Placeholder the web client replaces with the deployed base URL.
const BASE_TOKEN: &str = "{{base}}";
use std::fmt::Write;

impl App {
    pub fn page(&self, route: &str) -> String {
        let (page, arg) = route.split_once('/').unwrap_or((route, ""));
        if page == "home" || page.is_empty() {
            return format!(
                r#"<div id="spotlight">{}</div><div class="home-body wrap"><section class="source-dock"><div><small>PERSONAL SCREENING ROOM</small><h2>Bring your own stream.</h2><p>Play an authorized video link. No plugins required.</p></div><button class="btn gold" data-act="edit-provider">Enter provider HTTPS ↗</button></section><div class="genre-bar" id="genre-bar" aria-label="Genre filters">{}</div><div id="home-feed">{}</div></div>"#,
                self.hero(0),
                self.chips("All"),
                self.feed("All")
            );
        }
        let body = match page {
            "movies" | "shows" | "collection" | "genre" => {
                let (title, sub, films) = match page {
                    "movies" => (
                        "Movies",
                        "Extraordinary worlds, one film at a time.",
                        self.collection("popular-movies"),
                    ),
                    "shows" => (
                        "TV Shows",
                        "Short-form series, ready to watch one episode at a time.",
                        self.collection("popular-series"),
                    ),
                    "genre" => {
                        let genre = GENRES
                            .iter()
                            .find(|s| slug(s) == arg)
                            .copied()
                            .unwrap_or("Unknown genre");
                        (
                            genre,
                            "Explore the open cinema collection by genre.",
                            self.search(&Filter {
                                genre,
                                ..Filter::default()
                            }),
                        )
                    }
                    _ => (
                        match arg {
                            "recently-added" => "Recently Added",
                            "popular-movies" => "Popular Movies",
                            "popular-series" => "Popular Series",
                            _ => "Trending Now",
                        },
                        "An editorial selection from the Framewave library.",
                        self.collection(arg),
                    ),
                };
                let content = if films.is_empty() {
                    empty(
                        "screen",
                        "No titles available",
                        "Enable a media provider to fill this collection.",
                        "#providers",
                        "Manage providers",
                    )
                } else {
                    self.grid(&films, title == "Trending Now")
                };
                format!(
                    "{}<div class=\"list-caption\">{} TITLES</div>{content}",
                    head("THE COLLECTION", title, sub),
                    films.len()
                )
            }
            "categories" => {
                let cards=GENRES.iter().fold(String::new(), |mut out, g| {let films=self.search(&Filter{genre:g,..Filter::default()});let art=films.first().map_or("steel",|f|&f.art);write!(out,r##"<a href="#genre/{}" class="category"><img src="art/{}.webp" alt="" loading="lazy"><div><span class="genre-symbol">{}</span><small>{} TITLES</small><h2>{}</h2></div>{}</a>"##,slug(g),art,icon(genre_icon(g)),films.len(),match *g{"Sci-Fi"=>"Science Fiction","Documentary"=>"Documentaries",other=>other},icon("external")).unwrap(); out});
                format!(
                    "{}<div class=\"category-grid\">{cards}</div>",
                    head(
                        "EXPLORE",
                        "Categories",
                        "Choose a genre. Discover a different world."
                    )
                )
            }
            "search" => self.search_page(),
            "list" | "favorites" | "history" | "continue" => self.library(page),
            "title" => return self.detail(arg),
            "watch" => self.player(arg),
            "providers" => self.providers_page(),
            "settings" => self.settings_page(),
            "about" => self.about(),
            "downloads" => format!(
                r##"{}<div id="download-jobs"></div><p class="fine">Transfers belong to this browser tab. Keep it open until your file is saved. Downloads are available only when the provider permits them.</p>"##,
                head(
                    "YOUR LIBRARY",
                    "Downloads",
                    "Save authorized films and episodes at the quality you choose."
                )
            ),
            _ => empty(
                "compass",
                "Page not found",
                "This screening isn't on the schedule.",
                "#home",
                "Back to Home",
            ),
        };
        format!("<div class=\"wrap inner-page\">{body}</div>")
    }
    fn library(&self, page: &str) -> String {
        let tabs = [
            ("list", "My List"),
            ("favorites", "Favorites"),
            ("continue", "Continue Watching"),
            ("history", "Recently Watched"),
        ]
        .iter()
        .fold(String::new(), |mut out, (key, title)| {
            write!(
                out,
                r##"<a class="chip {}" href="#{key}">{title}</a>"##,
                if page == *key { "active" } else { "" }
            )
            .unwrap();
            out
        });
        let (title, copy, records) = match page {
            "history" => (
                "Recently Watched",
                "Your playback history, saved only on this device.",
                self.history_titles(false),
            ),
            "continue" => (
                "Continue Watching",
                "Get right back to where you left off.",
                self.history_titles(true),
            ),
            "favorites" => (
                "Favorites",
                "The titles you love, all in one place.",
                self.titles()
                    .into_iter()
                    .filter(|f| self.favorites.contains(&f.id))
                    .collect(),
            ),
            _ => (
                "My List",
                "A collection for the films you want to watch next.",
                self.titles()
                    .into_iter()
                    .filter(|f| self.list.contains(&f.id))
                    .collect(),
            ),
        };
        let cards = if records.is_empty() {
            let (ic, t, c) = match page {
                "history" => (
                    "history",
                    "No viewing history yet",
                    "Play a film and it will appear here.",
                ),
                "continue" => (
                    "play",
                    "You're all caught up",
                    "Unfinished films will be waiting here.",
                ),
                "favorites" => (
                    "heart",
                    "Keep your favorites close",
                    "Open a film and tap the heart to add it to your favorites.",
                ),
                _ => (
                    "bookmark",
                    "Your watchlist starts here",
                    "Use the bookmark on any poster, or My List on a featured film.",
                ),
            };
            empty(ic, t, c, "#movies", "Explore movies")
        } else {
            self.grid(&records, false)
        };
        format!(
            "{}<div class=\"tabbar\">{tabs}</div>{}{cards}",
            head("YOUR LIBRARY", title, copy),
            if page == "history" && !records.is_empty() {
                "<button class=\"btn subtle small\" data-act=\"clear-history\">Clear history</button>"
            } else {
                ""
            }
        )
    }
    pub fn detail(&self, id: &str) -> String {
        let Some(f) = self.find(id) else {
            return self.unavailable();
        };
        let saved = self.favorites.contains(id);
        let facts = [
            ("Release", f.year.as_str()),
            (
                "Runtime",
                &if f.minutes.is_empty() {
                    String::new()
                } else {
                    format!("{} min", f.minutes)
                },
            ),
            ("Genres", &f.genres.replace(',', ", ")),
            ("Cast", &f.cast.replace(',', ", ")),
            ("Provider", f.provider()),
        ]
        .iter()
        .filter(|(_, v)| !v.is_empty())
        .fold(String::new(), |mut out, (k, v)| {
            write!(out, "<div><dt>{k}</dt><dd>{}</dd></div>", esc(v)).unwrap();
            out
        });
        format!(
            r##"<div class="detail-backdrop" style="--art:url('art/{}.webp')"><div class="wrap"><a class="back-link" href="#movies">{} Back to library</a><div class="detail-layout"><div class="detail-poster"><img src="art/{}.webp" alt="{} key art"></div><div class="detail-info"><p class="eyebrow"><i></i>{} COLLECTION</p><h1>{}</h1><p class="lede">{}</p><div class="actions"><a href="#watch/{}" class="btn gold">{} {}</a>{}<button class="btn glass fav {}" data-act="favorite" data-id="{}" aria-label="Toggle favorite" aria-pressed="{saved}">{}</button><button class="btn glass" data-act="open-share" data-id="{}" aria-label="Share this film">{}</button></div><dl class="facts">{facts}</dl>{}</div></div></div></div><div class="wrap detail-more">{}</div>"##,
            f.art,
            icon("back"),
            f.art,
            esc(&f.title),
            esc(f.genre()),
            esc(&f.title),
            esc(&f.description),
            f.id,
            icon("play"),
            if self.resume(id) > 0 {
                "Resume"
            } else {
                "Watch Now"
            },
            self.save_btn(&f, false),
            if saved { "saved" } else { "" },
            f.id,
            icon("heart"),
            f.id,
            icon("link"),
            self.credit(&f),
            if f.episode > 0 {
                self.episodes(&f)
            } else {
                // Ranked by shared genres instead of a single-genre dump.
                format!(
                    "{}{}",
                    self.share_sheet(id, BASE_TOKEN),
                    self.related_rail(id, 6)
                )
            }
        )
    }
    fn unavailable(&self) -> String {
        empty(
            "link",
            "Title unavailable",
            "This title may belong to a disabled or removed provider.",
            "#providers",
            "Check providers",
        )
    }
    fn credit(&self, f: &Film) -> String {
        if f.id.starts_with("custom-") {
            return "<p class=\"credit\">Personal media · Rights managed by the provider owner.</p>".into();
        }
        let link = if f.format == "peer" {
            format!("https://video.blender.org/w/{}", f.source)
        } else if f.format == "local" {
            "https://durian.blender.org/".into()
        } else {
            "https://studio.blender.org/projects/sprite-fright/".into()
        };
        format!(
            r#"<p class="credit">Film © Blender Foundation / Blender Studio and credited artists. <a href="{link}" target="_blank" rel="noopener noreferrer">Original release {}</a></p>"#,
            icon("external")
        )
    }
    fn episodes(&self, f: &Film) -> String {
        let list=self.collection("popular-series").into_iter().fold(String::new(), |mut out, e| {write!(out,r##"<a class="episode {}" href="#watch/{}"><span>E{:02}</span><b>{}</b><small>{} min</small>{}</a>"##,if e.id==f.id{"current"}else{""},e.id,e.episode,esc(&e.title),e.minutes,icon("play")).unwrap(); out});
        format!("<div class=\"section-head\"><h2>Caminandes episodes</h2></div>{list}")
    }
    pub fn player(&self, id: &str) -> String {
        let Some(f) = self.find(id) else {
            return self.unavailable();
        };
        let next = if f.id == "gran-dillama" {
            "llamigos"
        } else {
            ""
        };
        let prev = if f.id == "llamigos" {
            "gran-dillama"
        } else {
            ""
        };
        let episode_nav = [(prev, "Previous", "prev"), (next, "Next episode", "next")]
            .iter()
            .filter(|(id, _, _)| !id.is_empty())
            .fold(String::new(), |mut out, (id, label, ic)| {
                write!(
                    out,
                    r##"<a class="btn subtle small" href="#watch/{id}">{} {label}</a>"##,
                    icon(ic)
                )
                .unwrap();
                out
            });
        format!(
            r##"<div id="player" class="watch-page" data-id="{}" data-src="{}" data-format="{}" data-title="{}" data-resume="{}" data-download="{}" data-next="{next}" data-autoplay="{}"><a class="back-link" href="#title/{}">{} Film details</a><div class="watch-head"><div><p class="eyebrow"><i></i>NOW PLAYING</p><h1>{}</h1></div><span class="provider-label">{}</span></div><div id="stage" class="stage" tabindex="0" aria-label="Video player"><video playsinline preload="metadata" poster="art/{}.webp" aria-label="{}"></video><div id="embed-slot"></div><div id="player-message" class="player-message" role="status">Connecting to provider…</div><div id="controls" class="controls"><input type="range" id="seek" min="0" max="1000" value="0" aria-label="Playback timeline"><div class="control-line"><button data-media="play" aria-label="Play or pause">{}</button><button data-media="mute" aria-label="Mute or unmute">{}</button><input id="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"><span id="time">0:00 / 0:00</span><span class="spacer"></span><button data-media="pip" aria-label="Picture in picture" hidden>{}</button><button data-media="fullscreen" aria-label="Fullscreen">{}</button></div></div></div><div id="playback-options" class="playback-options"><label>Speed<select id="speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label hidden>Quality<select id="quality"></select></label><label hidden>Subtitles<select id="subtitles"></select></label><label hidden>Audio<select id="audio-tracks"></select></label><span class="spacer"></span><button id="download-current" class="btn subtle small" hidden>{} Download</button>{episode_nav}</div><div id="transfer-slot"></div><p class="watch-synopsis">{}</p>{}<details class="shortcuts"><summary>Player shortcuts &amp; gestures</summary><p>Space or K: play/pause · ← / →: seek 10 seconds · ↑ / ↓: volume · M: mute · F: fullscreen. Double-tap the left or right side of the video to seek. Landscape lock is used in fullscreen when supported. Embedded players use their provider’s controls.</p></details>{}</div>"##,
            f.id,
            esc(&f.source),
            f.format,
            esc(&f.title),
            self.resume(id),
            f.download,
            self.autoplay,
            f.id,
            icon("back"),
            esc(&f.title),
            f.provider(),
            if id == "steel" { "steel-wide" } else { &f.art },
            esc(&f.title),
            icon("play"),
            icon("volume"),
            icon("pip"),
            icon("full"),
            icon("download"),
            esc(&f.description),
            self.credit(&f),
            if f.episode > 0 {
                self.episodes(&f)
            } else {
                String::new()
            }
        )
    }
    pub fn editor(&self, id: &str) -> String {
        let p = self.providers.iter().find(|p| p.id == id);
        let fmt = p.map_or("auto", |p| p.format.as_str());
        let options = [
            ("auto", "Auto · detect from URL"),
            ("mp4", "Direct video / MP4"),
            ("webm", "WebM"),
            ("hls", "HLS manifest"),
            ("dash", "DASH manifest"),
            ("embed", "Authorized embed"),
        ]
        .iter()
        .map(|(v, l)| opt(v, l, fmt))
        .collect::<String>();
        format!(
            r#"<form id="provider-form"><p class="eyebrow"><i></i>MEDIA CONNECTION</p><h2>{} provider</h2><p class="muted">Paste a playable HTTPS link, not a plugin repository. Change the display title to match your stream.</p><input type="hidden" name="key" value="{}"><label>Display title<input name="name" required maxlength="90" placeholder="My short film" value="{}"></label><label>Source type<select name="format">{options}</select></label><label>Provider HTTPS URL<input name="url" required maxlength="2048" placeholder="https://…" value="{}"></label><p class="fine">Use HTTPS. Embeds must be official YouTube, Vimeo or Blender player links. Do not enter credentials.</p><label class="check-label"><input type="checkbox" name="download" {}> Allow file downloads (direct video only)</label><label class="check-label"><input type="checkbox" name="rights" required> I have permission to stream this media and authorize any downloads.</label><p id="form-error" role="alert"></p><button class="btn gold" type="submit">Save provider {}</button></form>"#,
            if p.is_some() { "Edit" } else { "Add" },
            p.map_or("", |p| &p.id),
            p.map_or_else(|| "Zenda-Cross".into(), |p| esc(&p.name)),
            p.map_or_else(String::new, |p| esc(&p.url)),
            if p.is_some_and(|p| p.download) {
                "checked"
            } else {
                ""
            },
            icon("check")
        )
    }
    fn providers_page(&self) -> String {
        let mut list = vec![
            (
                "local",
                "Framewave Library",
                "local",
                "media/sintel.webm",
                self.local,
            ),
            (
                "blender",
                "Blender Open Movies",
                "peer",
                "8533ea43-4271-4a57-9694-e9d0b35e1aa1",
                self.blender,
            ),
        ];
        list.extend(self.providers.iter().map(|p| {
            (
                p.id.as_str(),
                p.name.as_str(),
                p.format.as_str(),
                p.url.as_str(),
                p.enabled,
            )
        }));
        let rows=list.iter().fold(String::new(), |mut out, (id,name,fmt,url,on)| {let custom=id.starts_with("custom-");let watch=if custom && *on { format!(r##"<a class="text-link" href="#watch/{id}">Watch →</a>"##) } else {String::new()};let edit=if custom{format!(r#"<button class="icon-btn" aria-label="Edit {}" data-act="edit-provider" data-id="{id}">{}</button><button class="icon-btn" aria-label="Delete {}" data-act="delete-provider" data-id="{id}">{}</button>"#,esc(name),icon("edit"),esc(name),icon("trash"))}else{String::new()};write!(out,r#"<div class="provider-row" data-probe-id="{id}" data-format="{fmt}" data-url="{}"><span class="setting-ico">{}</span><div class="provider-copy"><h3>{}</h3><p>{} · <span class="status" role="status">{}</span></p></div><div class="provider-acts">{watch}<button class="btn subtle small" data-act="test-provider" {}>Test</button>{edit}<button role="switch" class="switch" data-act="enable" data-id="{id}" aria-checked="{on}" aria-label="Enable {}"></button></div></div>"#,esc(url),icon("link"),esc(name),if custom{fmt.to_uppercase()}else{"Built-in".into()},if *on{"Not tested"}else{"Disabled"},if *on{""}else{"disabled"},esc(name)).unwrap(); out});
        format!(
            r#"{}<div class="panel-head"><h2>Media sources</h2><button class="btn gold small" data-act="edit-provider">{} Add provider</button></div><div class="panel">{rows}</div><p class="fine">Tests run from your browser. An unreachable host or a CORS restriction is reported, never assumed connected. Disabling a source removes its titles from browsing without erasing your list.</p>"#,
            head(
                "CONTROL ROOM",
                "Providers",
                "Manage the authorized media sources in your library."
            ),
            icon("plus")
        )
    }
    fn settings_page(&self) -> String {
        let toggles=[("splash","Opening animation","Show the creator’s opening credits once per session.",self.splash,"spark"),("autoplay","Auto-play next episode","Continue to the next available episode when one ends.",self.autoplay,"play")].iter().fold(String::new(), |mut out, (key,title,copy,on,ic)| {write!(out,r#"<div class="setting-row"><span class="setting-ico">{}</span><div><h3>{title}</h3><p>{copy}</p></div><button class="switch" role="switch" aria-label="{title}" aria-checked="{on}" data-act="pref" data-key="{key}"></button></div>"#,icon(ic)).unwrap(); out});
        format!(
            r##"{}<div class="panel settings-panel">{toggles}<div class="setting-row"><span class="setting-ico">{}</span><div><h3>Theme</h3><p>Choose your cinema palette.</p></div><select aria-label="Theme" id="theme">{}{}</select></div><div class="setting-row"><span class="setting-ico">{}</span><div><h3>Playback history</h3><p>Remove watch positions and recently watched titles.</p></div><button class="btn subtle small" data-act="clear-history">Clear history</button></div><a class="setting-row" href="#providers"><span class="setting-ico">{}</span><div><h3>Providers</h3><p>Connect, test and manage your media sources.</p></div>{}</a></div>"##,
            head(
                "YOUR EXPERIENCE",
                "Settings",
                "Your preferences stay in this browser. No account needed."
            ),
            icon("sun"),
            opt("cinema", "Cinema gold", &self.theme),
            opt("midnight", "Midnight blue", &self.theme),
            icon("history"),
            icon("link"),
            icon("right")
        )
    }
    fn about(&self) -> String {
        format!(
            r##"<section class="about-intro"><div class="about-glow"></div><img src="logo.svg" width="60" height="60" alt="Framewave signal mark"><p class="eyebrow">BEHIND THE SCREEN</p><h1>About Framewave</h1><p class="tagline">Cinema on your wavelength.</p></section><div class="about-grid"><section class="panel story"><p class="overline"><i></i>THE PROJECT</p><h2>A student-built cinema.</h2><p>Framewave is a modern entertainment platform created by Zeeshan Haider, a 9th-class student at Government High School No. 1.</p><p>The project focuses on modern technology, fast performance, smooth video playback, and a beautiful entertainment experience.</p></section><section class="panel story"><p class="overline"><i></i>CREATOR CREDITS</p><dl class="credits-list"><div><dt>Creator</dt><dd>Zeeshan Haider</dd></div><div><dt>Class</dt><dd>9th Class</dd></div><div><dt>School</dt><dd>Government High School No. 1</dd></div><div><dt>Teacher</dt><dd>Waqas Ashraf</dd></div></dl></section><section class="panel story"><h2>Technology</h2><p>Version {} · Built with Rust, WebAssembly and HTML5 video. A pre-rendered home screen, local fonts and optimized WebP artwork keep browsing lightweight.</p></section><section class="panel story"><h2>Privacy</h2><p>No Framewave accounts, analytics or tracking cookies. Lists, provider links and watch positions stay in browser storage. Playing external media contacts the selected provider, which can see your IP address.</p><a href="#settings" class="text-link">Manage preferences {}</a></section><section class="panel story"><h2>Film credits</h2><p>Our editorial collection features Blender Foundation and Blender Studio open movies. Film rights remain with their respective creators. Framewave uses original illustrative key art, not official film stills.</p><a href="credits.html" class="text-link">Rights and attributions {}</a></section><section class="panel story"><h2>Contact</h2><p>No personal contact details are published. The project repository is the place to follow development and report a problem when public access is available.</p><a href="https://github.com/flixybuild-lgtm/ZeeFlix" target="_blank" rel="noopener noreferrer" class="text-link">Project repository {}</a></section></div>"##,
            env!("CARGO_PKG_VERSION"),
            icon("arrow"),
            icon("arrow"),
            icon("external")
        )
    }
}
