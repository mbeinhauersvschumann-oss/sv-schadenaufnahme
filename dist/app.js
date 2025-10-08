/* === SVS In-App DevTools (ohne Mac) =======================================
   Aktivierung:  /app/dashboard?debug=1     (persistiert in localStorage)
   Deaktivieren: /app/dashboard?debug=0
   Button "🐞 Debug" zeigt Diagnose & kopiert sie in die Zwischenablage.
=========================================================================== */

const API_BASE = 'https://www.sv-schumann.de/wp-json/svs-app/v1';

(function(){
  const qs = location.search || '';
  if (/[?&]debug=0\b/.test(qs)) { try{ localStorage.removeItem('svs_debug'); }catch{} return; }
  const enabled = /[?&]debug=1\b/.test(qs) || localStorage.getItem('svs_debug') === '1';
  if (!enabled) return;
  try{ localStorage.setItem('svs_debug','1'); }catch{}

  // 1) Optional: kleine Console (eruda). Wenn CSP/CDN blockt, macht nix – Fallback unten.
  (function injectEruda(){
    try {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/eruda';
      s.async = true;
      s.onload = function(){ try{ eruda.init(); console.log('[DEVTOOLS] eruda ready'); }catch(e){} };
      document.head.appendChild(s);
    } catch(_) {}
  })();

  // 2) UI: 🐞-Button + Diagnose-Dump
  function addStyle(css){ var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); }
  addStyle('.svs-debug-btn{position:fixed;z-index:99999;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));background:#1b2a4a;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 12px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.35)}' +
           '#svs-diag{position:fixed;left:12px;right:12px;bottom:72px;max-height:50vh;overflow:auto;z-index:99998;background:rgba(11,17,31,.92);color:#eaf2ff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px;backdrop-filter:blur(6px);font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;}');

  function dumpCapEnv(copy){
    const diag = {
      href: location.href,
      origin: location.origin,
      domain: document.domain,
      ua: navigator.userAgent,
      capacitorType: typeof window.Capacitor,
      capacitorKeys: window.Capacitor ? Object.keys(window.Capacitor) : null,
      hasWKBridge: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bridge),
      navEntries: (performance.getEntriesByType('navigation')||[]).map(n=>({name:n.name||'', type:n.type||'', nextHop:n.nextHopProtocol||''})),
      cspMeta: Array.from(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')).map(m=>m.content||''),
      plugins: (window.Capacitor && window.Capacitor.Plugins) ? Object.keys(window.Capacitor.Plugins) : null
    };
    console.log('[SVS DIAG]', diag);
    let pre = document.getElementById('svs-diag');
    if (!pre){ pre=document.createElement('pre'); pre.id='svs-diag'; document.body.appendChild(pre); }
    pre.textContent = JSON.stringify(diag, null, 2);
    if (copy && navigator.clipboard) { navigator.clipboard.writeText(pre.textContent).catch(()=>{}); }
    window.SVSAPP = window.SVSAPP || {}; window.SVSAPP.diag = diag;
  }

  function addBtn(){
    const btn = document.createElement('button');
    btn.className = 'svs-debug-btn';
    btn.type = 'button';
    btn.textContent = '🐞 Debug';
    btn.onclick = function(){ dumpCapEnv(true); };
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', addBtn, {once:true});
  } else {
    addBtn();
  }

  window.SVSAPP = window.SVSAPP || {};
  window.SVSAPP.dumpCapEnv = dumpCapEnv;
})();

/* === SVS Debug Toggle (ohne URL, per Doppeltipp auf App-Bar) ============= */
(function(){
  function setDebug(on){
    try{
      if (on) localStorage.setItem('svs_debug','1');
      else    localStorage.removeItem('svs_debug');
    }catch{}
    // Visuelles Feedback
    const t=document.createElement('div');
    t.textContent = on ? 'Debug EIN' : 'Debug AUS';
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom));z-index:99999;background:#172036;color:#eaf2ff;border:1px solid rgba(255,255,255,.18);padding:10px 12px;border-radius:12px;font:600 13px/1.2 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 1200);

    // Bei "EIN" neu laden, damit der DevTools-Block oben greift
    if (on) {
      setTimeout(()=>{
        const url = new URL(window.location.href);
        if (!url.searchParams.has('debug')) url.searchParams.set('debug','1');
        window.location.replace(url.toString());
      }, 200);
    }
  }

  function bind(){
    const bar = document.querySelector('.app-bar');
    if (!bar) return;

    // Desktop / Pointer: dblclick
    bar.addEventListener('dblclick', ()=> {
      const on = localStorage.getItem('svs_debug') !== '1';
      setDebug(on);
    });

    // iOS/Touch: Double-Tap
    let lastTap = 0;
    bar.addEventListener('touchend', ()=> {
      const now = Date.now();
      if (now - lastTap < 350) {
        const on = localStorage.getItem('svs_debug') !== '1';
        setDebug(on);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, {passive:true});
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind, {once:true});
  } else {
    bind();
  }
})();

