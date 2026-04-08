import { useState, useEffect, useCallback } from 'react';
import {
  isConfigured, isInitialized, isSignedIn,
  initGoogleCalendar, requestToken, listCalendars, pushEventToGoogle,
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
        // 保存トークンが有効ならそのまま使う
        if (isSignedIn()) {
          setSignedIn(true);
          const cals = await listCalendars();
          setCalendars(cals);
        } else {
          // 期限切れ → サイレント再認証を試行
          try {
            await requestToken(true);
            setSignedIn(true);
            const cals = await listCalendars();
            setCalendars(cals);
          } catch (silentErr) {
            // サイレント失敗 → ユーザーが手動でログインする必要あり
          }
        }
      } catch (e) { /* ignore */ }
      setReady(true);
    })();
  }, []);

  // 手動ログイン（ポップアップ表示）
  const signIn = useCallback(async () => {
    if (!isInitialized()) await initGoogleCalendar();
    await requestToken(false);
    setSignedIn(true);
    const cals = await listCalendars();
    setCalendars(cals);
    return cals;
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

  return { calendars, ready, signedIn, refresh, signIn, push, remove, fetchAll };
}
