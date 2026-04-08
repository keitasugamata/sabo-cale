// クラウド（Supabase）データレイヤー
import { supabase } from './supabase';

// ─── 変換関数（camelCase ⇄ snake_case） ──────
function eventToRow(ev, userId) {
  return {
    id: ev.id,
    user_id: userId,
    title: ev.title,
    date: ev.date,
    start_time: ev.startTime,
    duration: ev.duration ?? 60,
    tags: ev.tags || {},
    pre_memo: ev.preMemo || '',
    retrospective_memo: ev.retrospectiveMemo || '',
    completed: ev.completed || false,
    color: ev.color || '#7C3AED',
    master_id: ev.masterId || null,
    recurrence_type: ev.recurrenceType || null,
    google_event_id: ev.googleEventId || null,
    google_calendar_id: ev.googleCalendarId || null,
    from_google: ev.fromGoogle || false,
    tracking: ev.tracking || null,
    created_at: ev.createdAt || Date.now(),
  };
}

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    duration: row.duration,
    tags: row.tags || {},
    preMemo: row.pre_memo || '',
    retrospectiveMemo: row.retrospective_memo || '',
    completed: row.completed || false,
    color: row.color,
    masterId: row.master_id || undefined,
    recurrenceType: row.recurrence_type || null,
    googleEventId: row.google_event_id || undefined,
    googleCalendarId: row.google_calendar_id || undefined,
    fromGoogle: row.from_google || false,
    tracking: row.tracking || null,
    createdAt: row.created_at,
  };
}

function tagToRow(tag, userId) {
  return {
    id: tag.id,
    user_id: userId,
    category: tag.category || '',
    label: tag.label,
    color: tag.color,
    usage_count: tag.usageCount ?? 0,
  };
}

function rowToTag(row) {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    color: row.color,
    usageCount: row.usage_count || 0,
  };
}

// ─── イベント ───────────────────────────────
export async function cloudGetAllEvents(userId) {
  const { data, error } = await supabase.from('events').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(rowToEvent);
}

export async function cloudSaveEvent(ev, userId) {
  const { error } = await supabase.from('events').upsert(eventToRow(ev, userId));
  if (error) throw error;
}

export async function cloudSaveEvents(events, userId) {
  if (!events.length) return;
  const { error } = await supabase.from('events').upsert(events.map((e) => eventToRow(e, userId)));
  if (error) throw error;
}

export async function cloudDeleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function cloudDeleteEvents(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from('events').delete().in('id', ids);
  if (error) throw error;
}

// ─── タグ ───────────────────────────────────
export async function cloudGetAllTags(userId) {
  const { data, error } = await supabase.from('tags').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(rowToTag);
}

export async function cloudSaveTag(tag, userId) {
  const { error } = await supabase.from('tags').upsert(tagToRow(tag, userId));
  if (error) throw error;
}

export async function cloudSaveTags(tags, userId) {
  if (!tags.length) return;
  const { error } = await supabase.from('tags').upsert(tags.map((t) => tagToRow(t, userId)));
  if (error) throw error;
}

export async function cloudDeleteTag(id) {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}