/* === Widget Layout Manager (Persistenz: Sichtbarkeit + Spanne 1–3) ======= */
(function(){
  const KEY = 'svs_widget_layout';        // { route:{on:true,span:2}, weather:{on:true,span:1}, ... }
  const REV = 'svs-widget-layout-rev';    // für Cross-Tab-Update

  function loadCfg(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(_) { return {}; }
  }
  function saveCfg(cfg){
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
      localStorage.setItem(REV, String(Date.now()));
    } catch(_) {}
  }

  function apply(){
    const cfg = loadCfg();
    document.querySelectorAll('.widget[data-widget]').forEach(el=>{
      const id = el.getAttribute('data-widget');
      const defSpan = parseInt(el.getAttribute('data-span')||'1',10);
      const st = cfg[id] || { on:true, span:defSpan };

      // Sichtbarkeit
      el.hidden = st.on === false;

      // Spanne (1-3, clamp)
      const span = Math.max(1, Math.min(3, parseInt(st.span||defSpan,10)));
      el.classList.remove('span-1','span-2','span-3');
      el.classList.add('span-'+span);
    });
  }

  // Öffentliche API
  window.SVSAPP = window.SVSAPP || {};
  window.SVSAPP.widgets = {
    getAll(){
      const cfg = loadCfg();
      const ids = Array.from(document.querySelectorAll('.widget[data-widget]')).map(el => el.getAttribute('data-widget'));
      const out = {};
      ids.forEach(id=>{
        const el = document.querySelector(`.widget[data-widget="${id}"]`);
        const defSpan = parseInt(el?.getAttribute('data-span')||'1',10);
        out[id] = Object.assign({ on:true, span:defSpan }, cfg[id]||{});
      });
      return out;
    },
    set(id, opts){ // opts: {on?:boolean, span?:1|2|3}
      if (!id) return;
      const cfg = loadCfg();
      cfg[id] = Object.assign(cfg[id]||{}, opts||{});
      if ('span' in cfg[id]) cfg[id].span = Math.max(1, Math.min(3, parseInt(cfg[id].span||1,10)));
      saveCfg(cfg);
      apply();
      try{ document.dispatchEvent(new CustomEvent('svs:widgets-updated', {detail:{id,opts}})); }catch(_){}
    },
    reset(){ localStorage.removeItem(KEY); localStorage.setItem(REV, String(Date.now())); apply(); },
    _apply: apply
  };

  // Initial anwenden
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply, {once:true});
  } else {
    apply();
  }

  // Cross-Tab
  window.addEventListener('storage', (e)=>{ if (e.key === REV) apply(); });
})();

