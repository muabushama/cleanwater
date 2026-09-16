import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useGpsTracking(userId: string | undefined, enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!userId || !enabled) return;
    if (!navigator.geolocation) return;

    const sendLocation = (position: GeolocationPosition) => {
      supabase
        .from('rep_locations')
        .insert({
          user_id: userId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
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
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => console.error('Geolocation watch error:', err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
    intervalRef.current = setInterval(requestOnce, 60 * 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') requestOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, enabled]);
}
