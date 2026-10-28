import Constants from 'expo-constants';

// Two independent config checks keep test initialization away from production.
export const isDisposableTestBuild =
  Constants.expoConfig?.extra?.disposableSyntheticE2E === true &&
  Constants.expoConfig?.android?.package === 'com.cashio.app.e2e';