/* === Native Calendar Bridge – FINAL (IDs + Zeiten robust) ===================
   - wartet auf Capacitor.Plugins.CalendarBridge (6s)
   - READ:  getCalendars(), getEventsISO()
   - WRITE: createEvent(), updateEvent(), deleteEvent()
   - IDs:   akzeptiert id/eventId/identifier/eventIdentifier/uid/...
   - Zeiten: ms/Date/ISO -> RFC3339 mit lokalem Offset (+HH:MM)
   - Fallback Web/PWA: sichere Stubs mit klaren Fehlermeldungen
   - Export: window.SVSAPP.calendar  UND  window.C
   - Ready-Event: 'svs:calendar-ready' ({available})
============================================================================= */
(function () {
  function log(){ /* console.log('[CalBridge]', ...arguments); */ }
  async function waitFor(fn, timeoutMs=6000, step=150){
    const t0 = Date.now();
    return new Promise(resolve=>{
      (function tick(){
        try{
          const v = fn();
          if (v) return resolve(v);
        }catch{}
        if (Date.now()-t0 >= timeoutMs) return resolve(null);
        setTimeout(tick, step);
      })();
    });
  }

  // ---------- Zeit-Helfer ---------------------------------------------------
  function toRFC3339Local(x){
    const d = (x instanceof Date) ? x
            : (typeof x === 'number') ? new Date(x)
            : new Date(String(x));
    if (isNaN(d.getTime())) throw new Error('bad date');
    const tz = -d.getTimezoneOffset(); // Minuten ost/west von UTC
    const sign = tz >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(tz)/60)).padStart(2,'0');
    const mm = String(Math.abs(tz)%60).padStart(2,'0');
    const y = d.getFullYear();
    const M = String(d.getMonth()+1).padStart(2,'0');
    const D = String(d.getDate()).padStart(2,'0');
    const H = String(d.getHours()).padStart(2,'0');
    const i = String(d.getMinutes()).padStart(2,'0');
    const s = String(d.getSeconds()).padStart(2,'0');
    return `${y}-${M}-${D}T${H}:${i}:${s}${sign}${hh}:${mm}`;
  }

  // ---------- ID-Helfer -----------------------------------------------------
  function extractEventId(x){
    if (!x) return null;
    if (typeof x === 'string') return x;
    return (
      x.id ||
      x.eventId ||
      x.identifier ||
      x.eventIdentifier ||
      x.uid ||
      x.ekId ||
      x.nativeId ||
      x.calendarItemIdentifier ||
      null
    );
  }

  // ---------- Payload-Builder (breit kompatibel) ----------------------------
  function buildPluginPayload(input, {isUpdate=false} = {}){
    if (!input || typeof input !== 'object') throw new Error('payload missing');

    const startRaw = ('start' in input) ? input.start :
                     ('startISO' in input) ? input.startISO :
                     ('startDate' in input) ? input.startDate : null;
    const endRaw   = ('end' in input) ? input.end :
                     ('endISO' in input) ? input.endISO :
                     ('endDate' in input) ? input.endDate : null;

    if (!startRaw || !endRaw) throw new Error('bad date');

    const startRFC = toRFC3339Local(startRaw);
    const endRFC   = toRFC3339Local(endRaw);

    const stableId = extractEventId(input);

    const out = {
      title:      input.title || input.summary || '',
      location:   input.location || input.place || '',
      notes:      input.notes || input.description || '',
      allDay:     !!input.allDay,

      // Kalenderzuordnung (wenn vorhanden)
      calendarId: input.calendarId || input.calendar_id || input.calendar || null,

      // Zeiten in mehreren Varianten parallel (max. Kompatibilität)
      startDate:  startRFC,
      endDate:    endRFC,
      start:      startRFC,
      end:        endRFC,
      start_ms:   (new Date(startRFC)).getTime(),
      end_ms:     (new Date(endRFC)).getTime()
    };

    if (isUpdate) {
      if (!stableId) throw new Error('updateEvent: id missing');
      // alle gängigen ID-Keys setzen
      out.id = stableId;
      out.eventId = stableId;
      out.identifier = stableId;
      out.eventIdentifier = stableId;

      // CalendarId aus verschachteltem Objekt retten, falls nötig
      if (!out.calendarId && input.calendar && typeof input.calendar === 'object') {
        out.calendarId = extractEventId(input.calendar) || input.calendar.id || input.calendar.uid || null;
      }
    }
    return out;
  }

  function startOfTodayISO(){ const d=new Date(); const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0); return x.toISOString(); }
  function endOfTodayISO(){   const d=new Date(); const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999); return x.toISOString(); }

  const notAvailable = (name)=>()=> {
    const msg = `Kalender-Funktion „${name}“ ist hier nicht verfügbar (kein Native-Bridge oder fehlende Rechte).`;
    console.warn(msg); throw new Error(msg);
  };

  (async function init(){
    const plugin = await waitFor(() => {
      const P = window?.Capacitor?.Plugins;
      return (P && P.CalendarBridge) ? P.CalendarBridge : null;
    }, 6000, 150);

    window.SVSAPP = window.SVSAPP || {};

    // --------- Fallback (Web/PWA) ------------------------------------------
    if (!plugin) {
      log('CalendarBridge not found → using web fallbacks');
      window.NativeCalendar = null;
      const api = {
        available:false,
        requestPermissions: async ()=>false,
        getCalendars:       async ()=>[],
        getEventsISO:       async ()=>[],
        startOfTodayISO, endOfTodayISO,
        createEvent: notAvailable('createEvent'),
        updateEvent: notAvailable('updateEvent'),
        deleteEvent: notAvailable('deleteEvent'),
      };
      window.SVSAPP.calendar = api;
      window.C = api;
      window.dispatchEvent(new CustomEvent('svs:calendar-ready', { detail:{ available:false } }));
      return;
    }

    // --------- Native Layer -------------------------------------------------
    window.NativeCalendar = {
      requestPermissions: () => plugin.requestPermissions(),
      getCalendars:       () => plugin.getCalendars(),
      getEvents:          (fromISO, toISO, calendarIds=[]) => plugin.getEvents({ from: fromISO, to: toISO, calendarIds }),
      addEvent:           (data) => plugin.addEvent(data),
      updateEvent:        (data) => plugin.updateEvent(data),
      deleteEvent:        (id)   => plugin.deleteEvent({ id }),
    };

    async function ensurePerm(){
      const r = await window.NativeCalendar.requestPermissions();
      const ok = !!(r && (r.granted === true || r.granted === 'true'));
      if (!ok) throw new Error('Kalender-Zugriff nicht erlaubt.');
      return true;
    }

    // --------- Öffentliche API (UI nutzt 'C.*') -----------------------------
    const api = {
      available: true,

      // READ
      async requestPermissions(){
        const r = await window.NativeCalendar.requestPermissions();
        return !!(r && (r.granted === true || r.granted === 'true'));
      },
      async getCalendars(){
        const res = await window.NativeCalendar.getCalendars();
        return (res && res.calendars) || [];
      },
      async getEventsISO(fromISO, toISO, ids=[]){
        const res = await window.NativeCalendar.getEvents(fromISO, toISO, ids);
        return (res && res.events) || [];
      },
      startOfTodayISO, endOfTodayISO,

      // WRITE
      async createEvent(payload){
        await ensurePerm();
        const p = buildPluginPayload(payload);
        return await window.NativeCalendar.addEvent(p);
      },
      async updateEvent(payload){
        await ensurePerm();
        const p = buildPluginPayload(payload, {isUpdate:true});
        return await window.NativeCalendar.updateEvent(p);
      },
      async deleteEvent(idOrPayload){
        await ensurePerm();
        const id = extractEventId(idOrPayload);
        if (!id) throw new Error('deleteEvent: id missing');
        return await window.NativeCalendar.deleteEvent(id);
      },
    };

    window.SVSAPP.calendar = api;
    window.C = api;
    window.dispatchEvent(new CustomEvent('svs:calendar-ready', { detail:{ available:true } }));
  })();

  // --------- Optionales Debug ----------------------------------------------
  (function(){
    const P = window?.Capacitor?.Plugins;
    if (!P) { console.log('[CalBridge] Capacitor.Plugins = null'); return; }
    console.log('[CalBridge] Plugins =', Object.keys(P));
    console.log('[CalBridge] CalendarBridge =', P.CalendarBridge ? 'OK' : 'MISSING');
  })();

  (function(){
    const isDebug = (localStorage.getItem('svs_debug') === '1') || /[?&]debug=1\b/.test(location.search);
    if (!isDebug) return;
    async function calDiag(){
      const C = window.SVSAPP && window.SVSAPP.calendar;
      const out = { available: !!(C && C.available) };
      if (!out.available) { console.warn('[CAL DEBUG] not available'); return out; }
      try{
        out.permission = await C.requestPermissions();
        const cals = await C.getCalendars();
        out.calendars = Array.isArray(cals) ? cals.length : 0;
        const s = C.startOfTodayISO(), e = C.endOfTodayISO();
        const evs = await C.getEventsISO(s, e, []);
        out.events_today = Array.isArray(evs) ? evs.length : 0;
      }catch(e){ out.error = String(e); }
      console.log('[CAL DEBUG]', out);
      return out;
    }
    window.SVSAPP.calDiag = calDiag;
  })();
})();

/* === SVS App — Navigation + Fade Transitions ============================== */

/* 1) Login-Helfer (bleibt erhalten) */
function handleLoginSuccess(jwtToken) {
  try { localStorage.setItem('SA_JWT', jwtToken); } catch (e) {}
  if (window.SVSAPP && typeof window.SVSAPP.fadeTo === 'function') {
    window.SVSAPP.fadeTo('/app/dashboard');
  } else {
    window.location.href = '/app/dashboard';
  }
}
window.SVSAPP = window.SVSAPP || {};
window.SVSAPP.handleLoginSuccess = handleLoginSuccess;

