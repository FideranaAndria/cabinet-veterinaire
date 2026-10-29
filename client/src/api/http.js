import axios from 'axios';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1',
  timeout: 10000,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('cabinet.accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
