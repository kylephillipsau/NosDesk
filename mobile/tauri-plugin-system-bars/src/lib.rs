//! Matches the Android system bar icons to the app's own theme.
//!
//! The app draws edge to edge (`MainActivity.enableEdgeToEdge()`), so the
//! status and navigation bars sit over the app's own background. Android
//! decides the icon colour once, at `onCreate`, from the *system* dark mode
//! setting. Our theme is a user preference that has nothing to do with the
//! system one, so a light phone running the app in dark mode gets dark icons on
//! a dark header, and they vanish.
//!
//! Android only. iOS drives bar appearance from the WebView's own background
//! (see the `LaunchBackground` work in the app's `lib.rs`), and desktop has no
//! system bars, so both get the no-op.

use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(target_os = "android")]
mod android;
#[cfg(not(target_os = "android"))]
mod noop;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(target_os = "android")]
use android::SystemBars;
#[cfg(not(target_os = "android"))]
use noop::SystemBars;

/// Extensions to access the system-bars APIs from a [`tauri::Manager`].
pub trait SystemBarsExt<R: Runtime> {
  fn system_bars(&self) -> &SystemBars<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SystemBarsExt<R> for T {
  fn system_bars(&self) -> &SystemBars<R> {
    self.state::<SystemBars<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("system-bars")
    .invoke_handler(tauri::generate_handler![commands::set_appearance])
    .setup(|app, api| {
      #[cfg(target_os = "android")]
      let system_bars = android::init(app, api)?;
      #[cfg(not(target_os = "android"))]
      let system_bars = noop::init(app, api)?;
      app.manage(system_bars);
      Ok(())
    })
    .build()
}
