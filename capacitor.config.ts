import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.svschumann.schadenaufnahme',
  appName: 'SV Schumann – Schadenaufnahme (DEV)',
  webDir: 'dist',
  ios: { scheme: 'https' },
  server: {
    url: 'https://dev.sv-schumann.de',   // aktuell aktiver Cloudflare-Tunnel
    cleartext: false,
    allowNavigation: [
      'dev.sv-schumann.de',
      'app.sv-schumann.de'
    ]
  }
};

export default config;
