import { post } from './apiClient';

export function checkPcHealth(pcId) {
  return post(`/check-health/pcs/${pcId}`);
}

export function checkAllHealth() {
  return post('/check-health/all');
}

/**
 * Checks health of a single DNS entry.
 * @param {string} dnsId - DNS identifier (e.g. 'global').
 * @param {string} entryId - DNS entry identifier.
 * @returns {Promise<{data, error}>}
 */
export function checkDnsEntryHealth(dnsId, entryId) {
  return post(`/check-health/dns/${dnsId}/${entryId}`);
}

/**
 * Checks health of all DNS entries for a given DNS.
 * @param {string} dnsId - DNS identifier (e.g. 'global').
 * @returns {Promise<{data, error}>}
 */
export function checkAllDnsHealth(dnsId) {
  return post(`/check-health/dns/${dnsId}`);
}
