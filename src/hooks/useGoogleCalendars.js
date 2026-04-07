import { useState, useEffect, useCallback } from 'react';
import {
  isConfigured, isInitialized, isSignedIn,
  initGoogleCalendar, listCalendars, pushEventToGoogle,
  fetchGoogleEvents, deleteGoogleEvent,
} from '../utils/googleCalendar';

export function useGoogleCalendars() {
  const [calendars, setCalendars] = useState([]);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isConfigured()) { setReady(true); return; }
    (async () => {
      try {
        if (!isInitialized()) await initGoogleCalendar();
        if (isSignedIn()) {
          setSignedIn(true);
          const cals = await listCalendars();
          setCalendars(cals);
        }
      } catch (e) { /* ignore */ }
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const cals = await listCalendars();
      setCalendars(cals);
      setSignedIn(true);
    } catch (e) { /* ignore */ }
  }, []);

  const push = useCallback(async (event, calId) => {
    return await pushEventToGoogle(event, calId);
  }, []);

  const remove = useCallback(async (eventId, calId) => {
    return await deleteGoogleEvent(eventId, calId);
  }, []);

  const fetchAll = useCallback(async (calId, year, month) => {
    return await fetchGoogleEvents(calId, year, month);
  }, []);

  return { calendars, ready, signedIn, refresh, push, remove, fetchAll };
}
