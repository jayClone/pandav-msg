import API from '@api/axios.js';

const otpAPI = {
  /**
   * Send OTP to email
   */
  sendOTP: async (email, name, purpose = 'registration') => {
    try {
      console.log('📧 [OTP-API] Sending OTP request...');
      
      const response = await API.post('/otp/send-otp', {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        purpose
      });

      console.log('✅ [OTP-API] Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [OTP-API] Error:', error.response?.data || error.message);
      throw error.response?.data || { 
        success: false,
        message: error.message || 'Failed to send OTP' 
      };
    }
  },

  /**
   * Verify OTP
   */
  verifyOTP: async (email, otp, purpose = 'registration') => {
    try {
      console.log('🔍 [OTP-API] Verifying OTP...');
      
      const response = await API.post('/otp/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.toString(),
        purpose
      });

      console.log('✅ [OTP-API] Verified:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [OTP-API] Verify error:', error.response?.data || error.message);
      throw error.response?.data || { 
        success: false,
        message: error.message || 'Failed to verify OTP' 
      };
    }
  },

  /**
   * Resend OTP
   */
  resendOTP: async (email, name, purpose = 'registration') => {
    try {
      console.log('🔄 [OTP-API] Resending OTP...');
      
      const response = await API.post('/otp/resend-otp', {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        purpose
      });

      console.log('✅ [OTP-API] Resent:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [OTP-API] Resend error:', error.response?.data || error.message);
      throw error.response?.data || { 
        success: false,
        message: error.message || 'Failed to resend OTP' 
      };
    }
  }
};

export default otpAPI;