import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LAST_BACKUP_KEY = 'oasis_admin_auto_backup_date';

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

async function downloadAdminBackup() {
  const { data, error } = await supabase.functions.invoke('manage-backup', {
    body: { action: 'export' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clean-water-auto-backup-${localDateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, localDateKey());
}

/**
 * While an admin session stays open on this device, download a JSON backup
 * automatically at local midnight (and once if the tab crosses into a new day).
 */
export function useAdminAutoBackup(enabled: boolean) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const runIfNeeded = async (force = false) => {
      if (cancelled || runningRef.current) return;
      const today = localDateKey();
      const last = localStorage.getItem(LAST_BACKUP_KEY);
      if (!force && last === today) return;
      runningRef.current = true;
      try {
        await downloadAdminBackup();
      } catch (err) {
        console.warn('[auto-backup] failed:', err);
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleMidnight = () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = setTimeout(async () => {
        await runIfNeeded(true);
        if (!cancelled) scheduleMidnight();
      }, msUntilNextLocalMidnight());
    };

    scheduleMidnight();
    // Catch midnight while the tab stays open even if the timeout drifts.
    pollTimer = setInterval(() => {
      void runIfNeeded(false);
    }, 60_000);

    return () => {
      cancelled = true;
      if (midnightTimer) clearTimeout(midnightTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [enabled]);
}
