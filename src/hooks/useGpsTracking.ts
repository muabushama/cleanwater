import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

function mysqlDateTime(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function useGpsTracking(userId: string | undefined, enabled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!userId || !enabled) return;
    if (!navigator.geolocation) return;

    const sendLocation = (position: GeolocationPosition) => {
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
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    };

    requestOnce();
    intervalRef.current = setInterval(requestOnce, 60 * 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') requestOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, enabled]);
}
