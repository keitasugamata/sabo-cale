import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress, onClick, { ms = 500, moveTolerance = 8 } = {}) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const movedRef = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = useCallback((e) => {
    longPressedRef.current = false;
    movedRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPos.current = { x: point.clientX, y: point.clientY };
    cancelTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      onLongPress();
    }, ms);
  }, [onLongPress, ms]);

  const handleMove = useCallback((e) => {
    const point = e.touches ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - startPos.current.x);
    const dy = Math.abs(point.clientY - startPos.current.y);
    if (dx > moveTolerance || dy > moveTolerance) {
      movedRef.current = true;
      cancelTimer();
    }
  }, [moveTolerance]);

  const handleEnd = useCallback(() => {
    cancelTimer();
    if (!longPressedRef.current && !movedRef.current) onClick();
  }, [onClick]);

  return {
    onTouchStart: handleStart,
    onTouchMove: handleMove,
    onTouchEnd: handleEnd,
    onTouchCancel: cancelTimer,
    onMouseDown: handleStart,
    onMouseMove: handleMove,
    onMouseUp: handleEnd,
    onMouseLeave: cancelTimer,
    onContextMenu: (e) => e.preventDefault(),
  };
}
