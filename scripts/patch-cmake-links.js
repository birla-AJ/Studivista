const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchFile(relativePath, replacementGroups) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  let source = fs.readFileSync(filePath, 'utf8');
  let next = source;

  for (const replacements of replacementGroups) {
    if (replacements.some(([, after]) => next.includes(after))) {
      continue;
    }

    const replacement = replacements.find(([before]) => next.includes(before));
    if (!replacement) {
      throw new Error(`Expected CMake block not found in ${relativePath}`);
    }

    const [before, after] = replacement;
    next = next.replace(before, after);
  }

  if (next !== source) {
    fs.writeFileSync(filePath, next);
    console.log(`Patched ${relativePath}`);
  }
}

patchFile('node_modules/react-native-worklets/android/CMakeLists.txt', [
  [
    [
      'target_link_libraries(worklets android log ReactAndroid::reactnative ReactAndroid::jsi\r\n                      fbjni::fbjni)',
      'target_link_libraries(worklets android log c++_shared ReactAndroid::reactnative\r\n                      ReactAndroid::jsi fbjni::fbjni)',
    ],
    [
      'target_link_libraries(worklets android log ReactAndroid::reactnative ReactAndroid::jsi\n                      fbjni::fbjni)',
      'target_link_libraries(worklets android log c++_shared ReactAndroid::reactnative\n                      ReactAndroid::jsi fbjni::fbjni)',
    ],
  ],
]);

patchFile('node_modules/react-native-reanimated/android/CMakeLists.txt', [
  [
    [
      'target_link_libraries(\r\n  reanimated\r\n  log\r\n  ReactAndroid::reactnative',
      'target_link_libraries(\r\n  reanimated\r\n  log\r\n  c++_shared\r\n  ReactAndroid::reactnative',
    ],
    [
      'target_link_libraries(\n  reanimated\n  log\n  ReactAndroid::reactnative',
      'target_link_libraries(\n  reanimated\n  log\n  c++_shared\n  ReactAndroid::reactnative',
    ],
  ],
]);

patchFile('node_modules/react-native-gesture-handler/android/src/main/jni/CMakeLists.txt', [
  [
    [
      'target_link_libraries(\r\n  ${PACKAGE_NAME}\r\n  ReactAndroid::reactnative',
      'target_link_libraries(\r\n  ${PACKAGE_NAME}\r\n  c++_shared\r\n  ReactAndroid::reactnative',
    ],
    [
      'target_link_libraries(\n  ${PACKAGE_NAME}\n  ReactAndroid::reactnative',
      'target_link_libraries(\n  ${PACKAGE_NAME}\n  c++_shared\n  ReactAndroid::reactnative',
    ],
  ],
]);

patchFile('node_modules/react-native-screens/android/CMakeLists.txt', [
  [
    [
      'target_link_libraries(rnscreens\r\n        ReactAndroid::reactnative',
      'target_link_libraries(rnscreens\r\n        c++_shared\r\n        ReactAndroid::reactnative',
    ],
    [
      'target_link_libraries(rnscreens\n        ReactAndroid::reactnative',
      'target_link_libraries(rnscreens\n        c++_shared\n        ReactAndroid::reactnative',
    ],
  ],
  [
    [
      'target_link_libraries(rnscreens\r\n        ReactAndroid::jsi',
      'target_link_libraries(rnscreens\r\n        c++_shared\r\n        ReactAndroid::jsi',
    ],
    [
      'target_link_libraries(rnscreens\n        ReactAndroid::jsi',
      'target_link_libraries(rnscreens\n        c++_shared\n        ReactAndroid::jsi',
    ],
  ],
]);

patchFile('node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt', [
  [
    [
      'target_link_libraries(\r\n  ${LIB_TARGET_NAME}\r\n  ReactAndroid::reactnative',
      'target_link_libraries(\r\n  ${LIB_TARGET_NAME}\r\n  c++_shared\r\n  ReactAndroid::reactnative',
    ],
    [
      'target_link_libraries(\n  ${LIB_TARGET_NAME}\n  ReactAndroid::reactnative',
      'target_link_libraries(\n  ${LIB_TARGET_NAME}\n  c++_shared\n  ReactAndroid::reactnative',
    ],
  ],
]);

patchFile('node_modules/react-native-audio-recorder-player/android/src/main/java/com/dooboolab.audiorecorderplayer/RNAudioRecorderPlayerModule.kt', [
  [
    [
      'ActivityCompat.requestPermissions((currentActivity)!!, arrayOf(',
      'ActivityCompat.requestPermissions((getCurrentActivity())!!, arrayOf(',
    ],
  ],
  [
    [
      'ActivityCompat.requestPermissions((currentActivity)!!, arrayOf(Manifest.permission.RECORD_AUDIO), 0)',
      'ActivityCompat.requestPermissions((getCurrentActivity())!!, arrayOf(Manifest.permission.RECORD_AUDIO), 0)',
    ],
  ],
  [
    [
      'mediaPlayer!!.setDataSource(currentActivity!!.applicationContext, Uri.parse(path), headers)',
      'mediaPlayer!!.setDataSource(reactContext.applicationContext, Uri.parse(path), headers)',
    ],
  ],
]);
