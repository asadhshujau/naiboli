// Caps Gradle's parallelism and the Kotlin daemon's heap on EAS Build workers only.
//
// The 4 vCPU / 15.6 GB Android worker ran out of memory while Gradle ran several native (CMake) builds at once
// (Reanimated, Worklets, Skia, expo-modules-core): each starts its own ninja/clang jobs, on top of the 4 GB
// Gradle heap EAS sets and a Kotlin daemon that inherits it. The OOM killer took the Gradle daemon
// ("Gradle build daemon disappeared unexpectedly"). Local builds are left alone.
const { withGradleProperties } = require('expo/config-plugins');

const LIMITS = {
  'org.gradle.workers.max': '2',
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
