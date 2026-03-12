import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useGpsTracking(userId: string | undefined, isRep: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!userId || !isRep) return;

    const sendLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await supabase.from('rep_locations').insert({
              user_id: userId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          } catch (e) {
            console.error('GPS tracking error:', e);
          }
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    // Send immediately then every 5 minutes
    sendLocation();
    intervalRef.current = setInterval(sendLocation, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, isRep]);
}
