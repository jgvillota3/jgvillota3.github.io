// Inicio de sesión con Google (Google Identity Services) y llamadas a las APIs.
import { CONFIG } from './config.js';

const TOKEN_KEY = 'home.token';
let tokenClient = null;
let pending = null;
const listeners = new Set();

export function onAuthChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach(fn => fn(isSignedIn())); }

function readToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; }
}
function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch {} }

export function hasEverSignedIn() { return !!localStorage.getItem('home.email'); }
export function isSignedIn() {
  const t = readToken();
  return !!t && t.exp > Date.now() + 60000;
}
export function userEmail() { return localStorage.getItem('home.email') || ''; }

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el inicio de sesión de Google'));
    document.head.appendChild(s);
  });
}

export async function signIn({ silent = false } = {}) {
  await loadGis();
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: () => {}
    });
  }
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      pending = null;
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken({ access: resp.access_token, exp: Date.now() + (resp.expires_in - 30) * 1000 });
      if (!userEmail()) {
        try {
          const me = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } }).then(r => r.json());
          if (me.email) localStorage.setItem('home.email', me.email);
        } catch {}
      }
      emit(); resolve();
    };
    tokenClient.error_callback = (e) => { pending = null; reject(new Error(e?.type || 'popup_closed')); };
    tokenClient.requestAccessToken({ prompt: silent || hasEverSignedIn() ? '' : 'consent', login_hint: userEmail() || undefined });
  });
  return pending;
}

export function signOut() {
  const t = readToken();
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t.access, () => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('home.email');
  emit();
}

export class AuthNeeded extends Error {}

export async function api(url, opts = {}) {
  const t = readToken();
  if (!t || t.exp < Date.now()) { emit(); throw new AuthNeeded('Sesión vencida'); }
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + t.access, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
  });
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); emit(); throw new AuthNeeded('Sesión vencida'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || ('Error ' + res.status));
  return data;
}

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
const CAL = 'https://www.googleapis.com/calendar/v3/';
const enc = encodeURIComponent;

export const sheets = {
  batchGet: (id, ranges) => api(SHEETS + id + '/values:batchGet?' + ranges.map(r => 'ranges=' + enc(r)).join('&') + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'),
  meta: (id) => api(SHEETS + id + '?fields=sheets.properties(sheetId,title)'),
  update: (id, range, values, mode = 'USER_ENTERED') => api(SHEETS + id + '/values/' + enc(range) + '?valueInputOption=' + mode, { method: 'PUT', body: { values } }),
  append: (id, range, values, mode = 'USER_ENTERED') => api(SHEETS + id + '/values/' + enc(range) + ':append?valueInputOption=' + mode + '&insertDataOption=INSERT_ROWS', { method: 'POST', body: { values } }),
  batchUpdate: (id, requests) => api(SHEETS + id + ':batchUpdate', { method: 'POST', body: { requests } }),
  create: (body) => api(SHEETS, { method: 'POST', body })
};

export const drive = {
  findSheet: (name) => api('https://www.googleapis.com/drive/v3/files?q=' + enc(`name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`) + '&fields=files(id,name)&spaces=drive')
};

export const calendar = {
  list: () => api(CAL + 'users/me/calendarList?minAccessRole=writer'),
  createCalendar: (summary) => api(CAL + 'calendars', { method: 'POST', body: { summary, timeZone: 'America/Bogota' } }),
  events: (calId, timeMin, timeMax, extra = '') => api(CAL + 'calendars/' + enc(calId) + '/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=' + enc(timeMin) + '&timeMax=' + enc(timeMax) + extra),
  rawEvents: (calId, extra) => api(CAL + 'calendars/' + enc(calId) + '/events?maxResults=500' + extra),
  insert: (calId, ev) => api(CAL + 'calendars/' + enc(calId) + '/events', { method: 'POST', body: ev }),
  patch: (calId, id, ev) => api(CAL + 'calendars/' + enc(calId) + '/events/' + enc(id), { method: 'PATCH', body: ev }),
  remove: (calId, id) => api(CAL + 'calendars/' + enc(calId) + '/events/' + enc(id), { method: 'DELETE' })
};
