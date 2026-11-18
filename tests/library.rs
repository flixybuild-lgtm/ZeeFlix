use zeeflix::{safe_source, App, Filter, Provider};

#[test]
fn catalogue_is_unique_and_art_exists() {
    let a = App::default();
    let titles = a.titles();
    let ids: std::collections::HashSet<_> = titles.iter().map(|m| &m.id).collect();
    assert_eq!(ids.len(), titles.len());
    for title in titles {
        assert!(std::path::Path::new(&format!("public/art/{}.webp", title.art)).exists());
    }
}
#[test]
fn search_intersects_filters_and_ignores_case() {
    let a = App::default();
    let f = Filter {
        query: "  STEEL  ",
        genre: "Sci-Fi",
        actor: "Derek de Lint",
        year: "2012",
    };
    assert_eq!(a.search(&f)[0].id, "steel");
    assert!(a.search(&Filter { year: "2022", ..f }).is_empty());
}
#[test]
fn persisted_library_and_resume_roundtrip() {
    let mut a = App::default();
    a.command("list\nsteel");
    a.command("favorite\nsintel");
    a.command("progress\nsintel\n32\n888");
    let b = App::restore(&a.pack());
    assert!(b.list.contains("steel"));
    assert!(b.favorites.contains("sintel"));
    assert_eq!(b.resume("sintel"), 32);
}
#[test]
fn completed_films_remain_in_history_not_continue() {
    let mut a = App::default();
    a.command("progress\nsteel\n733\n734");
    assert_eq!(a.resume("steel"), 0);
    assert_eq!(a.history.len(), 1);
    a.command("clear-history");
    assert!(a.history.is_empty());
}
#[test]
fn provider_rights_and_enablement_are_enforced() {
    let mut a = App::default();
    let entry = Provider::new("A & B", "media/sintel.webm", "webm", true).unwrap();
    let id = a.add_provider(entry).unwrap();
    assert!(a.find(&id).unwrap().download);
    a.command(&format!("enable\n{id}"));
    assert!(a.find(&id).is_none());
    let b = App::restore(&a.pack());
    assert!(!b.providers[0].enabled);
}
#[test]
fn providers_reject_unsafe_urls_and_downloads_for_embeds() {
    for s in [
        "javascript:alert(1)",
        "http://example.com/a",
        "https://a:b@example.com/film",
        "//evil.com/",
        "media/../x",
        "https://x.com/\nnext",
    ] {
        assert!(!safe_source(s));
    }
    assert!(Provider::new("my video", "https://example.com/player", "embed", true).is_err());
    assert!(
        !Provider::new("my video", "https://example.com/main.m3u8", "hls", true)
            .unwrap()
            .download
    );
}
#[test]
fn bad_state_is_bounded_and_ignored() {
    let a = App::restore(
        "v1\npos\tsteel\tnan\t999\nsource\tx\t<\tjavascript:x\tmp4\t1\t1\nlist\tbogus",
    );
    assert!(a.history.is_empty());
    assert!(a.providers.is_empty());
    assert!(a.list.is_empty());
}
#[test]
fn pages_and_episodes_are_base_relative() {
    let mut a = App::default();
    let about = a.command("page\nabout");
    assert!(about.contains("About ZeeFlix"));
    assert!(about.contains("Zeeshan Haider"));
    assert!(about.contains("9th Class"));
    assert!(about.contains("Government High School No. 1"));
    assert!(about.contains("Waqas Ashraf"));
    assert!(about.contains("ZeeFlix is a modern entertainment platform created by Zeeshan Haider, a 9th-class student at Government High School No. 1."));
    assert!(about.contains("The project focuses on modern technology, fast performance, smooth video playback, and a beautiful entertainment experience."));
    let home = a.command("page\nhome");
    for shelf in [
        "Trending Now",
        "Popular Movies",
        "Popular Series",
        "Recently Added",
        "Action",
        "Adventure",
        "Science Fiction",
        "Horror",
        "Comedy",
        "Romance",
        "Documentaries",
    ] {
        assert!(home.contains(shelf), "home missing shelf {shelf}");
    }
    assert!(home.contains("sintel-wide.webp") || home.contains("steel-wide.webp"));
    let p = a.command("player\ngran-dillama");
    assert!(p.contains("llamigos"));
    assert!(!p.contains("src=\"/"));
}
#[test]
fn provider_crud_and_xss_escaping() {
    let mut a = App::default();
    assert_eq!(
        a.command("provider\n\n<script>alert(1)</script>\nhttps://example.com/film.mp4\nmp4\t1\tauthorized"),
        "Unrecognized request."
    );
    assert_eq!(
        a.command(
            "provider\n\n<script>x</script>\nhttps://example.com/film.mp4\nmp4\n1\nauthorized"
        ),
        "ok"
    );
    let html = a.command("page\nproviders");
    assert!(html.contains("&lt;script&gt;x&lt;/script&gt;"));
    assert!(!html.contains("<script>x</script>"));
    assert_eq!(a.command("delete\ncustom-1"), "ok");
    assert!(a.find("custom-1").is_none());
}
