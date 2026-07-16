import { get, post } from './apiClient';

export function register(username, password) {
  return post('/auth/register', { username, password });
}

export function login(username, password) {
  return post('/auth/login', { username, password });
}

export function getMe() {
  return get('/auth/me');
}

export function logout() {
  return post('/auth/logout');
}

export function refreshToken() {
  return post('/auth/refresh', {});
}
