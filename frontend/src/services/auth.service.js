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

      console.log('📤 [AUTH-SERVICE] Registering:', payload.email);

      const response = await API.post('/auth/register', payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('✅ Registration successful');
      }

      return response.data;
    } catch (error) {
      console.error('❌ Registration error:', error.response?.data);
      throw error.response?.data || { 
        success: false,
        message: error.message || 'Registration failed' 
      };
    }
  },

  /**
   * Login user
   */
  login: async (credentials) => {
    try {
      const payload = {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        ...(credentials.otp && { otp: credentials.otp.toString() })
      };

      console.log('🔐 [AUTH-SERVICE] Login attempt for:', payload.email);

      const response = await API.post('/auth/login', payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        console.log('✅ Login successful');
      }

      return response.data;
    } catch (error) {
      localStorage.removeItem('token');
      console.error('❌ Login error:', error.response?.data);
      throw error.response?.data || { 
        success: false,
        message: 'Login failed' 
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
      console.error('❌ Get user error:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch user' };
    }
  },

  /**
   * Logout user
   */
  logout: () => {
    console.log('🚪 Logging out...');
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