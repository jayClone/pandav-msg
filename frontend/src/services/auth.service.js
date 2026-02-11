import API from '@api/axios.js';

const authService = {
    /**
     * Register new user
     */
    register: async (userData) => {
        try {
            const response = await API.post('/auth/register', userData);
            
            // ✅ FIX: Only store token if request succeeded
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            
            return response.data;
        } catch (error) {
            // ✅ FIX: Don't store anything on error
            console.error("❌ Registration error:", error.response?.data);
            throw error.response?.data || { message: 'Registration failed' };
        }
    },

    /**
     * Login user
     */
    login: async (credentials) => {
        try {
            console.log("🔐 Attempting login...");
            
            const response = await API.post('/auth/login', credentials);
            
            // ✅ FIX: Only store token if request succeeded
            if (response.data.token) {
                console.log("✅ Token received, storing...");
                localStorage.setItem('token', response.data.token);
            }
            
            return response.data;
        } catch (error) {
            // ✅ FIX: Clear any partial token on error
            localStorage.removeItem('token');
            
            console.error("❌ Login error:", error.response?.data?.message || error.message);
            
            // ✅ FIX: Throw error so component can display it
            throw error.response?.data || { 
                message: 'Login failed',
                status: error.response?.status 
            };
        }
    },

    /**
     * Get current user
     */
    getCurrentUser: async () => {
        try {
            const response = await API.get('/auth/current');
            return response.data;
        } catch (error) {
            console.error("❌ Get user error:", error.response?.data);
            throw error.response?.data || { message: 'Failed to fetch user' };
        }
    },

    /**
     * Logout user
     */
    logout: () => {
        console.log("🚪 Logging out...");
        localStorage.removeItem('token');
        return Promise.resolve();
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    /**
     * Get stored token
     */
    getToken: () => {
        return localStorage.getItem('token');
    }
};

export default authService;