// Native-only configuration. Link a real Expo project before building signed binaries.
// Web: GitHub Pages alt klasörü (EXPO_BASE_URL) yayın sırasında dışarıdan verilir.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
  ...(process.env.EAS_PROJECT_ID ? { extra: { ...config.extra, eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
});
