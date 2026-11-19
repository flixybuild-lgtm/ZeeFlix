use std::{env, fs, path::PathBuf};
use zeeflix::{icon, App};

/// Deployment base used for canonical URLs, Open Graph tags and the sitemap.
/// Defaults to the GitHub Pages URL so a plain `npm run build` still produces a
/// shareable, indexable site; override with ZEEFLIX_BASE_URL on a custom domain.
fn base() -> String {
    env::var("ZEEFLIX_BASE_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| "https://flixybuild-lgtm.github.io/ZeeFlix/".into())
}

fn main() {
    let out = PathBuf::from(env::args().nth(1).unwrap_or_else(|| "dist".into()));
    fs::create_dir_all(&out).unwrap();
    let app = App::default();
    let base = base();
    let mut page =
        include_str!("../../templates/index.html").replace("{{home}}", &app.page("home"));
    page = page
        .replace("{{base}}", "/")
        .replace("{{canonical}}", &base);
    while let Some(start) = page.find("{{icon:") {
        let end = start + page[start..].find("}}").unwrap();
        let i = icon(&page[start + 7..end]);
        page.replace_range(start..end + 2, &i);
    }
    // The home page must not keep an absolute canonical pointing at a stale host.
    assert!(
        !page.contains("{{canonical}}"),
        "canonical token left unresolved"
    );
    fs::write(out.join("index.html"), page).unwrap();

    // One crawlable document per title, plus the sitemap and robots file that
    // point at them. `title/<id>.html` also works when a link is opened without
    // the fragment, because every page redirects on load.
    let titles = out.join("title");
    fs::create_dir_all(&titles).unwrap();
    for film in app.titles() {
        fs::write(
            titles.join(format!("{}.html", film.id)),
            app.title_document(&film.id, &base),
        )
        .unwrap();
    }
    fs::write(out.join("sitemap.xml"), app.sitemap(&base)).unwrap();
    fs::write(
        out.join("robots.txt"),
        format!("User-agent: *\nAllow: /\n\nSitemap: {}sitemap.xml\n", base),
    )
    .unwrap();
    println!("prerendered {} title pages for {base}", app.titles().len());
}
