use std::{env, fs, path::PathBuf};
use zeeflix::{icon, App};
fn main() {
    let out = PathBuf::from(env::args().nth(1).unwrap_or_else(|| "dist".into()));
    fs::create_dir_all(&out).unwrap();
    let mut page = include_str!("../../templates/index.html")
        .replace("{{home}}", &App::default().page("home"));
    page = page.replace("{{base}}", "/");
    while let Some(start) = page.find("{{icon:") {
        let end = start + page[start..].find("}}").unwrap();
        let i = icon(&page[start + 7..end]);
        page.replace_range(start..end + 2, &i);
    }
    fs::write(out.join("index.html"), page).unwrap();
}
