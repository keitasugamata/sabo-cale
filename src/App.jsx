import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Tag, Share2, RefreshCw, Moon, Sun, Type } from 'lucide-react';
import MonthCalendar from './components/MonthCalendar';
import DayDetail from './components/DayDetail';
import EventModal from './components/EventModal';
import TagManager from './components/TagManager';
import ExportModal from './components/ExportModal';
import SyncModal from './components/SyncModal';
import { useEvents } from './hooks/useEvents';
import { useTags } from './hooks/useTags';
import { MONTHS_JP, addMonths, toDateString } from './utils/dateUtils';

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
    removeEvent, removeAllRecurring,
    toggleComplete,
    getEventsForDate, getEventsForMonth, importEvents,
  } = useEvents();

  const { tags, addTag, removeTag, updateTag, getTagsByCategory, incrementUsage } = useTags();

  const withTags   = getTagsByCategory('with');
  const whatTags   = getTagsByCategory('what');
  const whereTags  = getTagsByCategory('where');
  const monthEvents = getEventsForMonth(year, month);
  const dayEvents   = selectedDate ? getEventsForDate(selectedDate) : [];

  // 「何をする」タグの色をライブに反映する関数
  const getChipColor = useCallback((event) => {
    if (event.tags?.what) {
      const tag = whatTags.find((t) => t.label === event.tags.what);
      if (tag) return tag.color;
    }
    if (event.tags?.with) {
      const tag = withTags.find((t) => t.label === event.tags.with);
      if (tag) return tag.color;
    }
    return event.color || '#7C3AED';
  }, [whatTags, withTags]);

  // タグ色変更ハンドラ
  function handleTagColorChange(tagId, newColor) {
    updateTag(tagId, { color: newColor });
  }

  function navigate(delta) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  function handleAddEvent() { setEditingEvent(null); setShowEventModal(true); }
  function handleEditEvent(ev) { setEditingEvent(ev); setShowEventModal(true); }

  async function handleSaveEvent(eventData, withTag, whatTag, whereTag, recurrenceType, editScope) {
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
          <button className="icon-btn" onClick={() => setScreen('sync')} title="同期"><RefreshCw size={17} /></button>
          <button className="icon-btn" onClick={() => setScreen('export')} title="エクスポート"><Share2 size={17} /></button>
        </div>
      </header>

      <main className="app-main">
        <MonthCalendar
          year={year} month={month}
          events={monthEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
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
          onSave={handleSaveEvent}
          onDelete={removeEvent}
          onDeleteAll={removeAllRecurring}
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
          events={monthEvents}
          year={year} month={month}
          onImport={importEvents}
          onUpdateEvent={updateEvent}
          onClose={() => setScreen('calendar')}
        />
      )}
    </div>
  );
}
