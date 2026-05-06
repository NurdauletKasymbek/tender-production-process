import axios, { AxiosError, AxiosInstance } from 'axios';

const TOKEN_KEY = 'tender_app_token';

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ message?: string | string[] }>) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
    }
    const data = error.response?.data;
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    if (msg) (error as Error).message = msg;
    return Promise.reject(error);
  },
);
