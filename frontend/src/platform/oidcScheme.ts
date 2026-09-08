/**
 * Web-safe accessor for this build's OIDC callback URIs.
 *
 * The scheme is not a constant: the Android debug variant uses `nosdesk.debug`
 * so its callback cannot be confused with the Play build's `nosdesk`. The
 * native side owns the value (it is decided by the build variant), so the web
 * never asks and never loads the `@nosdesk/mobile` chunk.
 */
import { isTauriRuntime } from './index'

export async function nativeLogoutRedirectUri(): Promise<string> {
  if (!isTauriRuntime()) throw new Error('native-only')
  const m = await import('@nosdesk/mobile/oidc')
  return m.logoutRedirectUri()
}
