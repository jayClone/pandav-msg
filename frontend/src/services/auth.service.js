import API from '../api/axios.js';

const authService = {
    /**
     * Register new user
     */
    register: async (userData) => {
        try {
            const response = await API.post('/auth/register', userData);
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Registration failed' };
        }
    },

    /**
     * Login user
     */
    login: async (credentials) => {
        try {
            const response = await API.post('/auth/login', credentials);
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Login failed' };
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
            throw error.response?.data || { message: 'Failed to fetch user' };
        }
    },

    /**
     * Logout user
     */
    logout: () => {
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