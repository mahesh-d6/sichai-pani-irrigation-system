import axios from "axios";

// Dynamically determine the backend URL
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  // If explicitly configured with a remote production API URL, use it
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  // If running in production (e.g. deployed on Render static site)
  if (import.meta.env.PROD) {
    return "https://sichai-pani-irrigation-system.onrender.com";
  }
  // Local development fallback
  return envUrl || "http://127.0.0.1:8001";
};

export const API_BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
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