/* 2) Fade-Engine */
(function(){
  const body = document.body;
  if (!body || !body.classList || !body.classList.contains('svs-app')) return;

  function getFadeMs() {
    const el = document.querySelector('.page') || body;
    const cs = el ? window.getComputedStyle(el) : null;
    if (!cs) return 350;
    let dur = cs.transitionDuration || '0s';
    dur = Array.isArray(dur) ? dur[0] : dur;
    const match = /([\d.]+)m?s/.exec(dur);
    if (!match) return 350;
    const n = parseFloat(match[1]);
    return dur.includes('ms') ? n : Math.round(n * 1000);
  }

  function fadeTo(url) {
    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) { window.location.href = url; return; }
    } catch(_) {}
    body.classList.add('leaving');
    const delay = Math.max(getFadeMs(), 200);
    setTimeout(() => { window.location.href = url; }, delay);
  }

  window.SVSAPP = window.SVSAPP || {};
  window.SVSAPP.fadeTo = fadeTo;

  document.body.classList.add('ready');

  function isModifiedClick(e){ return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0; }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href || isModifiedClick(e) || a.target === '_blank') return;
    if (!href.startsWith('/app/')) return;
    e.preventDefault();
    fadeTo(href);
  });

  window.addEventListener('beforeunload', () => {
    body.classList.add('leaving');
  });
})();

/* === Wetter-Kachel (Server-Proxy, ohne Stunden) ========================= */
(function(){
  const tile = document.getElementById('wx-tile');
  if (!tile) return;

  const S = {
    ico:'#wx-ico', t:'#wx-t', ta:'#wx-ta', hum:'#wx-hum', wind:'#wx-wind',
    txt:'#wx-txt', loc:'#wx-loc', refresh:'#wx-refresh'
  };
  const q = s => document.querySelector(s);
  const setText = (sel,val)=>{ const el=q(sel); if(el) el.textContent = String(val ?? ''); };

  window.SVSAPP = window.SVSAPP || {};
  const DBG = !!window.SVSAPP.debugWeather;
  const log = (...a)=>{ if(DBG) console.log('[wx]',...a); };
  const err = (...a)=>console.error('[wx]',...a);
  function showTileError(msg){
    tile.setAttribute('data-wx-loading','error');
    tile.setAttribute('data-wx-error', String(msg||'Fehler'));
  }

  function getSettings(){
    try { return JSON.parse(localStorage.getItem('svs_settings') || '{}'); }
    catch(_) { return {}; }
  }
  function wantGeo(){ const s=getSettings(); return (s.weatherUseGeolocation !== false); }

  function getFallback(){
    const s = getSettings();
    const lat = (s.weatherDefaultLat != null) ? Number(s.weatherDefaultLat) : 51.514;
    const lon = (s.weatherDefaultLon != null) ? Number(s.weatherDefaultLon) : 7.465;
    const place = s.weatherDefaultPlace || null;
    tile.setAttribute('data-default-lat', String(lat));
    tile.setAttribute('data-default-lon', String(lon));
    return {lat,lon,place};
  }

  function mapWmo(code){
    const c=Number(code||0);
    if(c===0) return 'Klar';
    if(c===1) return 'Überwiegend klar';
    if(c===2) return 'Wolkig';
    if(c===3) return 'Bedeckt';
    if([45,48].includes(c)) return 'Nebel';
    if([51,53,55].includes(c)) return 'Niesel';
    if([61,63,65,80,81,82,66,67].includes(c)) return 'Regen';
    if([71,73,75,77,85,86].includes(c)) return 'Schnee';
    if([95,96,99].includes(c)) return 'Gewitter';
    return 'Wetter';
  }
  function iconFor(n){
    n=Number(n||0);
    if(n===0) return '☀️'; if(n===1) return '🌤️'; if(n===2) return '⛅'; if(n===3) return '☁️';
    if([45,48].includes(n)) return '🌫️';
    if([51,53,55,61,63,65,80,81,82,66,67].includes(n)) return '🌧️';
    if([71,73,75,77,85,86].includes(n)) return '🌨️';
    if([95,96,99].includes(n)) return '⛈️';
    return '🌡️';
  }

  function fromCache(){
    try{
      const raw = localStorage.getItem('svs_wx_last');
      if(!raw) return null;
      const o = JSON.parse(raw);
      if(!o?.ts) return null;
      if((Date.now()/1000)-o.ts > 600) return null; // 10min
      return o;
    }catch{return null;}
  }

  function render(p){
    const cur = p.current || {};
    setText(S.ico, iconFor(cur.weather_code));
    setText(S.t,   (typeof cur.temperature_2m==='number' ? cur.temperature_2m.toFixed(1) : '—'));
    setText(S.ta,  (typeof cur.apparent_temperature==='number' ? cur.apparent_temperature.toFixed(1) : '—'));
    setText(S.hum, cur.relative_humidity_2m ?? '—');
    setText(S.wind,cur.wind_speed_10m ?? '—');
    setText(S.txt, mapWmo(cur.weather_code));

    const s = getSettings();
    let label = '';
    if (p.loc && p.loc.place) {
      label = p.loc.place;
    } else if (s.weatherDefaultPlace) {
      label = s.weatherDefaultPlace;
    } else {
      label = 'Aktueller Standort';
    }
    setText(S.loc, label);

    tile.setAttribute('data-wx-loading','0');
    tile.removeAttribute('data-wx-error');
    try{ localStorage.setItem('svs_wx_last', JSON.stringify(p)); }catch{}
  }

  async function fetchWX(lat,lon){
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
    const url = `${API_BASE}/wx?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&tz=${encodeURIComponent(tz)}`;
    log('request', {url,lat,lon,tz});
    const r = await fetch(url, {credentials:'same-origin', cache:'no-store'});
    if(!r.ok){
      let preview=''; try{ preview=await r.text(); }catch(_){}
      err('http error', r.status, preview);
      throw new Error('HTTP '+r.status);
    }
    return await r.json();
  }

  // ersetze deine geolocate() aus dem Wetter-Widget durch diese:
  function geolocate(){
    return new Promise(async (resolve) => {
      try {
        const Geo = window?.Capacitor?.Plugins?.Geolocation;
        if (Geo) {
          try { await Geo.requestPermissions(); } catch(_){}
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
          return resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        }
      } catch(_) {}

      // Fallback: Browser-API, nur wenn Plugin fehlt (z.B. im normalen Browser)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          _ => resolve(null),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
        );
      } else {
        resolve(null);
      }
    });
  }

  const cached = fromCache(); if(cached) render(cached);

  (async ()=>{
    tile.setAttribute('data-wx-loading','1');
    const fb = getFallback();
    const pos = await geolocate();
    try{ render(await fetchWX(pos?.lat ?? fb.lat, pos?.lon ?? fb.lon)); }
    catch(e){ err('fetch failed', e); try{ render(await fetchWX(fb.lat, fb.lon)); }catch(e2){ showTileError(e2.message||'Fehler'); } }
  })();

  const btn = q(S.refresh);
  if(btn) btn.addEventListener('click', async ()=>{
    tile.setAttribute('data-wx-loading','1');
    const fb = getFallback();
    const pos = await geolocate();
    try{ render(await fetchWX(pos?.lat ?? fb.lat, pos?.lon ?? fb.lon)); }
    catch(e){ err('refresh failed', e); try{ render(await fetchWX(fb.lat, fb.lon)); }catch(e2){ showTileError(e2.message||'Fehler'); } }
  });

  window.addEventListener('storage', (e)=>{
    if(e.key==='svs-settings-rev'){
      const fb = getFallback();
      tile.setAttribute('data-wx-loading','1');
      geolocate().then(pos=>{
        fetchWX(pos?.lat ?? fb.lat, pos?.lon ?? fb.lon)
          .then(render)
          .catch(_=> fetchWX(fb.lat, fb.lon).then(render).catch(e2=>showTileError(e2.message||'Fehler')));
      });
    }
  });
})();

