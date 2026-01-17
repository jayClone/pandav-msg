import API, { API_VERSION } from '../api/axios.js';

/**
 * API Service Wrapper
 * Provides centralized API calls with version info
 */
const apiService = {
    /**
     * Get current API version
     */
    getVersion: () => API_VERSION,

    /**
     * Get base URL
     */
    getBaseUrl: () => API.defaults.baseURL,

    /**
     * Auth endpoints
     */
    auth: {
        register: (userData) => 
            API.post('/auth/register', userData),
        
        login: (credentials) => 
            API.post('/auth/login', credentials),
        
        getCurrentUser: () => 
            API.get('/auth/current'),
        
        logout: () => {
            localStorage.removeItem('token');
            return Promise.resolve();
        }
    },

    /**
     * Health check
     */
    health: {
        check: () => 
            API.get('/health')
    }
};

export default apiService;
