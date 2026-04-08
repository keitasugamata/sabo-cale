export const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
export const MONTHS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function toDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

export function isToday(year, month, day) {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

export function isPastDate(year, month, day) {
  const d = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function isEventPast(event) {
  const [h, m] = event.startTime.split(':').map(Number);
  const { year, month, day } = parseDateString(event.date);
  const eventEnd = new Date(year, month, day, h, m + event.duration);
  return eventEnd < new Date();
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// 経過時間ミリ秒を HH:MM:SS or MM:SS 表記に
export function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDateJP(dateStr) {
  const { year, month, day } = parseDateString(dateStr);
  const dow = new Date(year, month, day).getDay();
  return `${year}年${month + 1}月${day}日（${DAYS_JP[dow]}）`;
}

export function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
