import React, { useState, useEffect } from 'react';
import { X, RefreshCw, LogOut, Check, AlertCircle, CloudOff } from 'lucide-react';
import {
  isConfigured,
  initGoogleCalendar,
  requestToken,
  revokeToken,
  isSignedIn,
  isInitialized,
  listCalendars,
  pushEventToGoogle,
  fetchGoogleEvents,
} from '../utils/googleCalendar';
import { getSetting, saveSetting } from '../db';
import { generateId } from '../utils/dateUtils';

export default function SyncModal({ events, year, month, onImport, onUpdateEvent, onClose }) {
  const configured = isConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [calendars, setCalendars] = useState([]);
  const [selectedCalId, setSelectedCalId] = useState('primary');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    getSetting('googleCalendarId').then((id) => { if (id) setSelectedCalId(id); });
    if (configured && isInitialized()) setSignedIn(isSignedIn());
  }, []);

  async function handleSignIn() {
    try {
      setError('');
      setInitializing(true);
      if (!isInitialized()) await initGoogleCalendar();
      await requestToken();
      setSignedIn(true);
      const cals = await listCalendars();
      setCalendars(cals);
    } catch (e) {
      setError('ログイン失敗: ' + (e.message || e));
    } finally {
      setInitializing(false);
    }
  }

  function handleSignOut() {
    revokeToken();
    setSignedIn(false);
    setStatus('');
    setCalendars([]);
  }

  async function handlePush() {
    setSyncing(true); setError(''); setStatus('');
    try {
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthEvents = events.filter((e) => e.date.startsWith(prefix));
      let count = 0;
      for (const ev of monthEvents) {
        const result = await pushEventToGoogle(ev, selectedCalId);
        if (!ev.googleEventId) onUpdateEvent(ev.id, { googleEventId: result.id });
        count++;
      }
      await saveSetting('googleCalendarId', selectedCalId);
      setStatus(`${count}件をGoogleに送信しました`);
    } catch (e) {
      setError('送信失敗: ' + (e.message || e));
    }
    setSyncing(false);
  }

  async function handlePull() {
    setSyncing(true); setError(''); setStatus('');
    try {
      const googleEvents = await fetchGoogleEvents(selectedCalId, year, month);
      const newEvents = googleEvents.map((ev) => ({ ...ev, id: generateId() }));
      await onImport(newEvents);
      await saveSetting('googleCalendarId', selectedCalId);
      setStatus(`${newEvents.length}件をインポートしました`);
    } catch (e) {
      setError('取得失敗: ' + (e.message || e));
    }
    setSyncing(false);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-header">
          <h2>Google カレンダー連携</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {!configured ? (
            /* 開発者がキー未設定 */
            <div className="sync-not-configured">
              <CloudOff size={32} color="var(--text-muted)" />
              <p>Google連携が設定されていません</p>
              <p className="sync-hint">
                アプリ管理者が <code>.env</code> にAPIキーとクライアントIDを設定する必要があります。
                詳しくは <code>.env.example</code> を参照してください。
              </p>
            </div>
          ) : !signedIn ? (
            /* ログイン前 */
            <div className="sync-login-area">
              <div className="sync-google-logo">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                  alt="" width={32} height={32}
                />
              </div>
              <p className="sync-login-desc">
                Google カレンダーと予定を同期できます。<br />
                Googleアカウントでログインしてください。
              </p>
              <button className="btn btn-primary btn-block" onClick={handleSignIn} disabled={initializing}>
                {initializing ? <RefreshCw size={14} className="spin" /> : null}
                Google でログイン
              </button>
            </div>
          ) : (
            /* ログイン済み */
            <div className="sync-controls">
              <div className="sync-signed-in">
                <Check size={14} color="var(--success)" />
                <span>ログイン済み</span>
                <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                  <LogOut size={12} /> ログアウト
                </button>
              </div>

              {calendars.length > 0 && (
                <select
                  className="sync-input"
                  value={selectedCalId}
                  onChange={(e) => setSelectedCalId(e.target.value)}
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
              )}

              <div className="sync-btn-row">
                <button className="btn btn-primary" onClick={handlePush} disabled={syncing}>
                  <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                  Googleへ送信（{month + 1}月）
                </button>
                <button className="btn btn-ghost" onClick={handlePull} disabled={syncing}>
                  Googleから取得
                </button>
              </div>
            </div>
          )}

          {/* iCloud */}
          <section className="modal-section" style={{ marginTop: 24 }}>
            <h3 className="sync-service-title">☁️ iCloud カレンダー</h3>
            <div className="icloud-note">
              <AlertCircle size={14} />
              <p>
                iCloudカレンダーとの直接同期はブラウザ制約で対応不可です。
                Google カレンダー経由で同期するか、Fantastical等のアプリで
                両方のカレンダーを統合する方法を推奨します。
              </p>
            </div>
          </section>

          {status && <p className="sync-status success">✅ {status}</p>}
          {error && <p className="sync-status error"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>
    </div>
  );
}
