// Caps Gradle's parallelism and the Kotlin daemon's heap on EAS Build workers only.
//
// The 4 vCPU / 15.6 GB Android worker runs out of memory while Gradle runs several native (CMake) builds at once
// (Reanimated, Worklets, Skia, expo-modules-core): each starts its own ninja/clang jobs (nproc + 2 each), on top
// of the 4 GB Gradle heap EAS sets (GRADLE_OPTS) and a Kotlin daemon. The OOM killer takes the Gradle process
// ("Gradle build daemon disappeared unexpectedly").
// - 2 workers: passed once (2026-11-05), then failed twice after expo-updates + netinfo were added, both times
//   while Worklets and Skia compiled C++ side by side.
// - 1 worker: one task at a time, so only one CMake build's clang jobs exist at any moment. Slower, but fits.
// Local builds are left alone.
const { withGradleProperties } = require('expo/config-plugins');

const LIMITS = {
  'org.gradle.workers.max': '1',
  'kotlin.daemon.jvmargs': '-Xmx2g -XX:MaxMetaspaceSize=512m',
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withEasGradleLimits(config) {
  if (process.env.EAS_BUILD !== 'true') return config;
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(LIMITS)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
