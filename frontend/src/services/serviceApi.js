import { get, post, put, del } from './apiClient';

export function fetchServices(pcId) {
  return get(`/pcs/${pcId}/services`);
}

export function createService(pcId, data) {
  return post(`/pcs/${pcId}/services`, data);
}

export function updateService(pcId, index, data) {
  return put(`/pcs/${pcId}/services/${index}`, data);
}

export function deleteService(pcId, index) {
  return del(`/pcs/${pcId}/services/${index}`);
}
