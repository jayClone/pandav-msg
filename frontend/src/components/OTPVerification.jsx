import React, { useState, useEffect } from 'react';
import API from '@api/axios';

export default function OTPForm({ email, name, onSuccess }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(0);

  // ✅ SEND OTP - Called ONCE when user clicks button
  

  // ✅ VERIFY OTP - Called ONCE when user clicks verify button
  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError('Please enter OTP');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Verifying OTP:', otp);
      
      const response = await API.post('/otp/verify', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        purpose: 'registration'
      });

      console.log('✅ OTP verified:', response.data);
      
      // Call parent callback
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('❌ OTP verification failed:', error.response?.data?.message || error.message);
      setError(error.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // ✅ RESEND OTP
  const handleResendOTP = async () => {
    if (timer > 0) {
      setError(`Wait ${timer} seconds before resending`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await API.post('/otp/resend', {
        email: email.trim().toLowerCase(),
        name,
        purpose: 'registration'
      });

      setTimer(60);
      alert('✅ New OTP sent');
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ✅ TIMER COUNTDOWN
  useEffect(() => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  return (
    <div className="otp-container">
      <h2>Verify Your Email</h2>
      <p>Enter the 6-digit OTP sent to {email}</p>

      {error && <div className="error">{error}</div>}

      {/* OTP Input */}
      <input
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        maxLength="6"
        disabled={loading}
      />

      {/* Verify Button */}
      <button
        onClick={handleVerifyOTP}
        disabled={loading || otp.length !== 6}
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>

      {/* Resend Button */}
      <button
        onClick={handleResendOTP}
        disabled={loading || timer > 0}
      >
        {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
      </button>
    </div>
  );
}