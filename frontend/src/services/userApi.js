import { get, put } from './apiClient';

export function fetchUsers() {
  return get('/users');
}

export function updateUserRole(userId, role) {
  return put(`/users/${userId}/role`, { role });
}
