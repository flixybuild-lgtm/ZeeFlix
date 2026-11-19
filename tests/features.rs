//! Tests for the discovery features added on top of the original catalogue.
//!
//! Written before the implementation (TDD): sorting, kind filters, "More like
//! this" recommendations, share targets and the per-title share payload the web
//! and Android clients both use.

use zeeflix::{App, Filter, ShareTarget, Sort};

fn ids(app: &App, f: &Filter) -> Vec<String> {
    app.search(f).into_iter().map(|m| m.id).collect()
}

#[test]
fn default_sort_stays_catalogue_order_for_backwards_compatibility() {
    let app = App::default();
    let f = Filter::default();
    let first =
        |list: Vec<zeeflix::Film>| list.into_iter().take(3).map(|m| m.id).collect::<Vec<_>>();
    assert_eq!(first(app.search(&f)), first(app.titles()));
    assert_eq!(f.sort, Sort::Default);
}

#[test]
fn newest_and_oldest_sort_by_year_then_runtime() {
    let app = App::default();
    let newest = app.search(&Filter {
        sort: Sort::Newest,
        ..Filter::default()
    });
    let years: Vec<u32> = newest.iter().map(|m| m.year.parse().unwrap()).collect();
    assert!(
        years.windows(2).all(|w| w[0] >= w[1]),
        "newest must be non-increasing by year: {years:?}"
    );
    assert_eq!(newest[0].year, "2022", "Charge (2022) should lead");

    let oldest = app.search(&Filter {
        sort: Sort::Oldest,
        ..Filter::default()
    });
    assert_eq!(oldest[0].year, "2008", "Big Buck Bunny (2008) should lead");
    assert!(oldest.last().unwrap().year.parse::<u32>().unwrap() >= 2010);
}

#[test]
fn shortest_and_longest_sort_by_runtime() {
    let app = App::default();
    let shortest = app.search(&Filter {
        sort: Sort::Shortest,
        ..Filter::default()
    });
    let mins: Vec<u32> = shortest
        .iter()
        .map(|m| m.minutes.parse().unwrap())
        .collect();
    assert!(
        mins.windows(2).all(|w| w[0] <= w[1]),
        "shortest first: {mins:?}"
    );

    let longest = app.search(&Filter {
        sort: Sort::Longest,
        ..Filter::default()
    });
    assert_eq!(
        longest[0].id, "making-sintel",
        "the 58 min documentary leads"
    );
}

#[test]
fn title_sort_is_alphabetical_and_ignores_a_leading_article() {
    let app = App::default();
    let sorted = app.search(&Filter {
        sort: Sort::Title,
        ..Filter::default()
    });
    let titles: Vec<&str> = sorted.iter().map(|m| m.title.as_str()).collect();
    let mut expected = titles.clone();
    expected.sort_by_key(|t| zeeflix::sort_key(t));
    assert_eq!(titles, expected);

    // "The Making of Sintel" files under M, not T.
    assert_eq!(
        zeeflix::sort_key("The Making of Sintel"),
        "making of sintel"
    );
    assert_eq!(zeeflix::sort_key("A Quiet Place"), "quiet place");
    assert_eq!(zeeflix::sort_key("Big Buck Bunny"), "big buck bunny");
}

#[test]
fn sorting_is_stable_and_case_insensitive_on_titles() {
    let app = App::default();
    let f = Filter {
        sort: Sort::Title,
        ..Filter::default()
    };
    let a = ids(&app, &f);
    let b = ids(&app, &f);
    assert_eq!(a, b, "repeated queries must return the same order");

    let upper = ids(
        &app,
        &Filter {
            query: "SINTEL",
            sort: Sort::Title,
            ..Filter::default()
        },
    );
    assert_eq!(
        upper,
        ids(
            &app,
            &Filter {
                query: "sintel",
                sort: Sort::Title,
                ..Filter::default()
            }
        )
    );
}

