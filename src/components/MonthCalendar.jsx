import React, { useMemo } from 'react';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  toDateString,
  isToday,
  isPastDate,
  DAYS_JP,
} from '../utils/dateUtils';

const MAX_CHIPS = 20; // 制限はCSSのセル高で自然に効く

function EventChip({ event, getChipColor }) {
  const bg = event.completed ? 'var(--chip-done)' : getChipColor(event);
  return (
    <div className="ev-chip" style={{ background: bg }}>
      {event.completed && <span className="ev-check">✓</span>}
      {event.title}
    </div>
  );
}

function DayCell({ year, month, day, events, selected, onSelect, getChipColor }) {
  const dateStr = toDateString(year, month, day);
  const today   = isToday(year, month, day);
  const past    = isPastDate(year, month, day);
  const isSel   = selected === dateStr;
  const dow     = new Date(year, month, day).getDay();

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
      className={['cal-cell', isSel ? 'selected' : ''].filter(Boolean).join(' ')}
      onClick={() => onSelect(dateStr)}
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

export default function MonthCalendar({ year, month, events, selectedDate, onSelectDate, getChipColor }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

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
      <div className="cal-grid">
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
            getChipColor={getChipColor}
          />
        ))}
      </div>
    </div>
  );
}
