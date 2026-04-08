import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Tag, Share2, RefreshCw, Moon, Sun, Type, User, LogIn } from 'lucide-react';
import MonthCalendar from './components/MonthCalendar';
import DayDetail from './components/DayDetail';
import EventModal from './components/EventModal';
import TagManager from './components/TagManager';
import ExportModal from './components/ExportModal';
import SyncModal from './components/SyncModal';
import AuthModal from './components/AuthModal';
import { useEvents } from './hooks/useEvents';
import { useTags } from './hooks/useTags';
import { useGoogleCalendars } from './hooks/useGoogleCalendars';
import { supabase } from './supabase';
import { getSetting, saveSetting } from './db';
import { MONTHS_JP, addMonths, toDateString, generateId } from './utils/dateUtils';
import { toChipColor } from './utils/colorUtils';

const CHIP_SIZES = ['xs', 's', 'm', 'l'];
const CHIP_SIZE_LABELS = { xs: '極小', s: '小', m: '中', l: '大' };

export default function App() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    toDateString(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [screen, setScreen] = useState('calendar');
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 認証
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // ダークモード
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('sabocare-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('sabocare-dark', darkMode);
  }, [darkMode]);

  // チップサイズ
  const [chipSize, setChipSize] = useState(() => localStorage.getItem('sabocare-chip') || 's');
  useEffect(() => {
    document.documentElement.dataset.chipSize = chipSize;
    localStorage.setItem('sabocare-chip', chipSize);
  }, [chipSize]);

  const {
    events, loading,
    addEvent, updateEvent, updateAllRecurring,
    removeEvent, removeAllRecurring, removeAllEvents,
    toggleComplete,
    getEventsForDate, getEventsForMonth, importEvents,
  } = useEvents(user);

  const { tags, addTag, removeTag, updateTag, getTagsByCategory, incrementUsage } = useTags(user);

  // Google カレンダー
  const {
    calendars: googleCalendars,
    refresh: refreshGoogleCals,
    push: pushToGoogle,
    remove: deleteFromGoogle,
    fetchAll: fetchGoogleCal,
  } = useGoogleCalendars();
  const [defaultPushCalId, setDefaultPushCalId] = useState('');
  const [sourceCalIds, setSourceCalIds] = useState([]);
  const [autoSyncing, setAutoSyncing] = useState(false);

  useEffect(() => {
    getSetting('googlePushCalId').then((id) => { if (id) setDefaultPushCalId(id); });
    getSetting('googleSourceCalIds').then((ids) => {
      if (Array.isArray(ids)) setSourceCalIds(ids);
    });
  }, []);

  // 状態を ref で参照（自動同期の依存ループ防止）
  const eventsRef = useRef([]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
  }

  const withTags   = getTagsByCategory('with');
  const whatTags   = getTagsByCategory('what');
  const whereTags  = getTagsByCategory('where');
  const monthEvents = getEventsForMonth(year, month);
  const dayEvents   = selectedDate ? getEventsForDate(selectedDate) : [];

  // チップ色：Google カレンダー > 何をする > 誰と > イベント色
  // ダークトーンに変換して白文字でも視認性を確保
  const getChipColor = useCallback((event) => {
    let raw = event.color || '#7C3AED';
    if (event.googleCalendarId) {
      const cal = googleCalendars.find((c) => c.id === event.googleCalendarId);
      if (cal?.backgroundColor) raw = cal.backgroundColor;
    } else if (event.tags?.what) {
      const tag = whatTags.find((t) => t.label === event.tags.what);
      if (tag) raw = tag.color;
    } else if (event.tags?.with) {
      const tag = withTags.find((t) => t.label === event.tags.with);
      if (tag) raw = tag.color;
    }
    return toChipColor(raw);
  }, [whatTags, withTags, googleCalendars]);

  // タグ色変更ハンドラ
  function handleTagColorChange(tagId, newColor) {
    updateTag(tagId, { color: newColor });
  }

  // 月遷移アニメーション方向
  const [slideDir, setSlideDir] = useState(null);

  function navigate(delta) {
    setSlideDir(delta > 0 ? 'next' : 'prev');
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  // ─── 自動同期：Google → サボカレ ─────────────────
  const syncFromGoogle = useCallback(async (yr = year, mo = month) => {
    if (!googleCalendars.length || !sourceCalIds.length) return;
    setAutoSyncing(true);
    try {
      // 1. 全ソースカレンダーから取得
      const allGoogleEvents = [];
      for (const calId of sourceCalIds) {
        try {
          const ge = await fetchGoogleCal(calId, yr, mo);
          const cal = googleCalendars.find((c) => c.id === calId);
          ge.forEach((e) => {
            e.color = cal?.backgroundColor || '#4285F4';
            e.googleCalendarId = calId;
          });
          allGoogleEvents.push(...ge);
        } catch (e) { console.warn('Pull failed:', calId, e); }
      }

      // 2. 当月のローカルイベント（googleEventId 持ちのみ）
      const prefix = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      const localMonth = eventsRef.current.filter((e) => e.date.startsWith(prefix));
      const localByGid = new Map(
        localMonth.filter((e) => e.googleEventId).map((e) => [e.googleEventId, e])
      );
      const googleGids = new Set(allGoogleEvents.map((e) => e.googleEventId));

      // 3. Google にあって ローカルにない → 追加
      const toAdd = allGoogleEvents
        .filter((g) => !localByGid.has(g.googleEventId))
        .map((g) => ({ ...g, id: generateId() }));

      // 4. 両方にある → 更新
      const toUpdate = allGoogleEvents
        .filter((g) => localByGid.has(g.googleEventId))
        .map((g) => {
          const local = localByGid.get(g.googleEventId);
          return {
            ...local,
            title: g.title,
            date: g.date,
            startTime: g.startTime,
            duration: g.duration,
            color: g.color,
            googleCalendarId: g.googleCalendarId,
          };
        });

      // 5. ローカルにあって Google にない → 削除
      const toDelete = localMonth.filter(
        (e) => e.googleEventId && !googleGids.has(e.googleEventId)
      );

      if (toAdd.length) await importEvents(toAdd);
      for (const ev of toUpdate) await updateEvent(ev.id, ev);
      for (const ev of toDelete) await removeEvent(ev.id);
    } catch (e) {
      console.error('自動同期失敗:', e);
    }
    setAutoSyncing(false);
  }, [googleCalendars, sourceCalIds, year, month, fetchGoogleCal, importEvents, updateEvent, removeEvent]);

  // 起動時 / フォーカス時 / 月切替時に自動同期
  useEffect(() => {
    if (googleCalendars.length > 0 && sourceCalIds.length > 0) {
      syncFromGoogle(year, month);
    }
  }, [googleCalendars.length, sourceCalIds.length, year, month]);

  useEffect(() => {
    const onFocus = () => {
      if (googleCalendars.length > 0 && sourceCalIds.length > 0) {
        syncFromGoogle();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [syncFromGoogle, googleCalendars.length, sourceCalIds.length]);

  function handleAddEvent() { setEditingEvent(null); setShowEventModal(true); }
  function handleEditEvent(ev) { setEditingEvent(ev); setShowEventModal(true); }

  // 削除時、Google にもある予定なら Google 側からも削除
  async function handleRemoveEvent(id) {
    const ev = eventsRef.current.find((e) => e.id === id);
    if (ev?.googleEventId && ev?.googleCalendarId) {
      try {
        await deleteFromGoogle(ev.googleEventId, ev.googleCalendarId);
      } catch (e) { console.warn('Google delete failed:', e); }
    }
    await removeEvent(id);
  }

  async function handleRemoveAllRecurring(masterId) {
    const targets = eventsRef.current.filter((e) => e.masterId === masterId || e.id === masterId);
    for (const ev of targets) {
      if (ev.googleEventId && ev.googleCalendarId) {
        try { await deleteFromGoogle(ev.googleEventId, ev.googleCalendarId); }
        catch (e) { console.warn('Google delete failed:', e); }
      }
    }
    await removeAllRecurring(masterId);
  }

  // 長押しポップアップ用
  const [longPressPopup, setLongPressPopup] = useState(null);

  // 日付の長押し → ポップアップ
  function handleLongPressDate(dateStr) {
    setLongPressPopup({ date: dateStr });
  }

  function confirmAddFromPopup() {
    if (!longPressPopup) return;
    setSelectedDate(longPressPopup.date);
    setEditingEvent(null);
    setShowEventModal(true);
    setLongPressPopup(null);
  }

  // スワイプで月移動
  function handleSwipeMonth(delta) {
    navigate(delta);
  }

  async function handleSaveEvent(eventData, withTag, whatTag, whereTag, recurrenceType, editScope) {
    // Google カレンダー送信（指定があれば）
    if (eventData.googleCalendarId) {
      try {
        const result = await pushToGoogle(eventData, eventData.googleCalendarId);
        eventData.googleEventId = result.id;
        if (eventData.googleCalendarId !== defaultPushCalId) {
          setDefaultPushCalId(eventData.googleCalendarId);
          saveSetting('googlePushCalId', eventData.googleCalendarId);
        }
      } catch (e) {
        console.error('Google送信失敗:', e);
        alert('Googleカレンダーへの送信に失敗しました（ローカルには保存されます）');
      }
    }

    if (editingEvent) {
      if (editScope === 'all' && (editingEvent.masterId || editingEvent.recurrenceType)) {
        const masterId = editingEvent.masterId || editingEvent.id;
        await updateAllRecurring(masterId, {
          title: eventData.title,
          startTime: eventData.startTime,
          duration: eventData.duration,
          tags: eventData.tags,
          color: eventData.color,
          preMemo: eventData.preMemo,
          retrospectiveMemo: eventData.retrospectiveMemo,
        });
      } else {
        await updateEvent(eventData.id, eventData);
      }
    } else {
      await addEvent(eventData, recurrenceType);
    }
    if (withTag) incrementUsage(withTag.id);
    if (whatTag) incrementUsage(whatTag.id);
    if (whereTag) incrementUsage(whereTag.id);
  }

  async function handleCreateTag(tag) { await addTag(tag); }

  if (loading) {
    return <div className="loading-screen"><span className="loading-icon">😪</span></div>;
  }

  if (screen === 'tags') {
    return (
      <TagManager
        withTags={withTags}
        whatTags={whatTags}
        whereTags={whereTags}
        events={events}
        onAdd={addTag}
        onDelete={removeTag}
        onColorChange={handleTagColorChange}
        onBack={() => setScreen('calendar')}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="app-logo">😪</span>
          <span className="app-name">サボカレ</span>
        </div>
        <div className="header-center">
          <button className="nav-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /></button>
          <button className="month-label" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
            {year}年{MONTHS_JP[month]}
          </button>
          <button className="nav-btn" onClick={() => navigate(1)}><ChevronRight size={20} /></button>
        </div>
        <div className="header-right">
          {/* 文字サイズ切り替え */}
          <div className="size-picker-wrap">
            <button className="icon-btn" onClick={() => setShowSizePicker((v) => !v)} title="文字サイズ">
              <Type size={17} />
            </button>
            {showSizePicker && (
              <div className="size-picker-popup">
                {CHIP_SIZES.map((s) => (
                  <button
                    key={s}
                    className={`size-opt ${chipSize === s ? 'active' : ''}`}
                    onClick={() => { setChipSize(s); setShowSizePicker(false); }}
                  >
                    {CHIP_SIZE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setDarkMode((v) => !v)} title="テーマ切り替え">
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="icon-btn" onClick={() => setScreen('tags')} title="タグ管理"><Tag size={17} /></button>
          <button className="icon-btn" onClick={() => setScreen('sync')} title="同期">
            <RefreshCw size={17} className={autoSyncing ? 'spin' : ''} />
          </button>
          <button className="icon-btn" onClick={() => setScreen('export')} title="エクスポート"><Share2 size={17} /></button>
          {user ? (
            <div className="user-menu-wrap">
              <button className="icon-btn user-btn" onClick={() => setShowUserMenu((v) => !v)} title="アカウント">
                <User size={17} />
                <span className="user-dot" />
              </button>
              {showUserMenu && (
                <>
                  <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <div className="user-menu-icon">👤</div>
                      <div className="user-menu-email">{user.email}</div>
                      <div className="user-menu-status">✅ ログイン中</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-block"
                      onClick={async () => { setShowUserMenu(false); await handleSignOut(); }}
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                      ログアウト
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="icon-btn" onClick={() => setShowAuthModal(true)} title="ログイン">
              <LogIn size={17} />
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <MonthCalendar
          year={year} month={month}
          slideDir={slideDir}
          events={monthEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onLongPressDate={handleLongPressDate}
          onSwipeMonth={handleSwipeMonth}
          getChipColor={getChipColor}
        />
        {selectedDate && (
          <DayDetail
            date={selectedDate}
            events={dayEvents}
            onAdd={handleAddEvent}
            onToggle={toggleComplete}
            onEdit={handleEditEvent}
          />
        )}
      </main>

      {showEventModal && (
        <EventModal
          date={selectedDate}
          event={editingEvent}
          withTags={withTags}
          whatTags={whatTags}
          whereTags={whereTags}
          googleCalendars={googleCalendars}
          defaultPushCalId={defaultPushCalId}
          onSave={handleSaveEvent}
          onDelete={handleRemoveEvent}
          onDeleteAll={handleRemoveAllRecurring}
          onCreateTag={handleCreateTag}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        />
      )}

      {screen === 'export' && (
        <ExportModal
          events={events}
          selectedDate={selectedDate}
          year={year} month={month}
          onClose={() => setScreen('calendar')}
        />
      )}

      {screen === 'sync' && (
        <SyncModal
          events={events}
          year={year} month={month}
          onImport={importEvents}
          onUpdateEvent={updateEvent}
          onCalendarsRefresh={refreshGoogleCals}
          onSourceCalsChange={setSourceCalIds}
          onDeleteAll={removeAllEvents}
          onClose={() => setScreen('calendar')}
        />
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {/* 長押し確認ポップアップ */}
      {longPressPopup && (
        <div className="lp-popup-overlay" onClick={() => setLongPressPopup(null)}>
          <div className="lp-popup" onClick={(e) => e.stopPropagation()}>
            <div className="lp-popup-icon">📅</div>
            <div className="lp-popup-date">
              {longPressPopup.date.replace(/-/g, '/').replace(/^(\d+)\/(\d+)\/(\d+)$/, '$1年$2月$3日')}
            </div>
            <div className="lp-popup-msg">この日に予定を作成しますか？</div>
            <div className="lp-popup-actions">
              <button className="btn btn-ghost" onClick={() => setLongPressPopup(null)}>
                キャンセル
              </button>
              <button className="btn btn-primary" onClick={confirmAddFromPopup}>
                + 予定を作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
