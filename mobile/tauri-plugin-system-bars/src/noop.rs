use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<SystemBars<R>> {
  Ok(SystemBars(app.clone()))
}

/// Everywhere that is not Android.
///
/// iOS takes its bar appearance from the WebView's background colour, which the
/// app already sets, and desktop has no system bars. Calling this is harmless
/// so the frontend does not need a platform check of its own.
pub struct SystemBars<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> SystemBars<R> {
  pub fn set_appearance(&self, _payload: AppearanceRequest) -> crate::Result<()> {
    Ok(())
  }
}
