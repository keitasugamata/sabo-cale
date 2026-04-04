import { useState, useEffect, useCallback } from 'react';
import { getAllEvents, saveEvent, deleteEvent as dbDeleteEvent } from '../db';
import { isEventPast, generateId } from '../utils/dateUtils';

function generateRecurringInstances(master, type) {
  const instances = [];
  const start = new Date(master.date + 'T00:00:00');
  const end = new Date(start);
  end.setMonth(end.getMonth() + 6); // 6ヶ月分生成

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

    if (type === 'daily') {
      cur.setDate(cur.getDate() + 1);
    } else if (type === 'weekly') {
      cur.setDate(cur.getDate() + 7);
    } else if (type === 'monthly') {
      cur.setMonth(cur.getMonth() + 1);
    } else if (type === 'weekday') {
      do { cur.setDate(cur.getDate() + 1); }
      while (cur.getDay() === 0 || cur.getDay() === 6);
    } else {
      break;
    }
  }

  return instances;
}

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllEvents().then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, []);

  // 自動完了チェック
  useEffect(() => {
    if (loading) return;
    const toComplete = events.filter((ev) => !ev.completed && !ev.fromGoogle && isEventPast(ev));
    if (!toComplete.length) return;
    Promise.all(
      toComplete.map((ev) => {
        const updated = { ...ev, completed: true };
        return saveEvent(updated).then(() => updated);
      })
    ).then((updated) => {
      setEvents((prev) => prev.map((ev) => updated.find((u) => u.id === ev.id) ?? ev));
    });
  }, [loading]);

  const addEvent = useCallback(async (eventData, recurrenceType = null) => {
    if (!recurrenceType) {
      await saveEvent(eventData);
      setEvents((prev) => [...prev, eventData]);
      return eventData;
    }
    const instances = generateRecurringInstances(eventData, recurrenceType);
    await Promise.all(instances.map(saveEvent));
    setEvents((prev) => [...prev, ...instances]);
    return instances[0];
  }, []);

  const updateEvent = useCallback(async (id, patch) => {
    setEvents((prev) => {
      const updated = prev.map((ev) => ev.id === id ? { ...ev, ...patch } : ev);
      const target = updated.find((ev) => ev.id === id);
      if (target) saveEvent(target);
      return updated;
    });
  }, []);

  // 繰り返しのすべてのインスタンスを更新（内容をpatchで上書き、日付は保持）
  const updateAllRecurring = useCallback(async (masterId, patch) => {
    setEvents((prev) => {
      const updated = prev.map((ev) =>
        ev.masterId === masterId || ev.id === masterId
          ? { ...ev, ...patch, date: ev.date, id: ev.id }
          : ev
      );
      updated
        .filter((ev) => ev.masterId === masterId || ev.id === masterId)
        .forEach(saveEvent);
      return updated;
    });
  }, []);

  const removeEvent = useCallback(async (id) => {
    await dbDeleteEvent(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  }, []);

  const removeAllRecurring = useCallback(async (masterId) => {
    setEvents((prev) => {
      const toDelete = prev.filter((ev) => ev.masterId === masterId || ev.id === masterId);
      toDelete.forEach((ev) => dbDeleteEvent(ev.id));
      return prev.filter((ev) => ev.masterId !== masterId && ev.id !== masterId);
    });
  }, []);

  const toggleComplete = useCallback(async (id) => {
    setEvents((prev) => {
      const updated = prev.map((ev) => ev.id === id ? { ...ev, completed: !ev.completed } : ev);
      const target = updated.find((ev) => ev.id === id);
      if (target) saveEvent(target);
      return updated;
    });
  }, []);

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
    const saved = await Promise.all(newEvents.map((ev) => saveEvent(ev).then(() => ev)));
    setEvents((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      return [...prev, ...saved.filter((e) => !ids.has(e.id))];
    });
  }, []);

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    updateAllRecurring,
    removeEvent,
    removeAllRecurring,
    toggleComplete,
    getEventsForDate,
    getEventsForMonth,
    importEvents,
  };
}
