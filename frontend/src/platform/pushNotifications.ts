/**
 * Web-safe facade over native push permission.
 *
 * On the web this reports `unsupported` and the `@nosdesk/mobile` chunk is never
 * loaded, so the settings screen keeps its browser behaviour. Under Tauri it
 * lazily pulls the module and talks to the push plugin.
 *
 * There is deliberately no web branch here: the browser banner uses the
 * foreground `Notification` API, which is a different thing from Web Push, and
 * the product implements no service worker or VAPID key. Reporting anything but
 * `unsupported` off-device would promise delivery that cannot happen.
 */
import { isTauriRuntime } from './index'

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** True where a native push stack exists at all. */
export function supportsNativePush(): boolean {
  return isTauriRuntime()
}

/** Current permission, without prompting. `unsupported` off-device. */
export async function checkPushPermission(): Promise<PushPermission> {
  if (!isTauriRuntime()) return 'unsupported'
  try {
    const m = await import('@nosdesk/mobile/push')
    return await m.checkPushPermission()
  } catch {
    return 'unsupported'
  }
}

/** Outcome of enabling push: permission is only half the story. */
export interface EnablePushResult {
  permission: PushPermission
  /** Whether a device token actually reached the backend. */
  registered: boolean
}

/**
 * Prompt, obtain a device token, and register it with the backend.
 *
 * This is the same call sign-in makes, so a user who declined the prompt then
 * changed their mind does not have to sign out and back in to get push.
 *
 * `registered` is reported separately because permission can be granted while
 * the POST fails, and a screen that claimed success on permission alone would
 * promise notifications that never arrive.
 */
export async function enableNativePush(): Promise<EnablePushResult> {
  if (!isTauriRuntime()) return { permission: 'unsupported', registered: false }
  try {
    const m = await import('@nosdesk/mobile/push')
    const registered = await m.registerForPush()
    return { permission: await m.checkPushPermission(), registered }
  } catch {
    return { permission: 'unsupported', registered: false }
  }
}

/** Open the OS notification settings for this app. */
export async function openPushSettings(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    const m = await import('@nosdesk/mobile/push')
    await m.openPushSettings()
  } catch {
    // Nothing to fall back to; the UI already told them where to go.
  }
}
