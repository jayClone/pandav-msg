import axios from "axios";

const API_VERSION = 'v1';  // ✅ FIXED: Correct spelling
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/${API_VERSION}`;

const API = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"  // ✅ FIXED: 'application' spelling
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

// Handle errors globally
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        
        // Log error for debugging
        console.error(`[${API_VERSION}] API Error:`, error.response?.status, error.response?.data);
        
        return Promise.reject(error);
    }
);

export default API;
export { API_BASE_URL, API_VERSION };  // ✅ FIXED: Correct export name