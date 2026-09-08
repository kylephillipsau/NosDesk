/**
 * Web-safe system bar facade. On the web this is a guaranteed no-op and the
 * `@nosdesk/mobile` chunk is never loaded; under Tauri it lazily pulls the
 * module and tells the native side which way the app's own surface is painted.
 *
 * Fire-and-forget: a theme change must never wait on the window decor.
 */
import { isTauriRuntime } from './index'

export function setSystemBarAppearance(dark: boolean): void {
  if (!isTauriRuntime()) return
  void import('@nosdesk/mobile/systemBars')
    .then((m) => m.setSystemBarAppearance(dark))
    .catch(() => {
      // Plugin absent (desktop dev shell) — bar contrast is polish.
    })
}
