import { useState, useEffect, useCallback, useRef } from 'react';
import { checkPcHealth, checkAllHealth } from '../services/healthApi.js';

/**
 * useServiceHealth — Centralized per-service TCP health status manager.
 *
 * Maintains a flat map keyed by `"pcId---serviceIndex"` with values:
 *   'up'    — service port is reachable
 *   'down'  — service port is unreachable or errored
 *   null    — not yet checked
 *
 * Auto-charges `checkAll()` once on mount (StrictMode-safe).
 * Self-contained: accepts no props.
 *
 * Returns: { statuses, loading, checkSinglePc, checkAll }
 */
export default function useServiceHealth() {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------------------------- */
  /*  Monotonic counter — discards out-of-order / stale responses     */
  /* --------------------------------------------------------------- */
  const requestCounter = useRef(0);

  /* --------------------------------------------------------------- */
  /*  StrictMode guard — checkAll fires once per real page load       */
  /* --------------------------------------------------------------- */
  const mountedRef = useRef(false);

  /* --------------------------------------------------------------- */
  /*  Internal: parse backend array into flat { key: status } map     */
  /* --------------------------------------------------------------- */
  function flattenResults(data) {
    if (!Array.isArray(data)) return {};
    const next = {};
    for (const entry of data) {
      if (!entry.services) continue;
      for (const svc of entry.services) {
        const key = `${entry.pcId}---${svc.index}`;
        next[key] = svc.status ?? 'down';
      }
    }
    return next;
  }

  /* --------------------------------------------------------------- */
  /*  checkAll — hit backend for the entire fleet                     */
  /* --------------------------------------------------------------- */
  const checkAll = useCallback(async () => {
    const currentCounter = ++requestCounter.current;
    setLoading(true);

    const result = await checkAllHealth();
    if (currentCounter !== requestCounter.current) return; // stale

    if (result.error) {
      /* keep prev statuses, clear loading */
      setLoading(false);
      return;
    }
    setStatuses((prev) => ({ ...prev, ...flattenResults(result.data) }));
    setLoading(false);
  }, []);

  /* --------------------------------------------------------------- */
  /*  checkSinglePc — hit backend for one server                      */
  /* --------------------------------------------------------------- */
  const checkSinglePc = useCallback(async (pcId) => {
    if (!pcId) return;
    const currentCounter = ++requestCounter.current;
    setLoading(true);

    const result = await checkPcHealth(pcId);
    if (currentCounter !== requestCounter.current) return; // stale

    if (result.error) {
      /* keep prev statuses, clear loading */
      setLoading(false);
      return;
    }
    setStatuses((prev) => ({ ...prev, ...flattenResults([result.data]) }));
    setLoading(false);
  }, []);

  /* --------------------------------------------------------------- */
  /*  Auto-check on initial mount (StrictMode-safe)                   */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    checkAll();
  }, [checkAll]);

  return { statuses, loading, checkSinglePc, checkAll };
}
