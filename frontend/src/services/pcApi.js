import { get, post, put, del } from './apiClient';

export function fetchPcs() {
  return get('/pcs');
}

export function createPc(data) {
  return post('/pcs', data);
}

export function updatePc(id, data) {
  return put(`/pcs/${id}`, data);
}

export function deletePc(id) {
  return del(`/pcs/${id}`);
}
