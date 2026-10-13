// app.json'daki ayarları kullanır; yalnızca web sitesinin alt klasörünü (GitHub Pages) dışarıdan alır.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
});
