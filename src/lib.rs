mod model;
mod pages;
mod view;
#[cfg(target_arch = "wasm32")]
mod wasm;
pub use model::*;
pub use view::{esc, icon};
impl App {
    /// The small string boundary keeps the DOM glue independent from the domain model.
    pub fn command(&mut self, input: &str) -> String {
        if let Some(raw) = input.strip_prefix("load\n") {
            *self = Self::restore(raw);
            return String::new();
        }
        let v: Vec<_> = input.split('\n').collect();
        if let Some(s) = self.mutate(&v) {
            return s;
        }
        match v.as_slice() {
            ["dump"] => self.pack(),
            ["prefs"] => format!(
                "{}\n{}\n{}",
                self.splash as u8, self.autoplay as u8, self.theme
            ),
            ["page", route] => self.page(route),
            ["hero", n] => self.hero(n.parse().unwrap_or(0)),
            ["feed", genre] => self.feed(genre),
            ["chips", genre] => self.chips(genre),
            // results · query · genre · actor · year · kind · sort
            ["results", q, g, a, y, kind, sort] => self.results(Filter {
                query: q,
                genre: g,
                actor: a,
                year: y,
                kind,
                sort: Sort::parse(sort),
            }),
            ["results", q, g, a, y] => self.results(Filter {
                query: q,
                genre: g,
                actor: a,
                year: y,
                ..Filter::default()
            }),
            ["related", id, limit] => self.related_rail(id, limit.parse().unwrap_or(4)),
            ["share", id, base] => self.share_sheet(id, base),
            ["detail", id] => self.detail(id),
            ["player", id] => self.player(id),
            ["bridge-player", name, url] => self.bridge_player(name, url),
            ["editor", id] => self.editor(id),
            ["saved", id] => u8::from(self.list.contains(*id)).to_string(),
            _ => "Unrecognized request.".into(),
        }
    }
}
