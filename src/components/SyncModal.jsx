import React, { useState, useEffect } from 'react';
import { X, RefreshCw, LogOut, Check, AlertCircle, CloudOff, Trash2 } from 'lucide-react';
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

export default function SyncModal({ events, year, month, onImport, onUpdateEvent, onCalendarsRefresh, onDeleteAll, onClose }) {
  const configured = isConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [calendars, setCalendars] = useState([]);
  const [sourceCalIds, setSourceCalIds] = useState([]); // 取得元（複数）
  const [pushCalId, setPushCalId] = useState('primary'); // 送信先（1つ）
  const [initializing, setInitializing] = useState(false);

  // 設定読み込み
  useEffect(() => {
    getSetting('googleSourceCalIds').then((ids) => {
      if (Array.isArray(ids) && ids.length) setSourceCalIds(ids);
    });
    getSetting('googlePushCalId').then((id) => { if (id) setPushCalId(id); });
    if (configured && isInitialized() && isSignedIn()) {
      setSignedIn(true);
      listCalendars().then(setCalendars).catch(() => {});
    }
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
      onCalendarsRefresh?.();
      // 初回ログイン時、取得元が未設定なら全部チェック
      if (sourceCalIds.length === 0) {
        setSourceCalIds(cals.map((c) => c.id));
      }
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

  function toggleSource(calId) {
    setSourceCalIds((prev) =>
      prev.includes(calId) ? prev.filter((id) => id !== calId) : [...prev, calId]
    );
  }

  function selectAllSources() { setSourceCalIds(calendars.map((c) => c.id)); }
  function clearAllSources() { setSourceCalIds([]); }

  async function handlePush() {
    setSyncing(true); setError(''); setStatus('');
    try {
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthEvents = events.filter((e) => e.date.startsWith(prefix));
      let count = 0;
      for (const ev of monthEvents) {
        const result = await pushEventToGoogle(ev, pushCalId);
        if (!ev.googleEventId) onUpdateEvent(ev.id, { googleEventId: result.id });
        count++;
      }
      await saveSetting('googlePushCalId', pushCalId);
      const calName = calendars.find((c) => c.id === pushCalId)?.summary || pushCalId;
      setStatus(`${count}件を「${calName}」に送信しました`);
    } catch (e) {
      setError('送信失敗: ' + (e.message || e));
    }
    setSyncing(false);
  }

  async function handlePull() {
    setSyncing(true); setError(''); setStatus('');
    try {
      if (sourceCalIds.length === 0) {
        setError('取得元カレンダーを1つ以上選択してください');
        setSyncing(false);
        return;
      }
      let totalImported = 0;
      const allNew = [];
      for (const calId of sourceCalIds) {
        const googleEvents = await fetchGoogleEvents(calId, year, month);
        const calColor = calendars.find((c) => c.id === calId)?.backgroundColor || '#4285F4';
        const newEvents = googleEvents.map((ev) => ({
          ...ev,
          id: generateId(),
          color: calColor,
          sourceCalendarId: calId,
        }));
        allNew.push(...newEvents);
        totalImported += newEvents.length;
      }
      await onImport(allNew);
      await saveSetting('googleSourceCalIds', sourceCalIds);
      setStatus(`${sourceCalIds.length}個のカレンダーから${totalImported}件をインポートしました`);
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
            <div className="sync-not-configured">
              <CloudOff size={32} color="var(--text-muted)" />
              <p>Google連携が設定されていません</p>
              <p className="sync-hint">
                アプリ管理者が <code>.env</code> にAPIキーとクライアントIDを設定する必要があります。
              </p>
            </div>
          ) : !signedIn ? (
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
            <div className="sync-controls">
              <div className="sync-signed-in">
                <Check size={14} color="var(--success)" />
                <span>ログイン済み</span>
                <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                  <LogOut size={12} /> ログアウト
                </button>
              </div>

              {calendars.length > 0 && (
                <>
                  {/* 取得元（複数） */}
                  <div className="cal-sub-section">
                    <div className="cal-sub-header">
                      <label className="section-label" style={{ margin: 0 }}>取得元カレンダー</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={selectAllSources}>全選択</button>
                        <button className="btn btn-ghost btn-sm" onClick={clearAllSources}>クリア</button>
                      </div>
                    </div>
                    <div className="cal-checklist">
                      {calendars.map((c) => (
                        <label key={c.id} className="cal-check-row">
                          <input
                            type="checkbox"
                            checked={sourceCalIds.includes(c.id)}
                            onChange={() => toggleSource(c.id)}
                          />
                          <span
                            className="cal-color-dot"
                            style={{ background: c.backgroundColor || '#4285F4' }}
                          />
                          <span className="cal-name">{c.summary}</span>
                          {c.primary && <span className="cal-badge">メイン</span>}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 送信先（1つ） */}
                  <div className="cal-sub-section">
                    <label className="section-label">新規予定の送信先</label>
                    <select
                      className="sync-input"
                      value={pushCalId}
                      onChange={(e) => setPushCalId(e.target.value)}
                    >
                      {calendars
                        .filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.summary}</option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              <div className="sync-btn-row">
                <button className="btn btn-ghost" onClick={handlePull} disabled={syncing || sourceCalIds.length === 0}>
                  <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                  Googleから取得（{sourceCalIds.length}個）
                </button>
                <button className="btn btn-primary" onClick={handlePush} disabled={syncing}>
                  Googleへ送信（{month + 1}月）
                </button>
              </div>
            </div>
          )}

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

          {/* 危険ゾーン */}
          <section className="modal-section danger-zone">
            <h3 className="sync-service-title" style={{ color: 'var(--danger)' }}>
              ⚠️ 危険ゾーン
            </h3>
            <p className="sync-hint">
              サボカレ上の全イベント（{events.length}件）を削除します。<br />
              <strong>※ Googleカレンダー側の元データは消えません。</strong><br />
              再インポートすれば元に戻せます。
            </p>
            {confirmDelete ? (
              <div className="delete-confirm-row">
                <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>
                  本当に{events.length}件すべて削除しますか？
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      await onDeleteAll();
                      setConfirmDelete(false);
                      setStatus('全イベントを削除しました');
                    }}
                  >
                    <Trash2 size={14} /> 削除する
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(true)}
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                <Trash2 size={14} /> 全イベントを削除
              </button>
            )}
          </section>

          {status && <p className="sync-status success">✅ {status}</p>}
          {error && <p className="sync-status error"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>
    </div>
  );
}
