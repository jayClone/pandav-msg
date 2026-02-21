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

// ✅ FIXED: Handle errors WITHOUT auto-redirect on login page
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginPage = window.location.pathname === "/login";
        const isRegisterPage = window.location.pathname === "/register";

        if (error.response?.status === 401) {
            if (!isLoginPage && !isRegisterPage) {
                console.warn("⚠️ Unauthorized - redirecting to login");
                localStorage.removeItem("token");
                window.location.href = "/login";
                return Promise.reject(error);
            }

            if (isLoginPage || isRegisterPage) {
                return Promise.reject(error);
            }
        }

        if (error.response?.status === 403) {
            console.warn("⚠️ Forbidden");
        }

        if (error.response?.status === 500) {
            console.error("❌ Server error:", error.response?.data?.message);
        }

        console.error(`[API-ERROR]`, error.response?.status, error.response?.data);

        return Promise.reject(error);
    }
);

export default API;
export { API_BASE_URL, API_VERSION };