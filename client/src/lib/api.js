import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let _apiInstance = null;
let _adminInstance = null;
let _deliveryInstance = null;

export function api(token) {
  if (!_apiInstance || _apiInstance.defaults.headers.Authorization !== `Bearer ${token}`) {
    _apiInstance = axios.create({ baseURL: API_URL });
    _apiInstance.interceptors.request.use(cfg => {
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return _apiInstance;
}

export function adminApi() {
  const token = localStorage.getItem('ud_admin_token');
  if (!_adminInstance || _adminInstance.defaults.headers.Authorization !== `Bearer ${token}`) {
    _adminInstance = axios.create({ baseURL: API_URL });
    _adminInstance.interceptors.request.use(cfg => {
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return _adminInstance;
}

export function deliveryApi(token) {
  if (!_deliveryInstance || _deliveryInstance.defaults.headers.Authorization !== `Bearer ${token}`) {
    _deliveryInstance = axios.create({ baseURL: API_URL });
    _deliveryInstance.interceptors.request.use(cfg => {
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return _deliveryInstance;
}