#[test]
fn kind_filter_separates_movies_documentaries_and_series() {
    let app = App::default();
    let movies = app.search(&Filter {
        kind: "Movies",
        ..Filter::default()
    });
    let docs = app.search(&Filter {
        kind: "Documentaries",
        ..Filter::default()
    });
    let series = app.search(&Filter {
        kind: "Series",
        ..Filter::default()
    });

    assert!(!movies.is_empty() && !docs.is_empty() && !series.is_empty());
    assert!(docs.iter().all(|m| m.genre() == "Documentary"));
    assert!(series.iter().all(|m| m.episode > 0), "series are episodes");
    assert!(movies
        .iter()
        .all(|m| m.episode == 0 && m.genre() != "Documentary"));
    // Every title belongs to exactly one bucket.
    assert_eq!(movies.len() + docs.len() + series.len(), app.titles().len());
    // An unknown kind is treated as "everything" rather than returning nothing.
    assert_eq!(
        app.search(&Filter {
            kind: "Whatever",
            ..Filter::default()
        })
        .len(),
        app.titles().len()
    );
}

#[test]
fn filters_combine_sort_kind_genre_and_query() {
    let app = App::default();
    let hits = app.search(&Filter {
        kind: "Movies",
        genre: "Adventure",
        sort: Sort::Shortest,
        ..Filter::default()
    });
    assert!(!hits.is_empty());
    assert!(hits
        .iter()
        .all(|m| m.genres.split(',').any(|g| g == "Adventure")));
    let mins: Vec<u32> = hits.iter().map(|m| m.minutes.parse().unwrap()).collect();
    assert!(mins.windows(2).all(|w| w[0] <= w[1]));
}

#[test]
fn related_titles_share_genres_and_exclude_the_current_title() {
    let app = App::default();
    let related = app.related("sintel", 4);
    assert!(!related.is_empty());
    assert!(related.iter().all(|m| m.id != "sintel"));
    assert!(related.len() <= 4);
    // Sintel is Adventure/Fantasy/Drama, so Adventure titles must surface first.
    assert!(
        related.iter().any(|m| m
            .genres
            .split(',')
            .any(|g| g == "Adventure" || g == "Fantasy")),
        "expected a genre neighbour, got {:?}",
        related.iter().map(|m| &m.id).collect::<Vec<_>>()
    );
    assert!(app.related("does-not-exist", 4).is_empty());
    assert!(app.related("sintel", 0).is_empty());
}

#[test]
fn related_is_ranked_by_shared_genres_then_falls_back_to_the_catalogue() {
    let app = App::default();
    let related = app.related("steel", 3);
    // Tears of Steel is Sci-Fi/Action/Romance: Charge (Sci-Fi/Action) shares two.
    assert_eq!(
        related[0].id, "charge",
        "two shared genres must outrank one"
    );
    let shared = |m: &zeeflix::Film| {
        m.genres
            .split(',')
            .filter(|g| "Sci-Fi,Action,Romance".split(',').any(|x| x == *g))
            .count()
    };
    let scores: Vec<usize> = related.iter().map(shared).collect();
    assert!(
        scores.windows(2).all(|w| w[0] >= w[1]),
        "scores must not increase: {scores:?}"
    );
    assert!(
        scores.iter().all(|s| *s > 0),
        "related must never include an unrelated title"
    );
}

#[test]
fn share_targets_are_well_formed_and_carry_the_encoded_link() {
    let app = App::default();
    let link = app.share_link("sintel", "https://zeeflix.dpdns.org/");
    assert_eq!(
        link, "https://zeeflix.dpdns.org/title/sintel.html#title/sintel",
        "share links must open a pre-rendered document"
    );

    let targets = app.share_targets("sintel", "https://zeeflix.dpdns.org/");
    let whatsapp = targets
        .iter()
        .find(|t| t.id == "whatsapp")
        .expect("whatsapp target");
    assert!(whatsapp.url.starts_with("https://wa.me/?text="));
    assert!(whatsapp.url.contains("Sintel"));
    // The deep link must be percent-encoded exactly once, not double-encoded.
    assert!(whatsapp
        .url
        .contains("https%3A%2F%2Fzeeflix.dpdns.org%2F%23title%2Fsintel"));
    assert!(!whatsapp.url.contains("%253A"), "double-encoded link");

    let x = targets.iter().find(|t| t.id == "x").expect("x target");
    assert!(x.url.starts_with("https://twitter.com/intent/tweet?text="));
    assert!(targets.iter().any(|t| t.id == "telegram"));
    assert!(targets.iter().any(|t| t.id == "reddit"));
    assert!(targets.iter().any(|t| t.id == "email"));
    for t in &targets {
        assert_eq!(t.target, "_blank", "share links must not navigate this tab");
        assert!(t.url.starts_with("https://") || t.url.starts_with("mailto:"));
        assert!(t.label.len() > 1 && t.label.len() < 40);
    }
}

