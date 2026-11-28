// Expo config plugin: cap how many C++ compile/link jobs each native Android library runs at once.
//
// Ninja (used by the Android Gradle Plugin for CMake builds) defaults to one job per CPU + 2.
// On the 16 GB EAS free builder, @shopify/react-native-skia's C++ compile at that parallelism
// (alongside Reanimated, Worklets and Screens) ran the machine out of memory or stalled it until
// the 45-minute build timeout. A CMake job pool limits Ninja to `jobs` compiles/links per library.
//
// Only library modules are touched: the app module is evaluated early by React Native's root
// project plugin, and its own C++ build is small.
const { withProjectBuildGradle } = require('expo/config-plugins');

const TAG = 'liftio-native-build-jobs';

function addNativeJobPool(buildGradle, jobs) {
  if (buildGradle.includes(`@generated begin ${TAG}`)) return buildGradle;
  // A single pool for compile and link keeps the -D values free of `;`, which CMake would read as a
  // list separator if it were split on the way from Gradle to the cmake command line.
  const block = `
// @generated begin ${TAG} - expo prebuild (DO NOT MODIFY)
subprojects { sub ->
  sub.plugins.withId("com.android.library") {
    try {
      sub.android.defaultConfig.externalNativeBuild.cmake.arguments(
        "-DCMAKE_JOB_POOLS=native=${jobs}",
        "-DCMAKE_JOB_POOL_COMPILE=native",
        "-DCMAKE_JOB_POOL_LINK=native"
      )
    } catch (Exception e) {
      sub.logger.warn("${TAG}: could not limit native build jobs for \${sub.path}: \${e.message}")
    }
  }
}
// @generated end ${TAG}
`;
  // Register the hook before the Expo/React Native root plugins, which can evaluate modules early.
  const anchor = 'apply plugin: "expo-root-project"';
  const at = buildGradle.indexOf(anchor);
  if (at === -1) return buildGradle.trimEnd() + '\n' + block;
  return buildGradle.slice(0, at) + block.trimStart() + '\n' + buildGradle.slice(at);
}

function withNativeBuildJobs(config, { jobs = 2 } = {}) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(`${TAG}: expected a Groovy android/build.gradle, got ${cfg.modResults.language}`);
    }
    cfg.modResults.contents = addNativeJobPool(cfg.modResults.contents, jobs);
    return cfg;
  });
}

module.exports = withNativeBuildJobs;
module.exports.addNativeJobPool = addNativeJobPool;
