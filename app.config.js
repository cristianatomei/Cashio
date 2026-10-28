// Only this explicit build profile may be reset by Maestro.
module.exports = ({ config }) => {
  if (process.env.CASHIO_E2E !== '1') return config;
  return {
    ...config,
    name: 'Cashio Synthetic E2E',
    scheme: 'cashio-e2e',
    android: { ...config.android, package: 'com.cashio.app.e2e' },
    ios: { ...config.ios, bundleIdentifier: 'com.cashio.app.e2e' },
    extra: { ...config.extra, disposableSyntheticE2E: true },
  };
};
