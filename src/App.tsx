import React, { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { flushQueueCount } from './lib/queue';
import { openForm, tryFlushQueue } from './lib/uploader';
import Login from './components/Login';

export default function App() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [jwt, setJwt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { value } = await Preferences.get({ key: 'jwt' });
      setJwt(value ?? null);
      setPending(await flushQueueCount());
    })();
    const sub = Network.addListener('networkStatusChange', async (st) => {
      setOnline(st.connected);
      if (st.connected) {
        await tryFlushQueue();
        setPending(await flushQueueCount());
      }
    });
    return () => { sub.remove(); };
  }, []);

  if (!jwt) return <Login onLoggedIn={(token) => setJwt(token)} />;

  return (
    <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1>SV Schumann – Schadenaufnahme</h1>
      <p>Status: {online ? 'Online' : 'Offline'}</p>
      <p>Ausstehende Übermittlungen: {pending}</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={() => openForm(jwt!)} style={btn}>Formular öffnen</button>
        <button onClick={async () => { await tryFlushQueue(); setPending(await flushQueueCount()); }} style={btn}>
          Jetzt senden
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { padding: '12px 16px', borderRadius: 10, border: '1px solid #ccc' };
