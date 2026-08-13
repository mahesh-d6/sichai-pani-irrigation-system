import axios from "axios";

// Dynamically determine the backend URL.
// In production on Render, VITE_API_URL is injected at build time from the
// backend service URL via render.yaml's `fromService` property.
// In development, fall back to localhost.
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim();
  }
  // Local development fallback
  return "http://127.0.0.1:8001";
};

export const API_BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout for slow Render cold starts
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sichai_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("sichai_token");
      localStorage.removeItem("sichai_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
