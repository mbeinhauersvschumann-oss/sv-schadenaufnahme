import { enqueue, iterateAll, dequeue } from './queue';
import { Preferences } from '@capacitor/preferences';

const API_SUBMIT = 'https://sv-schumann.de/wp-json/sv/v1/submit';

export function openForm(jwt: string) {
  window.location.href = 'https://sv-schumann.de/form-view/11';
}

export async function handleFormSubmit(form: HTMLFormElement) {
  const fd = new FormData(form);
  const data: Record<string, any> = {};
  for (const [k, v] of fd.entries()) {
    if (v instanceof File) continue;
    if (k.endsWith('[]')) { (data[k] ||= []).push(v); } else { data[k] = v; }
  }
  const files: Array<{field:string, filename:string, mime:string, content_base64:string}> = [];
  const entries = fd.getAll('photos[]');
  for (const item of entries) {
    if (item instanceof File && item.size > 0) {
      const b64 = await fileToBase64(item);
      files.push({ field: 'photos[]', filename: item.name, mime: item.type || 'image/jpeg', content_base64: b64 });
    }
  }
  const payload = {
    meta: { app_version: '1.0.0', submitted_at: new Date().toISOString() },
    form: { source: '/form-view/11', schema_version: 1 },
    data, files
  };
  const jwt = (await Preferences.get({ key: 'jwt' })).value;
  try {
    const r = await fetch(API_SUBMIT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Upload failed');
  } catch {
    await enqueue(payload);
  }
}

export async function tryFlushQueue() {
  const jwt = (await Preferences.get({ key: 'jwt' })).value;
  if (!jwt) return;
  const items = await iterateAll();
  for (const it of items) {
    try {
      const r = await fetch(API_SUBMIT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify(it.payload)
      });
      if (r.ok) await dequeue(it.id);
    } catch { /* bleibt in Queue */ }
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(file); });
}
