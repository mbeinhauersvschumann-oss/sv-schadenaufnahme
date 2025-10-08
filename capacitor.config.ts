import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.svschumann.schadenaufnahme',
  appName: 'SV Schumann – Schadenaufnahme',
  webDir: 'dist',
  ios: { scheme: 'capacitor' },
  server: {
    cleartext: false,
    allowNavigation: []
  }
};
export default config;
