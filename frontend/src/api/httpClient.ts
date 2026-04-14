import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../utils/constants';

const httpClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Флаг, предотвращающий параллельные refresh-запросы
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

/**
 * Shared refresh function used by both the interceptor and authStore.initialize().
 * Deduped: concurrent callers share the same in-flight promise.
 */
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');
    const { data } = await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
    );
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
    return data.access_token as string;
  })();

  try {
    const token = await refreshPromise;
    processQueue(null, token);
    return token;
  } catch (err) {
    processQueue(err, null);
    throw err;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Request interceptor — добавляет токен
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — auto-refresh при 401
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const skipUrls = ['/auth/login', '/auth/register', '/auth/refresh'];

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !skipUrls.some((url) => originalRequest.url?.includes(url))
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(httpClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return httpClient(originalRequest);
      } catch (refreshError) {
        // Если другой параллельный refresh уже успешно обновил токены,
        // не разлогиниваем — просто повторяем запрос с новым токеном.
        const currentToken = useAuthStore.getState().accessToken;
        const headerToken = originalRequest.headers.Authorization?.toString().replace('Bearer ', '');
        if (currentToken && currentToken !== headerToken) {
          originalRequest.headers.Authorization = `Bearer ${currentToken}`;
          return httpClient(originalRequest);
        }
        useAuthStore.getState().logout();
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