// Wetter-Debug (nur aktiv, wenn Debug-Modus)
(function(){
  const isDebug = (localStorage.getItem('svs_debug') === '1') || /[?&]debug=1\b/.test(location.search);
  if (!isDebug) return;
  const tile = document.getElementById('wx-tile');
  if (!tile) return;

  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    // nur unseren WX-Endpunkt abfangen
    const url = (typeof input === 'string') ? input : (input?.url || '');
    if (/svs-app\/v1\/wx\b/.test(url) && !/[?&]debug=1\b/.test(url)) {
      const u = new URL(url, location.origin);
      u.searchParams.set('debug','1'); // Debug einschalten
      const res = await origFetch(u.toString(), init);
      try{
        const clone = res.clone();
        const j = await clone.json();
        console.log('[WX DEBUG]', {status: res.status, meta: j.meta || null, body: j});
        if (!res.ok && tile){
          tile.setAttribute('data-wx-error', `HTTP ${res.status}${j?.meta?.retry_after?` (Retry ${j.meta.retry_after}s)`:''}`);
        }
      }catch(_){} // egal, normal weiter
      return res;
    }
    return origFetch(input, init);
  };
})();

/* ==== Route Widget (Dashboard) – ETA serverseitig (keine Google Maps JS im Client) ====== */
(function(){
  const W = window;
  W.SVSAPP = W.SVSAPP || {};
  const $  = (sel, ctx=document)=>ctx.querySelector(sel);
  const on = (el, ev, fn, opt)=> el && el.addEventListener(ev, fn, opt||{passive:true});

  /* --- kleine Utils --- */
  async function fetchJSON(url, opt){
    const ctl = new AbortController();
    const t = setTimeout(()=> ctl.abort(), 8000);
    try{
      const r = await fetch(url, {credentials:'same-origin', signal: ctl.signal, ...(opt||{})});
      if (!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const qs = (o)=>Object.entries(o)
    .filter(([,v])=> v!==undefined && v!==null && v!=='')
    .map(([k,v])=> `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  const RW = {
    // DOM
    root:null, body:null, list:null, sub:null, badges:null, btnMore:null,
    modal:null, modalClose:null, modalList:null, modalPlanBtn:null,

    // State
    state:{
      events:[], next:null,
      online:navigator.onLine,
      gps:null, origin:null,
      prefApp:'auto',
      etaMin:null,   // Minuten
      etaKm:null     // Kilometer (eine Nachkommastelle)
    },

    _etaRetry:null,
    _gpsWatchdog:null,

    /* =================== Init =================== */
    init(){
      this.root    = document.getElementById('route-tile');
      if(!this.root) return;

      this.body    = $('#route-body', this.root);
      this.list    = $('#route-list', this.root);
      this.sub     = $('#route-sub',  this.root);
      this.badges  = $('#route-badges', this.root);
      this.btnMore = $('#route-more', this.root);

      // alte Buttons im Widget entfernen (reines DOM-Cleanup)
      const oldNav = $('#route-nav', this.root); if (oldNav) oldNav.remove();
      const oldDay = $('#route-day', this.root); if (oldDay) oldDay.remove();

      // Modal
      this.modal      = document.getElementById('route-modal');
      this.modalClose = document.getElementById('route-modal-close');
      this.modalList  = document.getElementById('route-modal-list');

      // Events
      on(this.btnMore,'click', ()=>this.openListModal());
      on(this.body, 'click', (e)=>{
        const a = e.target.closest('[data-open="route-detail"]');
        if (!a) return;
        e.preventDefault();
        this.openDetailModal();
      });
      on(document,'keydown',(e)=>{ if(e.key==='Escape') this.closeModal(); });

      // Calendar/Visibility/Online
      window.addEventListener('svs:calendar-ready', ()=>this.refresh());
      document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) this.refresh(); });
      window.addEventListener('pageshow', ()=> this.refresh());         // bfcache-safe
      window.addEventListener('focus', ()=>{ if (document.visibilityState==='visible') this.refresh(); });
      window.addEventListener('online',  ()=>{ this.state.online=true;  this.render(); this.updateEta(); });
      window.addEventListener('offline', ()=>{ this.state.online=false; this.render(); });

      this.state.prefApp = this.getPrefNavApp();

      // Start
      this.renderSkeleton();
      this.tryOrigin();    // GPS anstoßen (nur für origin Lat/Lon)

      // GPS-Watchdog: verhindert ewiges "pending" in WKWebView (iOS)
      this._gpsWatchdog = setTimeout(()=>{
        if (this.state.gps === 'pending') {
          this.state.gps = 'denied';
          this.renderBadges();
          this.updateEta();
        }
      }, 8500);

      this.refresh();      // Events laden + ETA anstoßen
    },

    /* =================== Daten =================== */
    getPrefNavApp(){
      try{
        const fromSettings = W.SVSAPP?.settings?.nav_app;
        if (fromSettings && /^(auto|apple|google)$/.test(fromSettings)) return fromSettings;
        const ls = localStorage.getItem('svs_nav_app');
        if (ls && /^(auto|apple|google)$/.test(ls)) return ls;
      }catch(_){}
      return 'auto';
    },

    async refresh(){
      // zurück auf „pending“
      this.state.etaMin = null;
      this.state.etaKm  = null;

      const {start,end} = this.todayBounds();
      const raw = await this.loadEventsFromCalendar(start,end);
      this.state.events = this.normalize(raw);
      this.state.next   = this.pickNext(this.state.events);

      this.render();
      this.updateEta();
    },

    todayBounds(){
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      return {
        start: new Date(y,m,d,0,0,0).toISOString(),
        end:   new Date(y,m,d,23,59,59).toISOString()
      };
    },

    async loadEventsFromCalendar(fromISO,toISO){
      try{
        if (W.SVSAPP?.calendar?.getEventsISO){
          const sel = JSON.parse(localStorage.getItem('svs_calendar_ids')||'[]');
          const list = await W.SVSAPP.calendar.getEventsISO(fromISO,toISO, sel);
          return Array.isArray(list) ? list : [];
        }
      }catch(_){}
      return [];
    },

    // Standort als origin (optional)
    async tryOrigin(){
      if (!('geolocation' in navigator)) { this.state.gps='unsupported'; this.renderBadges(); return; }
      this.state.gps='pending'; this.renderBadges();
      navigator.geolocation.getCurrentPosition(
        (pos)=>{
          this.state.gps='ok';
          this.state.origin = {lat:pos.coords.latitude, lon:pos.coords.longitude};
          if (this._gpsWatchdog) { clearTimeout(this._gpsWatchdog); this._gpsWatchdog = null; }
          this.renderBadges(); this.updateEta();
        },
        (_err)=>{
          this.state.gps='denied';
          if (this._gpsWatchdog) { clearTimeout(this._gpsWatchdog); this._gpsWatchdog = null; }
          this.renderBadges(); this.updateEta();
        },
        { enableHighAccuracy:true, maximumAge:60000, timeout:7000 }
      );
    },

    parseDateSafe(v){
      if (v == null) return null;
      if (v instanceof Date) return isNaN(v)?null:v;
      if (typeof v === 'number'){ const ms=(v<1e12)?v*1000:v; const d=new Date(ms); return isNaN(d)?null:d; }
      const s=String(v).trim(); if(!s) return null;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) { const d=new Date(s); return isNaN(d)?null:d; }
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) { const d=new Date(s.replace(' ','T')); return isNaN(d)?null:d; }
      const d=new Date(s); return isNaN(d)?null:d;
    },

    normalize(list){
      const normAddr = s => (s||'').toString().trim()
        .replace(/\s{2,}/g,' ')
        .replace(/[\r\n;|]+/g, ', ');
      return (list||[])
        .map(e=>{
          const start=this.parseDateSafe(e.start);
          if(!start) return null;
          return {
            start,
            end:   this.parseDateSafe(e.end),
            title: (e.title||'').toString().trim(),
            location: normAddr(e.location||'')
          };
        })
        .filter(Boolean)
        .sort((a,b)=>a.start-b.start);
    },

    // nur nächster zukünftiger Termin
    pickNext(events){
      const now = new Date();
      const future = events.filter(e=> e.start > now);
      return future.length ? future[0] : null;
    },

    /* =================== Navigation =================== */
    getApp(){
      if (this.state.prefApp !== 'auto') return this.state.prefApp;
      const ua = navigator.userAgent.toLowerCase();
      return (/iphone|ipad|ipod|macintosh/.test(ua)) ? 'apple' : 'google';
    },

    originParam(){
      if (!this.state.origin) return '';
      const {lat, lon} = this.state.origin;
      return (this.getApp()==='apple')
        ? `saddr=${encodeURIComponent(`${lat},${lon}`)}`
        : `origin=${encodeURIComponent(`${lat},${lon}`)}`;
    },

    linkSingle(addr){
      if (!addr) return null;
      const app = this.getApp();
      const dest = encodeURIComponent(addr);
      const origin = this.originParam();
      if (app==='apple'){
        return `maps://?${origin ? origin+'&' : ''}daddr=${dest}`;
      } else {
        return `https://www.google.com/maps/dir/?api=1&${origin ? origin+'&' : ''}destination=${dest}`;
      }
    },

    linkDay(stops){
      const app = this.getApp();
      const withAddr = stops.filter(s=>!!s.location);
      if(!withAddr.length) return null;
      const origin = this.originParam();
      if(app==='apple'){
        const chain = withAddr.map(s=>`daddr=${encodeURIComponent(s.location)}`).join('&');
        return `maps://?${origin ? origin+'&' : ''}${chain}`;
      }
      const last = withAddr[withAddr.length-1];
      const mid  = withAddr.slice(0,-1);
      let url = `https://www.google.com/maps/dir/?api=1&${origin ? origin+'&' : ''}destination=${encodeURIComponent(last.location)}`;
      if (mid.length) url += `&waypoints=${mid.map(s=>encodeURIComponent(s.location)).join('|')}`;
      return url;
    },

    open(href){ try{ window.open(href, '_blank', 'noopener'); } catch(e){ location.href = href; } },

    /* =================== ETA (SERVERSEITIG) =================== */
    async updateEta(){
      // pending
      this.state.etaMin = null;
      this.state.etaKm  = null;

      const n = this.state.next;
      if (!n?.location || !this.state.online) { this.renderBadges(); return; }

      // Origin bestimmen (optional)
      let originStr = '';
      if (this.state.origin) {
        originStr = `${this.state.origin.lat},${this.state.origin.lon}`;
      } else if (typeof window.SVS_ORIGIN_FALLBACK === 'string' && window.SVS_ORIGIN_FALLBACK.trim()) {
        // leer lassen → Server darf Fallback verwenden, wenn implementiert
        originStr = '';
      } else if (this.state.gps === 'denied' || this.state.gps === 'unsupported') {
        // ohne Origin kann Server nur sehr grob schätzen – wir brechen sauber ab
        this.state.etaMin = -1; this.renderBadges(); return;
      } else {
        // GPS pending → kurzer Retry
        if (!this._etaRetry) this._etaRetry = setTimeout(()=>{ this._etaRetry=null; this.updateEta(); }, 900);
        this.renderBadges(); return;
      }

      try{
        const url = `${API_BASE}/eta?` + qs({ origin: originStr, dest: n.location });
        const data = await fetchJSON(url);

        if (data && data.ok && typeof data.eta_min==='number') {
          this.state.etaMin = Math.max(1, Math.round(data.eta_min));
          this.state.etaKm  = (typeof data.km==='number') ? Math.max(0, Math.round(data.km*10)/10) : null;
          if (this._etaRetry){ clearTimeout(this._etaRetry); this._etaRetry=null; }
        } else {
          this.state.etaMin = -1;
        }
      } catch(_){
        this.state.etaMin = -1;
      }

      this.renderBadges();
    },

    /* =================== Modals =================== */
    openDetailModal(){
      if (this.modalPlanBtn) this.modalPlanBtn.style.display = 'none';
      const n = this.state.next;
      if (!n) return;
      this.renderDetailModal(n);
      this.showModal();
    },

    openListModal(){
      if (this.modal && this.modalClose) {
        const head = this.modalClose.parentElement;
        if (head) {
          if (!this.modalPlanBtn) {
            const a = document.createElement('a');
            a.id = 'route-plan-btn';
            a.className = 'btn-ghost';
            a.textContent = 'Tagesroute planen';
            a.setAttribute('role','button');
            head.insertBefore(a, this.modalClose);
            this.modalPlanBtn = a;
          }
          const href = this.linkDay(this.state.events.filter(e=>!!e.location));
          if (href) { this.modalPlanBtn.href = href; this.modalPlanBtn.target = '_blank'; this.modalPlanBtn.rel = 'noopener'; }
          this.modalPlanBtn.style.display = '';
        }
      }
      this.renderListModal();
      this.showModal();
    },

    showModal(){
      if (!this.modal) return;
      this.modal.hidden = false;
      document.body.style.overflow='hidden';
      on(this.modal, 'click', (e)=>{ if (e.target === this.modal) this.closeModal(); });
      on(this.modalClose, 'click', ()=>this.closeModal());
    },
    closeModal(){
      if (!this.modal) return;
      this.modal.hidden = true;
      document.body.style.overflow='';
    },

    // Detail-Modal – mit Fließtext-ETA + Distanz, Button unten rechts
    renderDetailModal(n){
      if (!this.modalList) return;
      const addr = n.location || '';
      const when = this.hhmm(n.start);

      let mapHtml = '';
      if ((window.SVS_GMAPS_KEY||'') && addr){
        const url = this.buildStaticMapURL(this.state.origin, addr); // Karte auch ohne Origin
        if (url) mapHtml = `
          <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12)">
            <img src="${url}" alt="Karten-Vorschau" style="display:block;width:100%;height:auto">
          </div>`;
      }

      const etaHtml = (this.state.etaMin == null)
        ? '<div class="muted" style="opacity:.85">Fahrzeit wird ermittelt…</div>'
        : (this.state.etaMin === -1
            ? '<div class="muted" style="opacity:.85">Fahrzeit nicht verfügbar</div>'
            : `<div class="badge" style="display:block;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:.45rem .65rem;border-radius:999px;font-weight:800">
                 Fahrzeit ~ ca. ${this.state.etaMin} min – Entfernung zum Ziel: ${this.state.etaKm!=null ? this.state.etaKm.toFixed(1) : '—'} km
               </div>`);

      const startHref = this.linkSingle(addr) || '#';

      this.modalList.innerHTML = `
        <div class="rt-next" style="display:grid; gap:10px">
          <div>
            <div style="font-weight:800">${this.escape(n.title || 'Termin')}</div>
            <div style="opacity:.85">${when} · ${addr ? this.escape(addr) : 'Keine Adresse'}</div>
          </div>
          ${etaHtml}
          ${mapHtml}
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px">
            <a class="btn btn-primary" style="text-decoration:none" href="${this.escapeAttr(startHref)}" target="_blank" rel="noopener">Route starten</a>
          </div>
        </div>`;
    },

    // „Alle Termine“-Modal – Adressen als Text + Route-Button pro Zeile
    renderListModal(){
      if (!this.modalList) return;
      const now = new Date();
      const allFuture = this.state.events.filter(e=> e.start > now);
      if (!allFuture.length){
        this.modalList.innerHTML = '<div class="muted" style="opacity:.8;padding:.5rem 0">Keine weiteren Termine heute.</div>';
        return;
      }
      this.modalList.innerHTML = allFuture.map(e=>{
        const when = this.hhmm(e.start);
        const addr = e.location ? this.escape(e.location) : 'Keine Adresse';
        const href = e.location ? this.escapeAttr(this.linkSingle(e.location)||'#') : '';
        return `<div style="padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.08)">
          <div style="display:grid;grid-template-columns:3.1rem 1fr auto;gap:.6rem;align-items:center">
            <span class="t" style="font-variant-numeric:tabular-nums;opacity:.8">${when}</span>
            <span>
              <span class="ttl" style="font-weight:700;display:block">${this.escape(e.title||'Termin')}</span>
              <span class="addr" style="display:block;opacity:.85">${addr}</span>
            </span>
            ${e.location ? `<a class="btn" style="text-decoration:none" href="${href}" target="_blank" rel="noopener">Route</a>` : '<span class="btn-ghost disabled">Route</span>'}
          </div>
        </div>`;
      }).join('');
    },

    /* =================== Render =================== */
    renderSkeleton(){
      if (this.sub) this.sub.textContent = '–';
      if (this.body) this.body.innerHTML = `
        <div class="rt-skel">
          <div class="sk w60"></div>
          <div class="sk w90"></div>
          <div class="sk w40"></div>
        </div>`;
      if (this.list) this.list.hidden = true;
      if (this.btnMore) this.btnMore.hidden = true;
      this.renderBadges();
    },

    renderBadges(){
      if (!this.badges) return;
      const evs = this.state.events || [];
      const withAddr = evs.filter(e=>!!e.location).length;

      let gpsBadge = '';
      if (this.state.gps && this.state.gps !== 'ok') {
        const gpsMap = { ok:'GPS', denied:'GPS aus', pending:'GPS…', unsupported:'GPS n/v' };
        const gpsTxt = gpsMap[this.state.gps] || 'GPS n/v';
        gpsBadge = `<span class="route-badge" title="Standort ${gpsTxt}"><span class="dot"></span>${gpsTxt}</span>`;
      }

      const countBadge = `<span class="route-badge" title="Termine heute"><span class="dot"></span>${evs.length} Termine</span>`;
      const addrBadge  = `<span class="route-badge" title="Termine mit Adresse"><span class="dot"></span>${withAddr} mit Adresse</span>`;
      const etaBadge   = (this.state.etaMin == null)
        ? `<span class="route-badge" title="Fahrzeit wird ermittelt"><span class="dot"></span>ETA …</span>`
        : (this.state.etaMin === -1
            ? `<span class="route-badge" title="Fahrzeit nicht verfügbar"><span class="dot"></span>ETA n. V.</span>`
            : `<span class="route-badge" title="Fahrzeit zum nächsten Termin"><span class="dot"></span>ETA ~ ${this.state.etaMin} min</span>`);

      this.badges.innerHTML = gpsBadge + countBadge + addrBadge + etaBadge;
    },

    render(){
      this.renderBadges();

      const evs = this.state.events;
      if(!evs.length){
        if (this.sub) this.sub.textContent = (W.SVSAPP?.calendar?.getEventsISO)
          ? 'Heute keine Termine'
          : 'Kalender am Gerät nicht verfügbar';
        if (this.btnMore) this.btnMore.hidden = true;
        if (this.body) this.body.innerHTML = '';
        if (this.list) this.list.hidden = true;
        return;
      }

      const now = new Date();
      const n = this.state.next;
      const futureRest = evs.filter(e=> e.start > now && e !== n);

      if(!n){
        if (this.sub) this.sub.textContent = 'Keine zukünftigen Termine heute';
        if (this.btnMore){
          this.btnMore.hidden = futureRest.length <= 0;
          if (!this.btnMore.hidden) this.btnMore.textContent = `Alle Termine (+${futureRest.length})`;
        }
        if (this.body) this.body.innerHTML = '';
      }else{
        if (this.sub) this.sub.textContent = `${this.hhmm(n.start)} · Nächster Termin`;

        const addrHtml = n.location
          ? `<a href="#" data-open="route-detail" style="color:inherit;text-decoration:none;border-bottom:1px dashed currentColor">${this.escape(n.location)}</a>`
          : '<span style="opacity:.7">Keine Adresse</span>';

        if (this.body) this.body.innerHTML = `
          <div class="rt-title">${this.escape(n.title || 'Termin')}</div>
          <div class="rt-addr">${addrHtml}</div>`;

        if (this.btnMore){
          const hiddenCount = futureRest.length;
          this.btnMore.hidden = hiddenCount <= 0;
          if (!this.btnMore.hidden) this.btnMore.textContent = `Alle Termine (+${hiddenCount})`;
        }
      }

      if (this.list) this.list.hidden = true;

      if (this.state.etaMin == null) this.updateEta();
    },

    /* =================== Utils =================== */
    hhmm(d){ const h=String(d.getHours()).padStart(2,'0'); const m=String(d.getMinutes()).padStart(2,'0'); return `${h}:${m}`; },
    escape(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c)); },
    escapeAttr(s){ return String(s||'').replace(/"/g,'&quot;') },

    geocodeAddr(_addr){ return Promise.resolve(null); }, // nicht mehr nötig – Server erledigt das

    buildStaticMapURL(origin, destText){
      try{
        const key = window.SVS_GMAPS_KEY || '';
        if (!key || !destText) return '';
        const base  = 'https://maps.googleapis.com/maps/api/staticmap';
        const w = 640, h = 360;
        const scale = (window.devicePixelRatio>1) ? 2 : 1;

        const params = [
          `size=${w}x${h}`,
          `scale=${scale}`,
          `maptype=roadmap`,
          `language=de`,
          `region=DE`
        ];
        params.push(`markers=${encodeURIComponent('color:red|label:B|' + destText)}`);
        if (origin?.lat != null && origin?.lon != null) {
          params.push(`markers=${encodeURIComponent(`color:green|label:A|${origin.lat},${origin.lon}`)}`);
        } else {
          params.push(`center=${encodeURIComponent(destText)}`);
          params.push(`zoom=12`);
        }
        params.push(`key=${encodeURIComponent(key)}`);
        return `${base}?${params.join('&')}`;
      }catch(_){ return ''; }
    }
  };

  document.addEventListener('DOMContentLoaded', ()=> RW.init());
})();