import React, { useState, useRef } from 'react';
import { Plus, Trash2, X, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { formatDateJP } from '../utils/dateUtils';

// プリセット20色 + カスタム
const PALETTE = [
  '#7C3AED', '#9333EA', '#A855F7', '#6366F1',
  '#2563EB', '#0891B2', '#0D9488', '#059669',
  '#16A34A', '#65A30D', '#D97706', '#F59E0B',
  '#EA580C', '#DC2626', '#E11D48', '#DB2777',
  '#EC4899', '#8B5CF6', '#64748B', '#1E293B',
];

// ─── カラーピッカー ───────────────────────────────────
function ColorPicker({ current, onChange }) {
  const inputRef = useRef();
  return (
    <div className="cpicker-wrap">
      <div className="cpicker-grid">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={`cpicker-swatch ${current?.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
        {/* カスタムカラー */}
        <label
          className="cpicker-custom"
          style={{ background: current && !PALETTE.includes(current?.toUpperCase()) ? current : 'transparent' }}
          title="カスタムカラー"
        >
          <input
            ref={inputRef}
            type="color"
            value={current || '#7C3AED'}
            onChange={(e) => onChange(e.target.value)}
            style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
          />
          <span style={{ pointerEvents: 'none', fontSize: '1rem', lineHeight: 1 }}>🎨</span>
        </label>
      </div>
    </div>
  );
}

// ─── タグ使用履歴ビュー ───────────────────────────────
function TagHistoryView({ tag, events, onBack }) {
  const related = events
    .filter(
      (ev) =>
        ev.tags?.what === tag.label ||
        ev.tags?.with === tag.label ||
        ev.tags?.where === tag.label
    )
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
    });

  // 日付でグルーピング
  const grouped = {};
  related.forEach((ev) => {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  });
  const dates = Object.keys(grouped).sort();

  return (
    <div className="tag-history">
      <div className="page-header">
        <button className="icon-btn" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <div className="th-title-row">
          <span className="th-color-dot" style={{ background: tag.color }} />
          <h2>{tag.label}</h2>
          <span className="th-count">{related.length}件</span>
        </div>
      </div>

      {dates.length === 0 ? (
        <div className="th-empty">
          <p>このタグが使われた予定はありません</p>
        </div>
      ) : (
        <div className="th-list">
          {dates.map((date) => (
            <div key={date} className="th-date-group">
              <div className="th-date-header">{formatDateJP(date)}</div>
              {grouped[date].map((ev) => (
                <div key={ev.id} className="th-event-row">
                  <div className="th-color-bar" style={{ background: ev.color || tag.color }} />
                  <div className="th-event-body">
                    <div className="th-event-title">
                      {ev.completed ? '✅ ' : ''}{ev.title}
                    </div>
                    {(ev.preMemo || ev.retrospectiveMemo) && (
                      <div className="th-event-memo">
                        {ev.preMemo && <span>📝 {ev.preMemo.slice(0, 30)}{ev.preMemo.length > 30 ? '…' : ''}</span>}
                        {ev.retrospectiveMemo && <span>💬 {ev.retrospectiveMemo.slice(0, 30)}{ev.retrospectiveMemo.length > 30 ? '…' : ''}</span>}
                      </div>
                    )}
                  </div>
                  <div className="th-event-time">
                    <Clock size={11} />
                    {ev.startTime}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── タグ行 ──────────────────────────────────────────
function TagRow({ tag, onDelete, onColorChange, onHistory }) {
  const [colorOpen, setColorOpen] = useState(false);

  function handleColorChange(c) {
    onColorChange(tag.id, c);
    // カラーピッカーは開いたまま（好みの色を調整できるよう）
  }

  return (
    <div className="tag-row-wrapper">
      <div className="tag-row-item">
        {/* カラードット → クリックで色変更 */}
        <button
          className={`tag-color-btn ${colorOpen ? 'open' : ''}`}
          style={{ background: tag.color }}
          onClick={(e) => { e.stopPropagation(); setColorOpen((v) => !v); }}
          title="色を変更"
        />

        {/* ラベル → クリックで履歴 */}
        <button className="tag-row-main" onClick={() => onHistory(tag)}>
          <span className="tag-row-label">{tag.label}</span>
          <span className="tag-usage">×{tag.usageCount || 0}</span>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>

        {/* 削除 */}
        <button
          className="icon-btn icon-btn-danger"
          onClick={() => onDelete(tag.id)}
          aria-label="削除"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* インラインカラーピッカー */}
      {colorOpen && (
        <div className="tag-cpicker-panel">
          <ColorPicker current={tag.color} onChange={handleColorChange} />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setColorOpen(false)}>
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

// ─── タグ追加フォーム ─────────────────────────────────
function AddTagForm({ category, onAdd, onCancel }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd({ category, label: label.trim(), color });
    setLabel('');
  }

  return (
    <form className="add-tag-form" onSubmit={handleSubmit}>
      <ColorPicker current={color} onChange={setColor} />
      <div className="add-tag-input-row">
        <input
          className="tag-input"
          placeholder="タグ名を入力"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!label.trim()}>
          追加
        </button>
        <button type="button" className="icon-btn" onClick={onCancel}>
          <X size={16} />
        </button>
      </div>
    </form>
  );
}

// ─── TagSection ───────────────────────────────────────
function TagSection({ emoji, label, category, tags, events, addingCategory, setAddingCategory, onAdd, onDelete, onColorChange, onHistory }) {
  return (
    <section className="tag-section">
      <div className="tag-section-header">
        <h3>{emoji} {label}</h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setAddingCategory(addingCategory === category ? null : category)}
        >
          <Plus size={14} /> 追加
        </button>
      </div>
      {addingCategory === category && (
        <AddTagForm category={category} onAdd={onAdd} onCancel={() => setAddingCategory(null)} />
      )}
      <div className="tag-list">
        {tags.length === 0 ? (
          <p className="empty-hint">タグがありません</p>
        ) : (
          tags.map((t) => (
            <TagRow
              key={t.id}
              tag={t}
              onDelete={onDelete}
              onColorChange={onColorChange}
              onHistory={onHistory}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ─── メイン TagManager ────────────────────────────────
export default function TagManager({
  withTags, whatTags, whereTags = [],
  events = [],
  onAdd, onDelete, onColorChange, onBack,
}) {
  const [addingCategory, setAddingCategory] = useState(null);
  const [historyTag, setHistoryTag] = useState(null);

  function handleAdd(data) {
    onAdd(data);
    setAddingCategory(null);
  }

  // 履歴ビュー
  if (historyTag) {
    return (
      <TagHistoryView
        tag={historyTag}
        events={events}
        onBack={() => setHistoryTag(null)}
      />
    );
  }

  return (
    <div className="tag-manager">
      <div className="page-header">
        <button className="icon-btn" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h2>タグ管理</h2>
      </div>

      <TagSection emoji="👥" label="誰と" category="with"
        tags={withTags} events={events}
        addingCategory={addingCategory} setAddingCategory={setAddingCategory}
        onAdd={handleAdd} onDelete={onDelete} onColorChange={onColorChange} onHistory={setHistoryTag}
      />
      <TagSection emoji="⚡" label="何をする" category="what"
        tags={whatTags} events={events}
        addingCategory={addingCategory} setAddingCategory={setAddingCategory}
        onAdd={handleAdd} onDelete={onDelete} onColorChange={onColorChange} onHistory={setHistoryTag}
      />
      <TagSection emoji="📍" label="どこで" category="where"
        tags={whereTags} events={events}
        addingCategory={addingCategory} setAddingCategory={setAddingCategory}
        onAdd={handleAdd} onDelete={onDelete} onColorChange={onColorChange} onHistory={setHistoryTag}
      />
    </div>
  );
}
