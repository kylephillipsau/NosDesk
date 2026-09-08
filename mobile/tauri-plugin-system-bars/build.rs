const COMMANDS: &[&str] = &["set_appearance"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
