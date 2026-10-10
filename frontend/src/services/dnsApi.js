import { get, post, put, del } from './apiClient';

/** Fetch all DNS zone records. */
export function fetchDns() {
  return get('/dns');
}

/** Create a new DNS entry. */
export function createDnsEntry(data) {
  return post('/dns/entries', data);
}

/** Update an existing DNS entry. */
export function updateDnsEntry(entryId, data) {
  return put(`/dns/entries/${entryId}`, data);
}

/** Delete a DNS entry by its ID. */
export function deleteDnsEntry(entryId) {
  return del(`/dns/entries/${entryId}`);
}
