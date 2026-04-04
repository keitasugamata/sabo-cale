// Google Calendar API — 環境変数からキーを読み込み
const API_KEY   = import.meta.env.VITE_GOOGLE_API_KEY   || '';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES    = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient = null;
let initialized = false;

// ── 設定チェック ─────────────────────────────
export function isConfigured() {
  return !!(API_KEY && CLIENT_ID);
}

// ── スクリプトローダー ───────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 初期化 ───────────────────────────────────
export async function initGoogleCalendar() {
  if (!isConfigured()) throw new Error('Google API keys not configured');
  if (initialized) return true;

  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]);

  await new Promise((r) => window.gapi.load('client', r));
  await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY] });

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });

  initialized = true;
  return true;
}

export function isInitialized() { return initialized; }

// ── 認証 ─────────────────────────────────────
export function requestToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('not initialized')); return; }
    tokenClient.callback = (res) => res.error ? reject(res.error) : resolve(res);
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function revokeToken() {
  const token = window.gapi?.client?.getToken();
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
  }
}

export function isSignedIn() {
  return !!window.gapi?.client?.getToken();
}

// ── カレンダー操作 ───────────────────────────
export async function listCalendars() {
  const res = await window.gapi.client.calendar.calendarList.list();
  return res.result.items || [];
}

export async function pushEventToGoogle(event, calendarId = 'primary') {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(event.date + 'T' + event.startTime + ':00');
  const end = new Date(start.getTime() + event.duration * 60000);

  const body = {
    summary: event.title,
    description: buildDesc(event),
    start: { dateTime: start.toISOString(), timeZone: tz },
    end:   { dateTime: end.toISOString(),   timeZone: tz },
  };

  if (event.googleEventId) {
    const res = await window.gapi.client.calendar.events.update({
      calendarId, eventId: event.googleEventId, resource: body,
    });
    return res.result;
  } else {
    const res = await window.gapi.client.calendar.events.insert({
      calendarId, resource: body,
    });
    return res.result;
  }
}

export async function fetchGoogleEvents(calendarId = 'primary', year, month) {
  const timeMin = new Date(year, month, 1).toISOString();
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const res = await window.gapi.client.calendar.events.list({
    calendarId, timeMin, timeMax,
    singleEvents: true, orderBy: 'startTime', maxResults: 250,
  });

  return (res.result.items || []).map(googleEventToLocal);
}

export async function deleteGoogleEvent(eventId, calendarId = 'primary') {
  await window.gapi.client.calendar.events.delete({ calendarId, eventId });
}

// ── ヘルパー ─────────────────────────────────
function buildDesc(event) {
  const parts = [];
  if (event.preMemo?.trim()) parts.push(`【事前メモ】\n${event.preMemo.trim()}`);
  if (event.retrospectiveMemo?.trim()) parts.push(`【振り返り】\n${event.retrospectiveMemo.trim()}`);
  return parts.join('\n\n');
}

function googleEventToLocal(ge) {
  const startDT = ge.start?.dateTime || ge.start?.date + 'T00:00:00';
  const endDT   = ge.end?.dateTime   || ge.end?.date   + 'T01:00:00';
  const start = new Date(startDT);
  const end   = new Date(endDT);

  return {
    id: `g-${ge.id}`,
    googleEventId: ge.id,
    title: ge.summary || '(無題)',
    date: startDT.slice(0, 10),
    startTime: start.toTimeString().slice(0, 5),
    duration: Math.round((end - start) / 60000) || 60,
    tags: { with: '', what: '', where: '' },
    preMemo: '',
    retrospectiveMemo: '',
    completed: false,
    fromGoogle: true,
    color: '#4285F4',
    createdAt: Date.now(),
  };
}
