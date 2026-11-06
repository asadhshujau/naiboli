// Caps build parallelism on EAS Build workers only, so the 4 vCPU / 15.6 GB Android worker doesn't run out of memory.
//
// Each native (CMake) build — Reanimated, Worklets, Skia, expo-modules-core — runs ninja, which starts nproc + 2
// clang jobs by default; Skia's are the heaviest. That sits on top of the 4 GB Gradle heap EAS sets (GRADLE_OPTS)
// and a Kotlin daemon. When it runs out, the OOM killer takes the Gradle process ("Gradle build daemon disappeared
// unexpectedly").
// - 2 Gradle workers: passed once (2026-11-05), then failed twice after expo-updates + netinfo were added, both
//   times while Worklets and Skia compiled C++ side by side.
// - 1 Gradle worker: the dev build passed (035a8d18), but the first production build (d868054c, 2026-11-06) still
//   died in Skia's arm64 compile: one CMake build at a time, but still 6 clang jobs, after R8 (release only) had
//   filled the Gradle heap.
// - So also cap ninja itself with CMake job pools: at most 2 compiles and 1 link at once in every CMake module.
// Local builds are left alone.
const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

const LIMITS = {
  'org.gradle.workers.max': '1',
  'kotlin.daemon.jvmargs': '-Xmx2g -XX:MaxMetaspaceSize=512m',
};

const MARK = '// naiboli: EAS CMake job pools';
// Same hook Expo's root project plugin uses for CMAKE_OBJECT_PATH_MAX: append to every Android module's
// defaultConfig CMake arguments. Modules without CMake ignore them.
const CMAKE_JOB_POOLS = `
${MARK} (plugins/withEasGradleLimits.js)
allprojects { p ->
  p.pluginManager.withPlugin("com.android.base") {
    p.extensions.findByType(com.android.build.api.dsl.CommonExtension)
      ?.defaultConfig?.externalNativeBuild?.cmake?.arguments?.addAll([
      "-DCMAKE_JOB_POOLS=compile=2;link=1",
      "-DCMAKE_JOB_POOL_COMPILE=compile",
      "-DCMAKE_JOB_POOL_LINK=link"
    ])
  }
}
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withEasGradleLimits(config) {
  if (process.env.EAS_BUILD !== 'true') return config;
  config = withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(LIMITS)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARK)) {
      cfg.modResults.contents += CMAKE_JOB_POOLS;
    }
    return cfg;
  });
};
