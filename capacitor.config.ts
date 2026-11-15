import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android/iOS wrapper. Run once:
 *   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
 *   npx cap add android
 *   npm run android:sync
 *   npx cap open android
 *
 * CapacitorHttp routes fetch() through the native HTTP stack, which avoids
 * CORS entirely - the same reason the Electron shell disables web security.
 */
const config: CapacitorConfig = {
  appId: 'app.nzb724.controlroom',
  appName: 'NZB-7/24',
  webDir: 'dist',
  android: {
    // LAN services are usually plain http://; the WebView origin is https://.
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
