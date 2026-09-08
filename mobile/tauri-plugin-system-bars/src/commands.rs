use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::SystemBarsExt;

#[command]
pub(crate) async fn set_appearance<R: Runtime>(
  app: AppHandle<R>,
  payload: AppearanceRequest,
) -> Result<()> {
  app.system_bars().set_appearance(payload)
}
