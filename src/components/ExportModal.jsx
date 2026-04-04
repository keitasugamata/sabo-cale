import React, { useState } from 'react';
import { X, Copy, Download, Check } from 'lucide-react';
import {
  buildJournalText,
  buildMonthJournalText,
  copyToClipboard,
  downloadMarkdown,
} from '../utils/exportUtils';
import { MONTHS_JP } from '../utils/dateUtils';

export default function ExportModal({ events, selectedDate, year, month, onClose }) {
  const [mode, setMode] = useState(selectedDate ? 'day' : 'month');
  const [copied, setCopied] = useState(false);

  const dayEvents = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : [];

  const monthEvents = events.filter((e) =>
    e.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
  );

  const text =
    mode === 'day'
      ? buildJournalText(dayEvents, selectedDate || '')
      : buildMonthJournalText(monthEvents, year, month);

  const filename =
    mode === 'day'
      ? `sabo-cale-${selectedDate}.md`
      : `sabo-cale-${year}-${String(month + 1).padStart(2, '0')}.md`;

  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet export-modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <h2>エクスポート</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="export-tabs">
          {selectedDate && (
            <button
              className={`export-tab ${mode === 'day' ? 'active' : ''}`}
              onClick={() => setMode('day')}
            >
              この日
            </button>
          )}
          <button
            className={`export-tab ${mode === 'month' ? 'active' : ''}`}
            onClick={() => setMode('month')}
          >
            {MONTHS_JP[month]}
          </button>
        </div>

        <div className="export-preview">
          <pre>{text || '予定がありません'}</pre>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => downloadMarkdown(text, filename)}>
            <Download size={16} /> .md保存
          </button>
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'コピー済み！' : 'コピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
