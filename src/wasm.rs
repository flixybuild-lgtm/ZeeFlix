//! The host only copies UTF-8 into this module's bounded buffer. No host pointers or unsafe Rust.
use crate::App;
use std::cell::RefCell;
thread_local! {static APP: RefCell<App> = RefCell::new(App::default()); static IO: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };}
#[no_mangle]
pub extern "C" fn input_buffer(n: usize) -> *mut u8 {
    IO.with_borrow_mut(|b| {
        b.resize(n.min(524288), 0);
        b.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn dispatch() -> *const u8 {
    IO.with_borrow_mut(|b| {
        let answer = std::str::from_utf8(b)
            .map(|s| APP.with_borrow_mut(|a| a.command(s)))
            .unwrap_or_default();
        *b = answer.into_bytes();
        b.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn result_len() -> usize {
    IO.with_borrow(Vec::len)
}
