import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

function mysqlDateTime(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function useGpsTracking(userId: string | undefined, enabled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!userId || !enabled) return;
    if (!navigator.geolocation) return;

    const sendLocation = (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < 15000) return;
      lastSentRef.current = now;
      supabase
        .from('rep_locations')
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          latitude: Number(position.coords.latitude) || 0,
          longitude: Number(position.coords.longitude) || 0,
          accuracy: Number(position.coords.accuracy) || 0,
          recorded_at: mysqlDateTime(),
        })
        .then(({ error }) => {
          if (error) console.error('GPS tracking error:', error);
        });
    };

    const requestOnce = () => {
      navigator.geolocation.getCurrentPosition(
        sendLocation,
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
      );
    };

    requestOnce();
    intervalRef.current = setInterval(requestOnce, 45 * 1000);

    try {
      watchRef.current = navigator.geolocation.watchPosition(
        sendLocation,
        (err) => console.error('Geolocation watch error:', err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
      );
    } catch {
      watchRef.current = null;
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') requestOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [userId, enabled]);
}
