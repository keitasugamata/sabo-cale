import React, { useState, useRef, useEffect } from 'react';
import { X, Clock, Users, Zap, MapPin, ChevronDown, Plus, Search, RotateCcw, Calendar } from 'lucide-react';
import { generateId, formatDuration, formatDateJP } from '../utils/dateUtils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DURATION_PRESETS = [30, 60, 90, 120, 180];
const PALETTE = [
  '#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777',
  '#EA580C', '#DC2626', '#0891B2', '#16A34A', '#9333EA',
];
const RECURRENCE_OPTIONS = [
  { value: null,      label: 'なし' },
  { value: 'daily',   label: '毎日' },
  { value: 'weekday', label: '平日のみ' },
  { value: 'weekly',  label: '毎週' },
  { value: 'monthly', label: '毎月' },
];

// ─── インラインタグセレクター ─────────────────
function InlineTagSelector({ icon, label, value, tags, onChange, onCreateTag }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef();
  const containerRef = useRef();

  const filtered = query ? tags.filter((t) => t.label.includes(query)) : tags;
  const canCreate = query.trim().length > 0 && !tags.find((t) => t.label === query.trim());

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  function select(tag) { onChange(tag); setQuery(''); setOpen(false); }

  function handleCreate() {
    const lbl = query.trim();
    if (!lbl) return;
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const newTag = { id: generateId(), category: '', label: lbl, color, usageCount: 0 };
    onCreateTag(newTag);
    onChange(newTag);
    setQuery(''); setOpen(false);
  }

  return (
    <section className="modal-section">
      <label className="section-label">{icon} {label}</label>
      {value && !open ? (
        <div className="selected-tag-row">
          <button
            className="tag-pill selected"
            style={{ background: value.color, borderColor: value.color, color: '#fff' }}
            onClick={() => { onChange(null); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          >
            {value.label} <X size={11} style={{ marginLeft: 3 }} />
          </button>
          <button className="tag-change-btn" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}>変更</button>
        </div>
      ) : (
        <div className="tag-combobox" ref={containerRef}>
          <div className="tag-search-box" onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              ref={inputRef}
              className="tag-search-input"
              placeholder="検索 or 新規入力..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
            />
            {query && <button className="icon-btn" style={{ padding: 2 }} onClick={() => setQuery('')}><X size={12} /></button>}
          </div>
          {open && (
            <div className="tag-dropdown">
              {filtered.length > 0 && (
                <div className="tag-dropdown-group">
                  {!query && <span className="tag-dropdown-hint">よく使う順</span>}
                  <div className="tag-dropdown-pills">
                    {filtered.slice(0, 8).map((t) => (
                      <button key={t.id} className="tag-pill" style={{ borderColor: t.color, color: t.color }} onClick={() => select(t)}>
                        {t.label}
                        {t.usageCount > 0 && <span className="tag-usage-badge">{t.usageCount}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {canCreate && (
                <button className="tag-create-btn" onClick={handleCreate}>
                  <Plus size={13} />「{query.trim()}」を新しいタグとして追加
                </button>
              )}
              {filtered.length === 0 && !canCreate && <p className="tag-dropdown-empty">タグが見つかりません</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── メインモーダル ────────────────────────────
export default function EventModal({
  date, event, presets, withTags, whatTags, whereTags,
  googleCalendars = [], defaultPushCalId = '',
  onSave, onDelete, onDeleteAll, onCreateTag, onConnectGoogle, onClose,
}) {
  const isEdit = !!event;
  const isRecurring = !!(event?.masterId || event?.recurrenceType);
  const now = new Date();

  const presetH = presets?.startTime ? +presets.startTime.split(':')[0] : null;
  const presetM = presets?.startTime ? +presets.startTime.split(':')[1] : null;

  const [hour, setHour] = useState(
    event ? +event.startTime.split(':')[0] : (presetH ?? now.getHours())
  );
  const [minute, setMinute] = useState(
    event ? +event.startTime.split(':')[1] : (presetM ?? Math.floor(now.getMinutes() / 15) * 15)
  );
  const [duration, setDuration] = useState(event?.duration ?? presets?.duration ?? 60);
  const [withTag, setWithTag] = useState(event?.tags?.with ? withTags.find((t) => t.label === event.tags.with) ?? null : null);
  const [whatTag, setWhatTag] = useState(event?.tags?.what ? whatTags.find((t) => t.label === event.tags.what) ?? null : null);
  const [whereTag, setWhereTag] = useState(event?.tags?.where ? whereTags.find((t) => t.label === event.tags.where) ?? null : null);
  const [preMemo, setPreMemo] = useState(event?.preMemo || '');
  const [retroMemo, setRetroMemo] = useState(event?.retrospectiveMemo || '');
  const [showMemo, setShowMemo] = useState(!!(event?.preMemo || event?.retrospectiveMemo));
  const [recurrence, setRecurrence] = useState(event?.recurrenceType ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Google カレンダー送信先（'' = 送信しない）
  const writableCals = googleCalendars.filter(
    (c) => c.accessRole === 'owner' || c.accessRole === 'writer'
  );
  const [googleCalId, setGoogleCalId] = useState(
    event?.googleCalendarId ?? (isEdit ? '' : defaultPushCalId)
  );

  // インラインで追加されたタグをローカルにマージ
  const [localTags, setLocalTags] = useState({ with: withTags, what: whatTags, where: whereTags });
  useEffect(() => { setLocalTags({ with: withTags, what: whatTags, where: whereTags }); }, [withTags, whatTags, whereTags]);

  function handleCreateTag(tag, category) {
    onCreateTag({ ...tag, category });
    setLocalTags((prev) => ({ ...prev, [category]: [...prev[category], { ...tag, category }] }));
  }

  const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  // タイトル生成：先頭に時刻
  const whatPart = whatTag?.label || '';
  const withPart = withTag ? `（${withTag.label}）` : '';
  const wherePart = whereTag ? ` @${whereTag.label}` : '';
  const title = [startTime, whatPart + withPart + wherePart].filter((s) => s !== '').join(' ') || `${startTime} 予定`;

  function handleSave(editScope = 'single') {
    const ev = {
      id: event?.id || generateId(),
      googleCalendarId: googleCalId || undefined,
      googleEventId: event?.googleEventId,
      title,
      date,
      startTime,
      duration,
      tags: { with: withTag?.label || '', what: whatTag?.label || '', where: whereTag?.label || '' },
      preMemo,
      retrospectiveMemo: retroMemo,
      completed: event?.completed || false,
      color: whatTag?.color || withTag?.color || whereTag?.color || '#7C3AED',
      masterId: event?.masterId || (recurrence ? (event?.id || generateId()) : undefined),
      recurrenceType: recurrence,
      createdAt: event?.createdAt || Date.now(),
    };
    onSave(ev, withTag, whatTag, whereTag, recurrence, editScope);
    onClose();
  }

  const overlayRef = useRef();

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-header">
          <div>
            <p className="modal-date">{formatDateJP(date)}</p>
            <h2 className="modal-title">{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* 何時 */}
          <section className="modal-section">
            <label className="section-label"><Clock size={14} /> 何時</label>
            <div className="time-row">
              <select className="time-select" value={hour} onChange={(e) => setHour(+e.target.value)}>
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2,'0')}時</option>)}
              </select>
              <select className="time-select" value={minute} onChange={(e) => setMinute(+e.target.value)}>
                {[0,15,30,45].map((m) => <option key={m} value={m}>{String(m).padStart(2,'0')}分</option>)}
              </select>
              <span className="duration-label">{formatDuration(duration)}</span>
            </div>
            <div className="slider-row">
              <span className="slider-hint">30分</span>
              <input type="range" min={15} max={480} step={15} value={duration} onChange={(e) => setDuration(+e.target.value)} className="duration-slider" />
              <span className="slider-hint">8時間</span>
            </div>
            <div className="duration-presets">
              {DURATION_PRESETS.map((d) => (
                <button key={d} className={`preset-btn ${duration === d ? 'active' : ''}`} onClick={() => setDuration(d)}>{formatDuration(d)}</button>
              ))}
            </div>
          </section>

          {/* 誰と */}
          <InlineTagSelector icon={<Users size={14} />} label="誰と" value={withTag} tags={localTags.with} onChange={setWithTag} onCreateTag={(t) => handleCreateTag(t, 'with')} />

          {/* 何をする */}
          <InlineTagSelector icon={<Zap size={14} />} label="何をする" value={whatTag} tags={localTags.what} onChange={setWhatTag} onCreateTag={(t) => handleCreateTag(t, 'what')} />

          {/* どこで */}
          <InlineTagSelector icon={<MapPin size={14} />} label="どこで" value={whereTag} tags={localTags.where} onChange={setWhereTag} onCreateTag={(t) => handleCreateTag(t, 'where')} />

          {/* 繰り返し */}
          <section className="modal-section">
            <label className="section-label"><RotateCcw size={14} /> 繰り返し</label>
            <div className="recurrence-row">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  className={`preset-btn ${recurrence === opt.value ? 'active' : ''}`}
                  onClick={() => setRecurrence(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Google カレンダー送信先 */}
          <section className="modal-section">
            <label className="section-label"><Calendar size={14} /> Googleカレンダーに送信</label>
            {writableCals.length > 0 ? (
              <select
                className="sync-input"
                value={googleCalId}
                onChange={(e) => setGoogleCalId(e.target.value)}
              >
                <option value="">送信しない（ローカルのみ）</option>
                {writableCals.map((c) => (
                  <option key={c.id} value={c.id}>{c.summary}</option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={async (e) => {
                  e.preventDefault();
                  try { await onConnectGoogle?.(); }
                  catch (err) { console.warn('Google login failed', err); }
                }}
              >
                <Calendar size={14} /> Googleカレンダーと連携する
              </button>
            )}
          </section>

          {/* メモ */}
          <section className="modal-section">
            <button className="memo-toggle" onClick={() => setShowMemo((v) => !v)}>
              <span>メモ</span>
              <ChevronDown size={16} style={{ transform: showMemo ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showMemo && (
              <div className="memo-fields">
                <div className="memo-field">
                  <label className="memo-label">事前メモ</label>
                  <textarea className="memo-textarea" placeholder="やること・準備・目的など" value={preMemo} onChange={(e) => setPreMemo(e.target.value)} rows={3} />
                </div>
                <div className="memo-field">
                  <label className="memo-label">振り返りメモ</label>
                  <textarea className="memo-textarea" placeholder="どうだったか、気づきなど" value={retroMemo} onChange={(e) => setRetroMemo(e.target.value)} rows={3} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* フッター */}
        <div className="modal-footer">
          {isEdit && (
            confirmDelete ? (
              <div className="delete-confirm">
                {isRecurring ? (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={() => { onDelete(event.id); onClose(); }}>この予定</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { onDeleteAll(event.masterId || event.id); onClose(); }}>すべて</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>戻る</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>本当に？</span>
                    <button className="btn btn-danger btn-sm" onClick={() => { onDelete(event.id); onClose(); }}>削除</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>戻る</button>
                  </>
                )}
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}>削除</button>
            )
          )}

          {isEdit && isRecurring ? (
            <div className="recurring-save-row">
              <button className="btn btn-ghost btn-sm" onClick={() => handleSave('single')}>この予定だけ</button>
              <button className="btn btn-primary" onClick={() => handleSave('all')}>すべて更新</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => handleSave()} disabled={!whatTag && !withTag && !whereTag}>
              {isEdit ? '更新' : '追加'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
