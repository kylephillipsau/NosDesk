const COMMANDS: &[&str] = &[
  "request_permission",
  "check_permission",
  "open_settings",
  "get_token",
  "get_pending_notification",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
