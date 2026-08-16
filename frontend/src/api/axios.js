import axios from "axios";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken
} from "@/utils/authStorage.js";

const API_VERSION = "v1";
const API_BASE_URL = `/api/${API_VERSION}`;

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise = null;

API.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const extractErrorMessage = (error) => {
  if (error.response) {
    return error.response.data?.message ||
      error.response.data?.error ||
      `Error ${error.response.status}: ${error.response.statusText}`;
  }

  if (error.request) {
    return "No response from server. Please check your internet connection.";
  }

  return error.message || "An unexpected error occurred.";
};

const redirectToLogin = () => {
  const isLoginPage = window.location.pathname === "/login";
  const isRegisterPage = window.location.pathname === "/register";

  if (!isLoginPage && !isRegisterPage) {
    window.location.href = "/login";
  }
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const normalizedError = {
      success: false,
      message: extractErrorMessage(error),
      status: error.response?.status,
      data: error.response?.data
    };

    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/logout");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        refreshPromise = refreshPromise || refreshClient.post("/auth/refresh")
          .finally(() => {
            refreshPromise = null;
          });

        const refreshResponse = await refreshPromise;
        const nextToken = refreshResponse.data?.token;

        if (!nextToken) {
          throw new Error("No token received from refresh");
        }

        setStoredToken(nextToken);
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${nextToken}`
        };

        return API(originalRequest);
      } catch (refreshError) {
        clearStoredToken();
        redirectToLogin();

        return Promise.reject({
          success: false,
          message: extractErrorMessage(refreshError),
          status: refreshError.response?.status || 401,
          data: refreshError.response?.data
        });
      }
    }

    if (error.response?.status === 401 && isAuthEndpoint) {
      clearStoredToken();
    }

    // A 401 from an auth endpoint (login/register/refresh/logout) is a
    // normal, expected outcome the caller already handles — e.g. a guest
    // visiting the site with no session cookie yet triggers a silent
    // "am I logged in?" refresh check that's *supposed* to fail. Logging
    // that as a red console.error on every guest page load is misleading
    // noise, not a real problem, so it's downgraded here.
    if (error.response?.status === 401 && isAuthEndpoint) {
      console.info(`[AUTH] ${normalizedError.status}`, normalizedError.message);
    } else if (error.response?.status === 500) {
      console.error("Server error:", normalizedError.message);
    } else {
      console.error(`[API-ERROR] ${normalizedError.status}`, normalizedError.message);
    }

    return Promise.reject(normalizedError);
  }
);

export default API;
export { API_BASE_URL, API_VERSION };
