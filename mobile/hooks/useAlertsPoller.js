import { useEffect } from 'react';
import api from '../services/api_1';
import { useAlertsStore } from '../store/alertsStore';

const ACTIVE_STATUSES = ['ASSIGNED', 'STARTED', 'EN_ROUTE', 'ARRIVED'];

// Lightweight poll of the driver's active trips so the Alerts tab badge stays live even
// when the driver is on another screen. One shared instance (mounted in the driver
// layout); ~25s cadence keeps it cheap.
export function useAlertsPoller() {
  const setActiveIds = useAlertsStore((s) => s.setActiveIds);

  useEffect(() => {
    let alive = true;

    const fetchActive = async () => {
      try {
        const res = await api.get('/trips');
        const raw = res.data;
        const all = Array.isArray(raw) ? raw
          : Array.isArray(raw?.content) ? raw.content
          : Array.isArray(raw?.data) ? raw.data
          : [];
        const ids = all.filter((t) => ACTIVE_STATUSES.includes(t.status)).map((t) => t.id);
        if (alive) setActiveIds(ids);
      } catch { /* ignore — try again next tick */ }
    };

    fetchActive();
    const id = setInterval(fetchActive, 25000);
    return () => { alive = false; clearInterval(id); };
  }, [setActiveIds]);
}

export default useAlertsPoller;
