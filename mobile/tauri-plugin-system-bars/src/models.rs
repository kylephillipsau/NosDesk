use serde::{Deserialize, Serialize};

/// Whether the app is currently painting a dark surface behind the system bars.
/// `true` asks for light (white) icons, `false` for dark ones.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceRequest {
  pub dark: bool,
}
