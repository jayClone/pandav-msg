import API from '@api/axios.js';

const otpAPI = {
  /**
   * Send OTP to email
   */
  sendOTP: async (email, name, purpose = 'registration') => {
    try {
      const response = await API.post('/otp/send-otp', {
        email,
        name,
        purpose
      });
      return response.data;
    } catch (error) {
      console.error('❌ Send OTP error:', error.response?.data);
      throw error.response?.data || { message: 'Failed to send OTP' };
    }
  },

  /**
   * Verify OTP
   */
  verifyOTP: async (email, otp, purpose = 'registration') => {
    try {
      const response = await API.post('/otp/verify-otp', {
        email,
        otp,
        purpose
      });
      return response.data;
    } catch (error) {
      console.error('❌ Verify OTP error:', error.response?.data);
      throw error.response?.data || { message: 'Failed to verify OTP' };
    }
  },

  /**
   * Resend OTP
   */
  resendOTP: async (email, name, purpose = 'registration') => {
    try {
      const response = await API.post('/otp/resend-otp', {
        email,
        name,
        purpose
      });
      return response.data;
    } catch (error) {
      console.error('❌ Resend OTP error:', error.response?.data);
      throw error.response?.data || { message: 'Failed to resend OTP' };
    }
  }
};

export default otpAPI;