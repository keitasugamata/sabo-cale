import React from 'react';
import { Plus, Check, ChevronRight } from 'lucide-react';
import { formatDateJP, formatDuration } from '../utils/dateUtils';

function EventItem({ event, onToggle, onEdit }) {
  return (
    <div
      className={`event-item ${event.completed ? 'completed' : ''}`}
      style={{ borderLeftColor: event.color || '#7C3AED' }}
    >
      <button
        className="event-check"
        onClick={() => onToggle(event.id)}
        aria-label={event.completed ? '未完了に戻す' : '完了にする'}
      >
        {event.completed ? <Check size={14} strokeWidth={3} /> : <span className="empty-check" />}
      </button>
      <div className="event-info" onClick={() => onEdit(event)}>
        <p className="event-title">
          {event.completed ? '✅ ' : ''}{event.title}
        </p>
        <p className="event-meta">
          {event.startTime} 〜 {formatDuration(event.duration)}
        </p>
        {event.preMemo && (
          <p className="event-memo-preview">{event.preMemo.slice(0, 40)}{event.preMemo.length > 40 ? '…' : ''}</p>
        )}
      </div>
      <button className="icon-btn" onClick={() => onEdit(event)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function DayDetail({ date, events, onAdd, onToggle, onEdit }) {
  const sorted = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="day-detail">
      <div className="day-detail-header">
        <span className="day-detail-date">{formatDateJP(date)}</span>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={14} />
          予定を追加
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="day-empty">
          <p>予定なし</p>
          <button className="btn btn-ghost" onClick={onAdd}>+ 追加する</button>
        </div>
      ) : (
        <div className="event-list">
          {sorted.map((ev) => (
            <EventItem
              key={ev.id}
              event={ev}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
