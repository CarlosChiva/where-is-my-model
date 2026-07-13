import { useState, useCallback } from 'react';
import { checkPcHealth } from '../services/healthApi.js';

/**
 * useServiceHealth — Centralized per-service TCP health status manager.
 *
 * Maintains a flat map keyed by `"pcId---serviceIndex"` with values:
 *   'up'    — service port is reachable
 *   'down'  — service port is unreachable or errored
 *   null    — not yet checked
 *
 * Auto-check is coordinated from App.jsx using a one-time ref guard.
 * The hook itself does NOT fire an auto-check on mount.
 * Self-contained: accepts no props.
 *
 * Returns: { statuses, isPcLoading, anyPcLoading, checkSinglePc, checkAll }
 */
export default function useServiceHealth() {
  const [statuses, setStatuses] = useState({});
  const [loadingPcs, setLoadingPcs] = useState(new Set());

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
  /*  checkSinglePc — hit backend for one server                      */
  /* --------------------------------------------------------------- */
  const checkSinglePc = useCallback(async (pcId) => {
    if (!pcId) return;
    setLoadingPcs(prev => new Set(prev).add(pcId));

    const result = await checkPcHealth(pcId);
    if (result.error) {
      setLoadingPcs(prev => { const n = new Set(prev); n.delete(pcId); return n; });
      return;
    }
    setStatuses(prev => ({ ...prev, ...flattenResults([result.data]) }));
    setLoadingPcs(prev => { const n = new Set(prev); n.delete(pcId); return n; });
  }, []);

  /* --------------------------------------------------------------- */
  /*  checkAll — iterates pcIds individually                          */
  /* --------------------------------------------------------------- */
  const checkAll = useCallback(async (pcIds) => {
    if (!Array.isArray(pcIds) || pcIds.length === 0) return;
    // Fire all concurrently
    const promises = pcIds.map(id => checkSinglePc(id));
    return Promise.allSettled(promises);
  }, [checkSinglePc]);

  /* --------------------------------------------------------------- */
  /*  Helper: is a specific PC currently loading?                     */
  /* --------------------------------------------------------------- */
  const isPcLoading = useCallback((pcId) => loadingPcs.has(pcId), [loadingPcs]);

  /* --------------------------------------------------------------- */
  /*  Helper: is ANY PC currently loading?                            */
  /* --------------------------------------------------------------- */
  const anyPcLoading = useCallback(() => loadingPcs.size > 0, [loadingPcs]);

  /* AUTO-CHECK REMOVED: App.jsx handles initial health check instead. */

  return {
    statuses,
    isPcLoading,
    anyPcLoading,
    checkSinglePc,
    checkAll
  };
}