import API from '@api/axios.js';  // ✅ CHANGED: Use single axios

const authService = {
  /**
   * Register new user with OTP
   */
  register: async (userData) => {
    try {
      if (!userData.otp) {
        throw new Error('OTP is missing. Please verify your email first.');
      }

      const payload = {
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        otp: userData.otp.toString().trim()
      };

      const response = await API.post('/auth/register', payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }

      return response.data;
    } catch (error) {
      throw error; // Axios interceptor already standardized this
    }
  },

  login: async (credentials) => {
    try {
      const payload = {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        ...(credentials.otp && { otp: credentials.otp.toString() })
      };

      const response = await API.post('/auth/login', payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }

      return response.data;
    } catch (error) {
      localStorage.removeItem('token');
      throw error;
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
      throw error;
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