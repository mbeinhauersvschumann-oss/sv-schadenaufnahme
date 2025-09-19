import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.svschumann.schadenaufnahme',
  appName: 'SV Schumann – Schadenaufnahme',
  webDir: 'dist',
  ios: { scheme: 'https' },
  server: {
    url: 'https://sv-schumann.de/app/schadenaufnahme?app=1',
    cleartext: false,
    allowNavigation: ['sv-schumann.de', '*.sv-schumann.de']
  }
};
export default config;
