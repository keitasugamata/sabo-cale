import { useState, useEffect } from 'react';

// active=trueの間、1秒ごとに再レンダー（タイマー表示用）
export function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