#[test]
fn sharing_an_unknown_title_is_rejected_rather_than_producing_a_dead_link() {
    let app = App::default();
    assert!(app
        .share_targets("nope", "https://zeeflix.dpdns.org/")
        .is_empty());
    let targets = app.share_targets("steel", "https://zeeflix.dpdns.org/");
    assert_eq!(
        targets.len(),
        6,
        "all six targets should be present for a real title"
    );
    // Every target carries the deep link; most also carry the title. Facebook
    // only accepts a URL, so the id is the common denominator.
    assert!(targets
        .iter()
        .all(|t: &ShareTarget| t.url.contains("title%2Fsteel") || t.url.contains("steel")));
}

#[test]
fn install_link_and_qr_target_are_consistent_with_the_repository() {
    let app = App::default();
    let install = app.install_url("https://zeeflix.dpdns.org/");
    assert_eq!(install, "https://zeeflix.dpdns.org/install.html");
    // A base without a trailing slash must still produce one directory level.
    assert_eq!(
        app.install_url("https://flixybuild-lgtm.github.io/ZeeFlix"),
        "https://flixybuild-lgtm.github.io/ZeeFlix/install.html"
    );
}

#[test]
fn title_page_renders_a_share_sheet_and_a_ranked_related_rail() {
    let app = App::default();
    let html = app.page("title/sintel");

    // Share sheet is present exactly once, with the base token left for the client.
    assert_eq!(html.matches("class=\"share-sheet\"").count(), 1);
    assert!(
        html.contains("{{base}}"),
        "base token must be patchable by the client"
    );
    assert!(
        !html.contains("{{icon:"),
        "no unresolved icon tokens may leak"
    );
    for need in [
        "data-act=\"share-native\"",
        "data-act=\"copy-link\"",
        "data-act=\"download-poster\"",
    ] {
        assert!(html.contains(need), "share sheet missing {need}");
    }
    // Every outbound target is a real, encoded URL.
    for host in [
        "wa.me",
        "twitter.com/intent",
        "t.me/share",
        "reddit.com/submit",
        "facebook.com/sharer",
    ] {
        assert!(html.contains(host), "share sheet missing {host}");
    }

    // Ranked related rail, replacing the old "one genre" dump.
    assert_eq!(html.matches("More like this").count(), 1);
    assert!(html.contains("related-shelf"), "related rail class missing");
    assert!(
        !html.contains("Tears of Steel</h2>"),
        "must not recommend the current title"
    );

    // The action row offers a share button.
    assert!(html.contains("data-act=\"open-share\" data-id=\"sintel\""));
}

#[test]
fn search_page_exposes_type_and_sort_controls_and_honours_them() {
    let mut app = App::default();
    let html = app.page("search");
    assert!(html.contains("id=\"kind-filter\""));
    assert!(html.contains("id=\"sort-filter\""));
    for option in ["newest", "oldest", "shortest", "longest", "title"] {
        assert!(
            html.contains(&format!("value=\"{option}\"")),
            "missing sort option {option}"
        );
    }

    // The command surface used by app.js must reflect the selection in the caption.
    let newest = app.command("results\n\n\n\n\nMovies\nnewest");
    assert!(
        newest.contains("newest first"),
        "caption should name the sort: {newest:.200}"
    );
    let docs = app.command("results\n\n\n\n\nDocumentaries\ndefault");
    assert!(
        docs.contains("<h2>Documentaries</h2>"),
        "heading should follow the kind"
    );
    assert!(!docs.contains("charge"), "Charge is not a documentary");

    // Backwards compatible 5-argument call still works.
    let legacy = app.command("results\nsteel\n\n\n");
    assert!(legacy.contains("Tears of Steel"));
}

#[test]
fn share_and_related_commands_are_safe_for_bad_input() {
    let mut app = App::default();
    assert!(app
        .command("share\nnope\nhttps://zeeflix.dpdns.org/")
        .is_empty());
    assert!(app.command("related\nnope\n4").is_empty());
    assert!(app
        .command("related\nsintel\nnot-a-number")
        .contains("More like this"));
    // A base with a path and no trailing slash still composes correctly.
    assert!(app
        .command("share\nsintel\nhttps://flixybuild-lgtm.github.io/ZeeFlix")
        .contains("https://flixybuild-lgtm.github.io/ZeeFlix/title/sintel.html#title/sintel"));
}

