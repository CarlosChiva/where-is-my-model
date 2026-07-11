import { post } from './apiClient';

export function checkPcHealth(pcId) {
  return post(`/check-health/pcs/${pcId}`);
}

export function checkAllHealth() {
  return post('/check-health/all');
}
