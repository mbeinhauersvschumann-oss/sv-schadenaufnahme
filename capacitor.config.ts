import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.svschumann.schadenaufnahme.dev', // eigenes DEV-Bundle
  appName: 'SV Schumann – Schadenaufnahme (DEV)',
  webDir: 'dist',              // lokale Struktur bleibt
  ios: { scheme: 'https' },    // DEV nutzt HTTPS
  server: {
    url: 'https://webcast-stroke-ticket-carol.trycloudflare.com', // dein aktueller Tunnel
    cleartext: false,
    allowNavigation: []
  }
};

export default config;
