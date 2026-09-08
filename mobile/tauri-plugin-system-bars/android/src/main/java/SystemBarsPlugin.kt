package com.nosdesk.plugin.systembars

import android.app.Activity
import androidx.core.view.WindowCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class AppearanceArgs {
    var dark: Boolean = false
}

/**
 * Keeps the status and navigation bar icons legible.
 *
 * The activity draws edge to edge, so both bars sit over the app's own
 * background. `enableEdgeToEdge()` picks the icon colour once at `onCreate`
 * from the system dark-mode setting, which is unrelated to the theme the user
 * chose inside the app: a light phone running the app in dark mode ends up with
 * dark icons on a dark header. The frontend calls this whenever its effective
 * theme changes, and on startup.
 *
 * `isAppearanceLight*` is inverted on purpose: light bars mean dark icons, so a
 * dark app surface asks for `false`.
 */
@TauriPlugin
class SystemBarsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun setAppearance(invoke: Invoke) {
        val args = invoke.parseArgs(AppearanceArgs::class.java)
        // Window decor calls must happen on the UI thread; Tauri commands do not.
        activity.runOnUiThread {
            val controller =
                WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.isAppearanceLightStatusBars = !args.dark
            controller.isAppearanceLightNavigationBars = !args.dark
        }
        invoke.resolve()
    }
}
