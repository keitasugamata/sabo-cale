import React, { useState } from 'react';
import { Plus, Check, ChevronRight, Play, Pause, Edit3 } from 'lucide-react';
import { formatDateJP, formatDuration, formatElapsed } from '../utils/dateUtils';
import { useNow } from '../hooks/useNow';

function getElapsedMs(tracking, now) {
  if (!tracking) return 0;
  let ms = tracking.accumulatedMs || 0;
  if (tracking.status === 'running' && tracking.currentRunStartedAt) {
    ms += now - tracking.currentRunStartedAt;
  }
  return ms;
}

function calcGapMinutes(prev, next) {
  const [ph, pm] = prev.startTime.split(':').map(Number);
  const prevEndMin = ph * 60 + pm + (prev.duration || 0);
  const [nh, nm] = next.startTime.split(':').map(Number);
  const nextStartMin = nh * 60 + nm;
  return nextStartMin - prevEndMin;
}

function calcGapStartTime(prev) {
  const [h, m] = prev.startTime.split(':').map(Number);
  const totalMin = h * 60 + m + (prev.duration || 0);
  const nh = Math.floor(totalMin / 60) % 24;
  const nm = totalMin % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function TimeEditPopup({ initialMinutes, onSave, onClose }) {
  const [minutes, setMinutes] = useState(initialMinutes);
  return (
    <div className="lp-popup-overlay" onClick={onClose}>
      <div className="lp-popup" onClick={(e) => e.stopPropagation()}>
        <div className="lp-popup-icon">⏱</div>
        <div className="lp-popup-msg">計測時間を編集（分）</div>
        <input
          type="number"
          className="sync-input"
          value={minutes}
          onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
          min={0}
          step={1}
          autoFocus
          style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
        />
        <div className="lp-popup-actions">
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={() => { onSave(minutes); onClose(); }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({ event, position, onToggle, onEdit, onStartTracking, onPauseTracking, onResumeTracking, onCompleteTracking, onEditTime }) {
  const tracking = event.tracking || null;
  const isRunning = tracking?.status === 'running';
  const isPaused = tracking?.status === 'paused';
  const hasTracking = !!tracking && (tracking.accumulatedMs > 0 || isRunning);

  const now = useNow(isRunning);
  const elapsedMs = getElapsedMs(tracking, now);
  const [editingTime, setEditingTime] = useState(false);

  function handleCheckClick(e) {
    e.stopPropagation();
    if (event.completed) onToggle(event.id);
    else if (hasTracking) onCompleteTracking(event.id);
    else onToggle(event.id);
  }

  function handleTrackToggle(e) {
    e.stopPropagation();
    if (isRunning) onPauseTracking(event.id);
    else if (isPaused) onResumeTracking(event.id);
    else onStartTracking(event.id);
  }

  const dotColor = event.color || '#7C3AED';

  return (
    <div className={`tl-row tl-event ${position}`}>
      <div className="tl-time">{event.startTime}</div>
      <div className="tl-line">
        <span className="tl-dot" style={{ background: dotColor, borderColor: dotColor }} />
      </div>
      <div className={`tl-content ${event.completed ? 'completed' : ''} ${isRunning ? 'tracking' : ''}`}>
        <div className="tl-card">
          <button
            className="event-check"
            onClick={handleCheckClick}
            aria-label={event.completed ? '未完了に戻す' : '完了'}
          >
            {event.completed ? <Check size={14} strokeWidth={3} /> : <span className="empty-check" />}
          </button>

          {!event.completed && (
            <button
              className={`track-btn ${isRunning ? 'running' : ''} ${isPaused ? 'paused' : ''}`}
              onClick={handleTrackToggle}
              aria-label={isRunning ? '一時停止' : '計測開始'}
            >
              {isRunning ? <Pause size={13} strokeWidth={2.5} /> : <Play size={13} strokeWidth={2.5} />}
            </button>
          )}

          <div className="event-info" onClick={() => onEdit(event)}>
            <p className="event-title">
              {event.completed ? '✅ ' : ''}{event.title}
            </p>
            <p className="event-meta">{formatDuration(event.duration)}</p>
            {hasTracking && !event.completed && (
              <p className="event-tracking">
                <span className={`track-time ${isRunning ? 'pulse' : ''}`}>
                  ⏱ {formatElapsed(elapsedMs)}
                </span>
                <button
                  className="icon-btn"
                  style={{ padding: 2, marginLeft: 4 }}
                  onClick={(e) => { e.stopPropagation(); setEditingTime(true); }}
                >
                  <Edit3 size={11} />
                </button>
                {isRunning && <span className="track-status">進行中</span>}
                {isPaused && <span className="track-status paused">一時停止</span>}
              </p>
            )}
            {event.preMemo && (
              <p className="event-memo-preview">
                {event.preMemo.slice(0, 40)}{event.preMemo.length > 40 ? '…' : ''}
              </p>
            )}
          </div>

          <button className="icon-btn" onClick={() => onEdit(event)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {editingTime && (
        <TimeEditPopup
          initialMinutes={Math.round(elapsedMs / 60000)}
          onClose={() => setEditingTime(false)}
          onSave={(min) => onEditTime(event.id, min)}
        />
      )}
    </div>
  );
}

function TimelineGap({ minutes, startTime, onClick }) {
  return (
    <div className="tl-row tl-gap">
      <div className="tl-time"></div>
      <div className="tl-line"></div>
      <div className="tl-content">
        <button className="tl-gap-btn" onClick={onClick} title="この時間に予定を追加">
          <Plus size={11} />
          <span>{startTime}〜 空き {formatDuration(minutes)}</span>
        </button>
      </div>
    </div>
  );
}

export default function DayDetail({
  date, events, onAdd, onAddAtTime, onToggle, onEdit,
  onStartTracking, onPauseTracking, onResumeTracking, onCompleteTracking, onEditTime,
}) {
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
        <div className="timeline">
          {sorted.map((ev, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === sorted.length - 1;
            const position = [
              isFirst ? 'is-first' : '',
              isLast ? 'is-last' : '',
            ].filter(Boolean).join(' ');

            const next = sorted[idx + 1];
            const gap = next ? calcGapMinutes(ev, next) : 0;

            return (
              <React.Fragment key={ev.id}>
                <TimelineEvent
                  event={ev}
                  position={position}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onStartTracking={onStartTracking}
                  onPauseTracking={onPauseTracking}
                  onResumeTracking={onResumeTracking}
                  onCompleteTracking={onCompleteTracking}
                  onEditTime={onEditTime}
                />
                {next && gap > 0 && (
                  <TimelineGap
                    minutes={gap}
                    startTime={calcGapStartTime(ev)}
                    onClick={() => onAddAtTime?.(calcGapStartTime(ev), gap)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
