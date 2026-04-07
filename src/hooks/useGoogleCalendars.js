import { useState, useEffect, useCallback } from 'react';
import {
  isConfigured, isInitialized, isSignedIn,
  initGoogleCalendar, listCalendars, pushEventToGoogle,
} from '../utils/googleCalendar';

export function useGoogleCalendars() {
  const [calendars, setCalendars] = useState([]);
  const [ready, setReady] = useState(false);

  // 起動時、ログイン済みなら自動でカレンダー一覧取得
  useEffect(() => {
    if (!isConfigured()) { setReady(true); return; }
    (async () => {
      try {
        if (!isInitialized()) await initGoogleCalendar();
        if (isSignedIn()) {
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
    } catch (e) { /* ignore */ }
  }, []);

  const push = useCallback(async (event, calId) => {
    return await pushEventToGoogle(event, calId);
  }, []);

  return { calendars, ready, refresh, push };
}
