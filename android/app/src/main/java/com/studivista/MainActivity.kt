package com.studivista

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Build
import android.util.Rational
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {
  companion object {
    @JvmStatic
    var autoPipEnabled: Boolean = false
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Studivista"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  fun enterStudivistaPip(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || isFinishing) return false
    if (isInPictureInPictureMode) return true

    val params = PictureInPictureParams.Builder()
      .setAspectRatio(Rational(16, 9))
      .build()

    return enterPictureInPictureMode(params)
  }

  override fun onUserLeaveHint() {
    if (autoPipEnabled) {
      enterStudivistaPip()
      return
    }
    super.onUserLeaveHint()
  }

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    try {
      (application as? MainApplication)?.reactHost?.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("StudivistaPipModeChanged", isInPictureInPictureMode)
    } catch (_: Throwable) {
      // PiP transitions can run while the React context is not ready; never crash the call.
    }
  }
}
