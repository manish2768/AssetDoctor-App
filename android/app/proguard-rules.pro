# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-svg
-dontwarn com.horcrux.svg.**
-keep class com.horcrux.svg.** { *; }

# react-native-gesture-handler
-dontwarn com.swmansion.gesturehandler.**
-keep class com.swmansion.gesturehandler.** { *; }

# react-native-screens
-dontwarn com.swmansion.rnscreens.**
-keep class com.swmansion.rnscreens.** { *; }

# @react-native-firebase
-dontwarn io.invertase.firebase.**
-keep class io.invertase.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-keepattributes *Annotation*
-keepattributes Signature

# @react-native-google-signin
-dontwarn com.reactnativegooglesignin.**
-keep class com.reactnativegooglesignin.** { *; }

# expo-modules
-dontwarn expo.modules.**
-keep class expo.modules.** { *; }

# react-native-view-shot
-dontwarn fr.greweb.reactnativeviewshot.**
-keep class fr.greweb.reactnativeviewshot.** { *; }

# react-native-document-scanner-plugin
-dontwarn com.reactnativedocumentscannerplugin.**
-keep class com.reactnativedocumentscannerplugin.** { *; }

# react-native-haptic-feedback
-dontwarn com.mkuczera.**
-keep class com.mkuczera.** { *; }

# react-native-share
-dontwarn cl.json.**
-keep class cl.json.** { *; }

# lottie-react-native
-dontwarn com.airbnb.lottie.**
-keep class com.airbnb.lottie.** { *; }

# @react-native-ml-kit/text-recognition & Google ML Kit
-dontwarn com.rnmlkit.textrecognition.**
-keep class com.rnmlkit.textrecognition.** { *; }
-dontwarn com.google.mlkit.vision.text.**
-keep class com.google.mlkit.vision.text.** { *; }
-keep class com.google.android.gms.vision.** { *; }

