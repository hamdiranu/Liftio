import { useEffect, useState } from 'react';

import { GUEST_USER_ID, useAuth } from '@/features/auth/store';
import { ensureTemplates, seedSampleData } from '@/features/workouts/sample-data';
import { ensureCrossOriginIsolation } from '@/lib/cross-origin-isolation';
import { queryClient } from '@/lib/query';
import { getDb } from '@/services/db';
import { startSyncTriggers } from '@/services/sync';
import { useActiveWorkout } from '@/store/active-workout';
import { useSettings } from '@/store/settings';

/**
 * Opens the database, restores auth and persisted stores, seeds demo data for guests and
 * starts background sync. Returns true once the app can render real content.
 */
export function useBootstrap() {
  const [ready, setReady] = useState(false);
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.userId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ensureCrossOriginIsolation()) {
        // Web: a service worker is being installed and the page will reload. Give it a moment.
        await new Promise((r) => setTimeout(r, 4000));
      }
      try {
        await getDb();
        await Promise.all([
          useSettings.persist.rehydrate(),
          useActiveWorkout.persist.rehydrate(),
          useAuth.getState().init(),
        ]);
      } catch (error) {
        console.warn('[bootstrap] failed to initialise', error);
        // Fall through so the user still reaches the sign-in screen.
        if (useAuth.getState().status === 'loading') useAuth.setState({ status: 'signedOut' });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-user setup once signed in (or in guest mode).
  useEffect(() => {
    if (!ready || !userId) return;
    let stop: (() => void) | undefined;
    (async () => {
      try {
        if (userId === GUEST_USER_ID) {
          const seeded = await seedSampleData(userId);
          if (seeded) await queryClient.invalidateQueries();
        }
        await ensureTemplates(userId);
      } catch (error) {
        console.warn('[bootstrap] seeding failed', error);
      }
      stop = startSyncTriggers(() => useAuth.getState().userId);
    })();
    return () => stop?.();
  }, [ready, userId, status]);

  return ready && status !== 'loading';
}
