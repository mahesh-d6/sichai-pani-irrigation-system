import axios from "axios";

// Dynamically determine the backend URL.
// In production on Render, VITE_API_URL is injected at build time via render.yaml.
// A known production fallback is provided in case injection fails.
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // Use injected or explicitly set env var
  if (envUrl && envUrl.trim() !== "" && !envUrl.includes("127.0.0.1") && !envUrl.includes("localhost")) {
    return envUrl.trim();
  }
  // Production fallback — the Render backend service URL
  if (import.meta.env.PROD) {
    return "https://sichai-pani-backend.onrender.com";
  }
  // Local development
  return "http://127.0.0.1:8001";
};

export const API_BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s timeout for slow Render free tier cold starts
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
