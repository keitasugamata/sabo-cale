import { formatDateJP, formatDuration } from './dateUtils';

export function buildJournalText(events, dateStr) {
  if (!events.length) return '';

  const sorted = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const header = `# ${formatDateJP(dateStr)}\n\n`;

  const body = sorted.map((ev) => {
    const check = ev.completed ? '✅ ' : '';
    const dur = formatDuration(ev.duration);
    let block = `## ${check}${ev.title}  ${ev.startTime}〜（${dur}）\n`;

    if (ev.preMemo?.trim()) {
      block += `\n**事前メモ**\n${ev.preMemo.trim()}\n`;
    }
    if (ev.retrospectiveMemo?.trim()) {
      block += `\n**振り返り**\n${ev.retrospectiveMemo.trim()}\n`;
    }
    return block;
  });

  return header + body.join('\n---\n\n') + '\n';
}

export function buildMonthJournalText(events, year, month) {
  const monthName = `${year}年${month + 1}月`;
  const header = `# ${monthName} サボカレ記録\n\n`;

  // Group by date
  const byDate = {};
  events.forEach((ev) => {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });

  const dates = Object.keys(byDate).sort();
  if (!dates.length) return `${header}_予定なし_\n`;

  const body = dates.map((date) => buildJournalText(byDate[date], date)).join('\n');
  return header + body;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export function downloadMarkdown(text, filename) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
