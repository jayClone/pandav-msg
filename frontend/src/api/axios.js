import axios from "axios";

const API_VERSION = 'v1';
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/${API_VERSION}`;

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
        // ✅ FIX 1: Check if user is on login page
        const isLoginPage = window.location.pathname === "/login";
        const isRegisterPage = window.location.pathname === "/register";
        
        if (error.response?.status === 401) {
            // ✅ FIX 2: Don't redirect if on login/register pages
            if (!isLoginPage && !isRegisterPage) {
                console.warn("⚠️ Unauthorized - redirecting to login");
                localStorage.removeItem("token");
                window.location.href = "/login";
                return Promise.reject(error);
            }
            
            // ✅ FIX 3: On login page, just reject and let component handle it
            if (isLoginPage || isRegisterPage) {
                console.log("📝 Login/Register attempt - showing error to user");
                return Promise.reject(error);
            }
        }
        
        // ✅ FIX 4: Handle other errors
        if (error.response?.status === 403) {
            console.warn("⚠️ Forbidden - you don't have permission");
        }
        
        if (error.response?.status === 500) {
            console.error("❌ Server error:", error.response?.data?.message);
        }
        
        // Log error for debugging
        console.error(`[${API_VERSION}] API Error:`, error.response?.status, error.response?.data);
        
        return Promise.reject(error);
    }
);

export default API;
export { API_BASE_URL, API_VERSION };