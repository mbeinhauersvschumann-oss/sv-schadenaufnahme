import React, { useState } from 'react';
import { Preferences } from '@capacitor/preferences';

export default function Login({ onLoggedIn }: { onLoggedIn: (t: string) => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const r = await fetch('https://sv-schumann.de/wp-json/sv/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      if (!r.ok) throw new Error('Login fehlgeschlagen');
      const json = await r.json();
      if (!json?.token) throw new Error('Kein Token');
      await Preferences.set({ key: 'jwt', value: json.token });
      onLoggedIn(json.token);
    } catch (e:any) { setErr(e.message || 'Fehler'); }
  }

  return (
    <form onSubmit={doLogin} style={{ padding: 16 }}>
      <h2>Login</h2>
      <input placeholder="Benutzer" value={u} onChange={e=>setU(e.target.value)} />
      <input placeholder="Passwort" type="password" value={p} onChange={e=>setP(e.target.value)} />
      <button type="submit">Anmelden</button>
      {err && <p style={{color:'crimson'}}>{err}</p>}
    </form>
  );
}
