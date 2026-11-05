/**
 * Runtime fingerprint (`runtimeVersion.policy: "fingerprint"`): only things that change the native app count.
 * On top of Expo's default skips (versions, eas.json, .easignore, autolinking paths, …), package.json scripts and
 * .gitignore are skipped too, so editing them never cuts OTA updates off from installed builds.
 * @type {import('expo/fingerprint').Config}
 */
const { SourceSkips: S } = require('expo/fingerprint');

module.exports = {
  sourceSkips:
    S.ExpoConfigVersions |
    S.ExpoConfigRuntimeVersionIfString |
    S.PackageJsonAndroidAndIosScriptsIfNotContainRun |
    S.EasJson |
    S.Easignore |
    S.AutolinkingConfigPaths |
    S.PackageJsonScriptsAll |
    S.GitIgnore,
};
