import { useState, useCallback } from 'react';
import { checkDnsEntryHealth, checkAllDnsHealth } from '../services/healthApi.js';

/**
 * useDnsHealth — Per-entry DNS health status manager.
 *
 * Maintains a flat map keyed by `entryId` with values:
 *   { status: 'up' | 'down' | null, reason?: string, latencyMs?: number, loading: boolean }
 *
 * - `status: null`  → not yet checked (renders a grey blinking dot in the UI)
 * - `status: 'up'`  → entry is reachable
 * - `status: 'down'`→ entry is unreachable or errored
 *
 * The backend does NOT persist health state; all checks are on-demand
 * (no polling). A single `dnsId` is injected into every API call.
 *
 * @param {string} [dnsId='global'] — DNS identifier passed to health endpoints.
 * @returns {{ statusOf, detailOf, checkEntry, checkAll, anyLoading }}
 */
export default function useDnsHealth(dnsId = 'global') {
  const [map, setMap] = useState({});

  /* --------------------------------------------------------------- */
  /*  checkEntry — check a single DNS entry                           */
  /* --------------------------------------------------------------- */
  const checkEntry = useCallback(async (entryId) => {
    if (!entryId) return;

    // Mark loading
    setMap(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        status: prev[entryId]?.status ?? null,
        reason: prev[entryId]?.reason,
        latencyMs: prev[entryId]?.latencyMs,
        loading: true,
      },
    }));

    const result = await checkDnsEntryHealth(dnsId, entryId);

    if (result.error) {
      // On error: keep previous status (or null), clear loading
      setMap(prev => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          status: prev[entryId]?.status ?? null,
          loading: false,
        },
      }));
      return;
    }

    // Success: map the response
    setMap(prev => ({
      ...prev,
      [entryId]: {
        status: result.data.status,
        reason: result.data.reason,
        latencyMs: result.data.latencyMs,
        loading: false,
      },
    }));
  }, [dnsId]);

  /* --------------------------------------------------------------- */
  /*  checkAll — check all entries for this dnsId                      */
  /* --------------------------------------------------------------- */
  const checkAll = useCallback(async (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    // Mark all entries loading in a single functional update
    setMap(prev => {
      const next = { ...prev };
      for (const entry of entries) {
        const id = entry.entryId;
        next[id] = {
          ...next[id],
          status: next[id]?.status ?? null,
          reason: next[id]?.reason,
          latencyMs: next[id]?.latencyMs,
          loading: true,
        };
      }
      return next;
    });

    const result = await checkAllDnsHealth(dnsId);

    if (result.error) {
      // On error: leave map intact, just clear loading flags
      setMap(prev => {
        const next = { ...prev };
        for (const entry of entries) {
          if (next[entry.entryId]) {
            next[entry.entryId] = { ...next[entry.entryId], loading: false };
          }
        }
        return next;
      });
      return;
    }

    // Success: map result.data.entries into the map, clear loading
    const dataEntries = result.data?.entries ?? [];
    setMap(prev => {
      const next = { ...prev };
      for (const entry of dataEntries) {
        next[entry.entryId] = {
          status: entry.status,
          reason: entry.reason,
          latencyMs: entry.latencyMs,
          loading: false,
        };
      }
      // Clear loading for any entries not present in the response
      for (const entry of entries) {
        if (next[entry.entryId] && next[entry.entryId].loading) {
          next[entry.entryId] = { ...next[entry.entryId], loading: false };
        }
      }
      return next;
    });
  }, [dnsId]);

  /* --------------------------------------------------------------- */
  /*  statusOf — get status for a single entry                        */
  /* --------------------------------------------------------------- */
  const statusOf = useCallback((entryId) => {
    return map[entryId]?.status ?? null;
  }, [map]);

  /* --------------------------------------------------------------- */
  /*  detailOf — get { reason, latencyMs } for a single entry         */
  /* --------------------------------------------------------------- */
  const detailOf = useCallback((entryId) => {
    const entry = map[entryId];
    if (!entry) return null;
    return { reason: entry.reason, latencyMs: entry.latencyMs };
  }, [map]);

  /* --------------------------------------------------------------- */
  /*  anyLoading — is any entry currently loading?                    */
  /* --------------------------------------------------------------- */
  const anyLoading = useCallback(() => {
    return Object.values(map).some(e => e && e.loading);
  }, [map]);

  return { statusOf, detailOf, checkEntry, checkAll, anyLoading };
}
