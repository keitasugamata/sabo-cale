import React, { useMemo, useRef, useEffect } from 'react';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  toDateString,
  isToday,
  isPastDate,
  DAYS_JP,
} from '../utils/dateUtils';

const MAX_CHIPS = 20;

function EventChip({ event, getChipColor }) {
  const bg = event.completed ? 'var(--chip-done)' : getChipColor(event);
  return (
    <div className="ev-chip" style={{ background: bg }}>
      {event.completed && <span className="ev-check">✓</span>}
      {event.title}
    </div>
  );
}

function DayCell({ year, month, day, events, selected, onSelect, onLongPress, getChipColor }) {
  const dateStr = toDateString(year, month, day);
  const today   = isToday(year, month, day);
  const past    = isPastDate(year, month, day);
  const isSel   = selected === dateStr;
  const dow     = new Date(year, month, day).getDay();
  const cellRef = useRef();

  // ─── ネイティブイベントで長押し検知 ───
  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;

    let timer = null;
    let startX = 0, startY = 0;
    let moved = false;
    let longPressed = false;

    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
      longPressed = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!moved) {
          longPressed = true;
          if (navigator.vibrate) navigator.vibrate(40);
          onLongPress(dateStr);
        }
        timer = null;
      }, 450);
    };

    const move = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
        moved = true;
        if (timer) { clearTimeout(timer); timer = null; }
      }
    };

    const end = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!moved && !longPressed) onSelect(dateStr);
    };

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('mousedown', start);
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', cancel);

    return () => {
      cancel();
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', cancel);
      el.removeEventListener('mousedown', start);
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseup', end);
      el.removeEventListener('mouseleave', cancel);
    };
  }, [dateStr, onSelect, onLongPress]);

  const sorted  = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const visible = sorted.slice(0, MAX_CHIPS);
  const rest    = sorted.length - visible.length;

  const numClass = [
    'cal-day-num',
    dow === 0 ? 'sun' : dow === 6 ? 'sat' : '',
    past && !today ? 'past' : '',
    today ? 'today-num' : '',
    isSel && !today ? 'sel-num' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={cellRef}
      className={['cal-cell', isSel ? 'selected' : ''].filter(Boolean).join(' ')}
    >
      <div className="cal-day-header">
        <span className={numClass}>{day}</span>
      </div>
      <div className="cal-chips">
        {visible.map((ev) => (
          <EventChip key={ev.id} event={ev} getChipColor={getChipColor} />
        ))}
        {rest > 0 && <div className="ev-rest">+{rest}件</div>}
      </div>
    </div>
  );
}

export default function MonthCalendar({
  year, month, slideDir, events, selectedDate, onSelectDate,
  onLongPressDate, onSwipeMonth, getChipColor,
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const gridRef = useRef();

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  // ─── ネイティブイベントでスワイプ検知 ───
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    let startX = 0, startY = 0, startT = 0;
    let captured = false;

    const onStart = (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
      captured = false;
    };

    const onMove = (e) => {
      if (captured) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // 横方向の動きが縦方向より明らかに大きい場合のみキャプチャ
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        captured = true;
      }
    };

    const onEnd = (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 600) {
        onSwipeMonth?.(dx > 0 ? -1 : 1);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [onSwipeMonth]);

  const emptyCells = Array(firstDay).fill(null);

  return (
    <div className="month-calendar">
      <div className="cal-header-row">
        {DAYS_JP.map((d, i) => (
          <div key={d} className={`cal-header-cell ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
            {d}
          </div>
        ))}
      </div>
      <div
        className={`cal-grid slide-${slideDir || 'none'}`}
        ref={gridRef}
        key={`${year}-${month}`}
      >
        {emptyCells.map((_, i) => (
          <div key={`e${i}`} className="cal-cell cal-cell-empty" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <DayCell
            key={day}
            year={year}
            month={month}
            day={day}
            events={eventsByDate[toDateString(year, month, day)] || []}
            selected={selectedDate}
            onSelect={onSelectDate}
            onLongPress={onLongPressDate}
            getChipColor={getChipColor}
          />
        ))}
      </div>
    </div>
  );
}
