import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nakliyedefterim.app',
  appName: 'Nakliye Defterim',
  webDir: 'dist/renderer',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: true
  },
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    backgroundColor: '#141716',
    preferredContentMode: 'mobile',
    scrollEnabled: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;


