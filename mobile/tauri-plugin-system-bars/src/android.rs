use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

/// Registers the Kotlin plugin class.
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<SystemBars<R>> {
  let handle = api.register_android_plugin("com.nosdesk.plugin.systembars", "SystemBarsPlugin")?;
  Ok(SystemBars(handle))
}

/// Access to the system-bars APIs.
pub struct SystemBars<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> SystemBars<R> {
  pub fn set_appearance(&self, payload: AppearanceRequest) -> crate::Result<()> {
    self
      .0
      .run_mobile_plugin("setAppearance", payload)
      .map_err(Into::into)
  }
}
