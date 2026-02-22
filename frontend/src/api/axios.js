import axios from "axios";

const API_VERSION = 'v1';

// ✅ USE RELATIVE PATH - Vercel rewrites /api/* to Railway
const API_BASE_URL = `/api/${API_VERSION}`;

const API = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// Add token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * ✅ Standardized Error Extractor
 * Pulls the most useful error message from the backend response
 */
const extractErrorMessage = (error) => {
    if (error.response) {
        // Server responded with a status code other than 2xx
        return error.response.data?.message ||
            error.response.data?.error ||
            `Error ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
        // Request was made but no response received
        return "No response from server. Please check your internet connection.";
    } else {
        // Something happened in setting up the request
        return error.message || "An unexpected error occurred.";
    }
};

// ✅ FIXED: Handle errors WITHOUT auto-redirect on login page
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginPage = window.location.pathname === "/login";
        const isRegisterPage = window.location.pathname === "/register";

        const normalizedError = {
            success: false,
            message: extractErrorMessage(error),
            status: error.response?.status,
            data: error.response?.data
        };

        if (error.response?.status === 401) {
            if (!isLoginPage && !isRegisterPage) {
                console.warn("⚠️ Unauthorized - redirecting to login");
                localStorage.removeItem("token");
                window.location.href = "/login";
                return Promise.reject(normalizedError);
            }
        }

        if (error.response?.status === 500) {
            console.error("❌ Server error:", normalizedError.message);
        } else {
            console.error(`[API-ERROR] ${normalizedError.status}`, normalizedError.message);
        }

        return Promise.reject(normalizedError);
    }
);

export default API;
export { API_BASE_URL, API_VERSION };