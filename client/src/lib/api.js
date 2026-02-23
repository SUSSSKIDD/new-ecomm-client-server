import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Create an authenticated axios instance.
 * Centralises API_URL + auth header injection.
 * Usage: api(token).get('/orders') or api(token).post('/orders', body)
 */
export function api(token) {
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Same for admin token stored in localStorage.
 */
export function adminApi() {
  const token = localStorage.getItem('ud_admin_token');
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * For delivery token.
 */
export function deliveryApi(token) {
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
