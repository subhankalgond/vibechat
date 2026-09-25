import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * MySQL DATETIME strings arrive without a timezone marker. The API pool is
 * configured for UTC, so convert them to ISO strings for correct parsing.
 */
function normalizeDates(value) {
  if (typeof value === 'string') {
    return MYSQL_DATETIME_RE.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDates(item));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = normalizeDates(value[key]);
    }
    return result;
  }
  return value;
}

const TOKEN_KEY = 'vibechat_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object') {
      response.data = normalizeDates(response.data);
    }
    return response;
  },
  (error) => {
    const status = error.response && error.response.status;
    if (status === 401 && !String(error.config.url).includes('/auth/')) {
      setToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function apiError(error) {
  if (error.response) {
    const { data } = error.response;
    return {
      message: (data && data.message) || 'Something went wrong',
      errors: (data && data.errors) || null,
      status: error.response.status,
    };
  }
  if (error.request) {
    return { message: 'Cannot reach the server. Check your connection.', errors: null, status: 0 };
  }
  return { message: error.message || 'Unexpected error', errors: null, status: 0 };
}

export default api;
