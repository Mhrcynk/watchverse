// Native-only configuration. Link a real Expo project before building signed binaries.
module.exports = ({ config }) => ({
  ...config,
  ...(process.env.EAS_PROJECT_ID ? { extra: { ...config.extra, eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
});
