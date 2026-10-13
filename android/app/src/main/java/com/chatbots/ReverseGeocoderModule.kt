package com.chatbots

import android.location.Address
import android.location.Geocoder
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

// Reverse geocoding with the phone's own Geocoder (Google location data on
// Android). It names the area / sub-locality (e.g. "Vijay Nagar") and the
// pincode, which OpenStreetMap often lacks for Indian cities — there a GPS
// fix came back as just "Indore, Madhya Pradesh".
class ReverseGeocoderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ReverseGeocoder"

  @ReactMethod
  fun reverse(latitude: Double, longitude: Double, promise: Promise) {
    if (!Geocoder.isPresent()) {
      promise.reject("GEOCODER_UNAVAILABLE", "Geocoder is not available on this device.")
      return
    }
    val geocoder = Geocoder(reactApplicationContext, Locale.ENGLISH)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        geocoder.getFromLocation(latitude, longitude, 1, object : Geocoder.GeocodeListener {
          override fun onGeocode(addresses: MutableList<Address>) {
            resolveFirst(addresses, promise)
          }

          override fun onError(errorMessage: String?) {
            promise.reject("GEOCODE_FAILED", errorMessage ?: "Could not look up this location.")
          }
        })
      } else {
        // The pre-33 call blocks on the network, so keep it off the JS thread.
        Thread {
          try {
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(latitude, longitude, 1)
            resolveFirst(addresses ?: emptyList(), promise)
          } catch (error: Exception) {
            promise.reject("GEOCODE_FAILED", error.message, error)
          }
        }.start()
      }
    } catch (error: Exception) {
      promise.reject("GEOCODE_FAILED", error.message, error)
    }
  }

  private fun resolveFirst(addresses: List<Address>, promise: Promise) {
    val address = addresses.firstOrNull()
    if (address == null) {
      promise.resolve(null)
      return
    }
    promise.resolve(Arguments.createMap().apply {
      putString("thoroughfare", address.thoroughfare)
      putString("subThoroughfare", address.subThoroughfare)
      putString("featureName", address.featureName)
      putString("subLocality", address.subLocality)
      putString("locality", address.locality)
      putString("subAdminArea", address.subAdminArea)
      putString("adminArea", address.adminArea)
      putString("postalCode", address.postalCode)
      putString("countryName", address.countryName)
      putString("addressLine", if (address.maxAddressLineIndex >= 0) address.getAddressLine(0) else null)
    })
  }
}
