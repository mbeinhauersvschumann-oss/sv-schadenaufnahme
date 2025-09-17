import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.svschumann.schadenaufnahme',
  appName: 'SV Schumann – Schadenaufnahme',
  webDir: 'dist',
  server: { allowNavigation: ['sv-schumann.de'] },
  ios: { scheme: 'https' }
};
export default config;