// ---------------------------------------------------------------------------
// Crawlable share pages. A share link must work for people who open it from a
// chat app, and must be describable to search engines and social scrapers.
// ---------------------------------------------------------------------------

#[test]
fn a_share_link_opens_a_canonical_title_page_with_social_metadata() {
    let app = App::default();
    let html = app.title_document("sintel", "https://zeeflix.dpdns.org/");
    // A share link must never be a 404 for a crawler that ignores the fragment.
    assert!(html.contains("<h1>Sintel</h1>"), "should render the title");
    assert!(
        html.contains(
            r#"<link rel="canonical" href="https://zeeflix.dpdns.org/title/sintel.html#title/sintel">"#
        ),
        "canonical must point at the shareable fragment"
    );
    for need in [
        r#"<meta property="og:type" content="video.movie">"#,
        r#"<meta property="og:title" content="Sintel — free open film on Framewave">"#,
        r#"<meta property="og:image" content="https://zeeflix.dpdns.org/art/sintel.webp">"#,
        r#"<meta name="twitter:card" content="summary_large_image">"#,
        r#"application/ld+json"#,
        r#""@type":"Movie""#,
        r#""datePublished":"2010""#,
    ] {
        assert!(html.contains(need), "metadata missing: {need}");
    }
    // Structured data must be valid JSON with no stray markup.
    let start = html.find("application/ld+json").unwrap();
    let body = &html[start..];
    let open = start + body.find('>').unwrap() + 1;
    let close = open + html[open..].find("</script>").unwrap();
    let json = &html[open..close];
    assert!(json.trim_start().starts_with('{') && json.trim_end().ends_with('}'));
    assert!(!json.contains('<'), "JSON-LD must not contain markup");
}

#[test]
fn an_unknown_share_id_renders_a_recoverable_page_not_a_dead_end() {
    let app = App::default();
    let html = app.title_document("does-not-exist", "https://zeeflix.dpdns.org/");
    assert!(
        html.contains("Title unavailable") || html.contains("noindex"),
        "an unknown id must not be indexed as a real film"
    );
    assert!(
        html.contains(r##"href="#movies""##),
        "must offer a way back into the library"
    );
}

#[test]
fn the_sitemap_lists_the_library_and_every_title_once() {
    let app = App::default();
    let base = "https://zeeflix.dpdns.org";
    let xml = app.sitemap(base);
    assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(xml.trim_end().ends_with("</urlset>"));
    assert_eq!(xml.matches("<url>").count(), xml.matches("</url>").count());
    assert!(xml.contains(&format!("<loc>{base}/</loc>")));
    // One <loc> per route, no duplicates.
    let locs: Vec<&str> = xml
        .split("<loc>")
        .skip(1)
        .map(|s| s.split("</loc>").next().unwrap())
        .collect();
    let mut unique = locs.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(locs.len(), unique.len(), "sitemap has duplicate urls");
    assert!(xml.contains(&format!("<loc>{base}/title/sintel.html</loc>")));
    // Depth: the library plus every advertised route.
    assert!(locs.len() >= app.titles().len() + 5, "sitemap is too thin");
    // A base with a trailing slash must not double up.
    assert_eq!(app.sitemap(&format!("{base}/")), xml);
}

#[test]
fn the_title_document_is_the_prerendered_page_plus_head_tags() {
    let app = App::default();
    let base = "https://zeeflix.dpdns.org/";
    let doc = app.title_document("spring", base);
    // The body is the same markup the in-app router injects, so hydration agrees.
    assert!(doc.contains(&app.page("title/spring")));
    // Titles are escaped where they appear in attributes.
    let doc = app.title_document("spring", base);
    assert_eq!(doc.matches("<h1>").count(), 1, "one H1 per share page");
}

#[test]
fn auto_stream_format_uses_path_not_query() {
    use zeeflix::Provider;
    for (url, expected) in [
        ("https://example.org/live.M3U8?x=.mp4", "hls"),
        ("https://example.org/live.mpd", "dash"),
        ("https://example.org/a.webm", "webm"),
        ("https://example.org/a.mp4", "mp4"),
        ("https://player.vimeo.com/video/123", "embed"),
    ] {
        let p = Provider::new("Screening", url, "auto", true).unwrap();
        assert_eq!(p.format, expected);
        assert_eq!(p.download, matches!(expected, "webm" | "mp4"));
    }
}
