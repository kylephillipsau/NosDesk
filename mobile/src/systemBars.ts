/**
 * Android system bar appearance. Deliberately NOT exported from `index.ts`:
 * the frontend imports this as `@nosdesk/mobile/system-bars` (the `"./*"`
 * exports map) so a theme change never pulls the bootstrap graph into its
 * chunk.
 *
 * Android only in effect. The Rust plugin is a no-op on iOS (WKWebView takes
 * its bar appearance from the webview background the app already sets) and on
 * the desktop shell, so callers need no platform check.
 */
import { invoke } from '@tauri-apps/api/core'

/** `dark` describes the app's own surface, not the system setting. */
export async function setSystemBarAppearance(dark: boolean): Promise<void> {
  try {
    await invoke('plugin:system-bars|set_appearance', { payload: { dark } })
  } catch {
    // Plugin absent (desktop shell): bar appearance is polish, not signal.
  }
}
