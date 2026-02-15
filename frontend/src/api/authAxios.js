import axios from "axios";

// ✅ SEPARATE INSTANCE - NO INTERCEPTORS
const AUTH_API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  timeout: 30000
});

// ✅ MINIMAL REQUEST INTERCEPTOR - ONLY ADD TOKEN IF EXISTS
AUTH_API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ✅ DEBUG: Log the actual request data
    console.log('📤 [AUTH-AXIOS] Request to:', config.url);
    console.log('📤 [AUTH-AXIOS] Data being sent:', JSON.stringify(config.data));
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ RESPONSE INTERCEPTOR
AUTH_API.interceptors.response.use(
  (response) => {
    console.log('📥 [AUTH-AXIOS] Response received:', response.status);
    return response;
  },
  (error) => {
    console.error('❌ [AUTH-AXIOS] Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default AUTH_API;