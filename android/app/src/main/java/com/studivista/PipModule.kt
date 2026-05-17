package com.studivista

import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PipModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "StudivistaPip"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  @ReactMethod
  fun setAutoPipEnabled(enabled: Boolean) {
    MainActivity.autoPipEnabled = enabled
  }

  @ReactMethod
  fun setOrientation(orientation: String) {
    val activity = reactContext.currentActivity ?: return
    activity.requestedOrientation = when (orientation) {
      "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
      "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
      else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    }
  }

  @ReactMethod
  fun enterPip(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }

    val activity = reactContext.currentActivity as? MainActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "MainActivity is not available.")
      return
    }

    promise.resolve(activity.enterStudivistaPip())
  }
}
