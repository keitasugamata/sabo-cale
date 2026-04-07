import { useState, useEffect, useCallback } from 'react';
import { getAllEvents, saveEvent, deleteEvent as dbDeleteEvent } from '../db';
import {
  cloudGetAllEvents, cloudSaveEvent, cloudSaveEvents, cloudDeleteEvent, cloudDeleteEvents,
} from '../cloudDb';
import { isEventPast, generateId } from '../utils/dateUtils';

function generateRecurringInstances(master, type) {
  const instances = [];
  const start = new Date(master.date + 'T00:00:00');
  const end = new Date(start);
  end.setMonth(end.getMonth() + 6);

  let cur = new Date(start);
  let first = true;

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    instances.push({
      ...master,
      id: first ? master.id : generateId(),
      date: dateStr,
      masterId: master.id,
      recurrenceType: type,
    });
    first = false;

    if (type === 'daily') cur.setDate(cur.getDate() + 1);
    else if (type === 'weekly') cur.setDate(cur.getDate() + 7);
    else if (type === 'monthly') cur.setMonth(cur.getMonth() + 1);
    else if (type === 'weekday') {
      do { cur.setDate(cur.getDate() + 1); }
      while (cur.getDay() === 0 || cur.getDay() === 6);
    } else break;
  }
  return instances;
}

export function useEvents(user) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isCloud = !!user;

  // 読み込み（ユーザー切替時にリロード）
  useEffect(() => {
    setLoading(true);
    const loader = isCloud ? cloudGetAllEvents(user.id) : getAllEvents();
    loader.then((data) => {
      setEvents(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isCloud, user?.id]);

  // 自動完了チェック
  useEffect(() => {
    if (loading) return;
    const toComplete = events.filter((ev) => !ev.completed && !ev.fromGoogle && isEventPast(ev));
    if (!toComplete.length) return;
    const updated = toComplete.map((ev) => ({ ...ev, completed: true }));
    if (isCloud) cloudSaveEvents(updated, user.id).catch(() => {});
    else updated.forEach((ev) => saveEvent(ev));
    setEvents((prev) => prev.map((ev) => updated.find((u) => u.id === ev.id) ?? ev));
  }, [loading]);

  const persistEvent = useCallback(async (ev) => {
    if (isCloud) await cloudSaveEvent(ev, user.id);
    else await saveEvent(ev);
  }, [isCloud, user?.id]);

  const persistMany = useCallback(async (evs) => {
    if (isCloud) await cloudSaveEvents(evs, user.id);
    else await Promise.all(evs.map(saveEvent));
  }, [isCloud, user?.id]);

  const removeOne = useCallback(async (id) => {
    if (isCloud) await cloudDeleteEvent(id);
    else await dbDeleteEvent(id);
  }, [isCloud]);

  const removeMany = useCallback(async (ids) => {
    if (isCloud) await cloudDeleteEvents(ids);
    else await Promise.all(ids.map(dbDeleteEvent));
  }, [isCloud]);

  const addEvent = useCallback(async (eventData, recurrenceType = null) => {
    if (!recurrenceType) {
      await persistEvent(eventData);
      setEvents((prev) => [...prev, eventData]);
      return eventData;
    }
    const instances = generateRecurringInstances(eventData, recurrenceType);
    await persistMany(instances);
    setEvents((prev) => [...prev, ...instances]);
    return instances[0];
  }, [persistEvent, persistMany]);

  const updateEvent = useCallback(async (id, patch) => {
    setEvents((prev) => {
      const updated = prev.map((ev) => ev.id === id ? { ...ev, ...patch } : ev);
      const target = updated.find((ev) => ev.id === id);
      if (target) persistEvent(target);
      return updated;
    });
  }, [persistEvent]);

  const updateAllRecurring = useCallback(async (masterId, patch) => {
    setEvents((prev) => {
      const updated = prev.map((ev) =>
        ev.masterId === masterId || ev.id === masterId
          ? { ...ev, ...patch, date: ev.date, id: ev.id }
          : ev
      );
      const targets = updated.filter((ev) => ev.masterId === masterId || ev.id === masterId);
      persistMany(targets);
      return updated;
    });
  }, [persistMany]);

  const removeEvent = useCallback(async (id) => {
    await removeOne(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  }, [removeOne]);

  const removeAllRecurring = useCallback(async (masterId) => {
    setEvents((prev) => {
      const toDelete = prev.filter((ev) => ev.masterId === masterId || ev.id === masterId);
      removeMany(toDelete.map((e) => e.id));
      return prev.filter((ev) => ev.masterId !== masterId && ev.id !== masterId);
    });
  }, [removeMany]);

  const toggleComplete = useCallback(async (id) => {
    setEvents((prev) => {
      const updated = prev.map((ev) => ev.id === id ? { ...ev, completed: !ev.completed } : ev);
      const target = updated.find((ev) => ev.id === id);
      if (target) persistEvent(target);
      return updated;
    });
  }, [persistEvent]);

  const getEventsForDate = useCallback(
    (dateStr) => events.filter((ev) => ev.date === dateStr),
    [events]
  );

  const getEventsForMonth = useCallback(
    (year, month) => {
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      return events.filter((ev) => ev.date.startsWith(prefix));
    },
    [events]
  );

  const importEvents = useCallback(async (newEvents) => {
    await persistMany(newEvents);
    setEvents((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      return [...prev, ...newEvents.filter((e) => !ids.has(e.id))];
    });
  }, [persistMany]);

  // 全イベント削除
  const removeAllEvents = useCallback(async () => {
    setEvents((prev) => {
      removeMany(prev.map((e) => e.id));
      return [];
    });
  }, [removeMany]);

  return {
    events, loading,
    addEvent, updateEvent, updateAllRecurring,
    removeEvent, removeAllRecurring, removeAllEvents,
    toggleComplete,
    getEventsForDate, getEventsForMonth, importEvents,
  };
}
