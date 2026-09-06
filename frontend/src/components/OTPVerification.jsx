import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import otpAPI from '@api/otp.api.js';

export default function OTPVerification({
  email,
  name,
  purpose = 'registration',
  onSuccess,
  onBack
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef([]);

  // ✅ Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ✅ Countdown timer for resend
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // ✅ Handle OTP input
  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otp];
    newOTP[index] = value.slice(0, 1);
    setOtp(newOTP);

    // Auto-move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit the instant all 6 digits are present — reads newOTP (not
    // the otp state, which hasn't re-rendered with this keystroke yet) so
    // this fires exactly once, on the keystroke that actually completes it.
    if (newOTP.every((digit) => digit !== '')) {
      handleVerifyOTP(newOTP.join(''));
    }
  };

  // Selects the existing digit on focus so typing a replacement digit
  // overwrites it via the browser's normal selected-text behavior — without
  // this, maxLength=1 blocks a second keystroke into an already-filled box
  // outright, making it look like the box silently ignored the keypress.
  const handleFocus = (e) => {
    e.target.select();
  };

  // ✅ Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ✅ Verify OTP
  const handleVerifyOTP = async (codeOverride) => {
    const otpCode = codeOverride ?? otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {

      const response = await otpAPI.verifyOTP(email, otpCode, purpose);

      if (response.success) {
        setSuccess(true);

        // ✅ CALL SUCCESS IMMEDIATELY with OTP code
        onSuccess(otpCode);
      } else {
        setError(response.message || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ✅ Resend OTP
  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);  // ✅ RESET SUCCESS STATE

    try {
      const response = await otpAPI.resendOTP(email, name, purpose);

      if (response.success) {
        setResendCountdown(60);
        setOtp(['', '', '', '', '', '']);  // ✅ CLEAR OTP INPUTS
        inputRefs.current[0]?.focus();
        setError('');
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Paste OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);

    if (digits.length > 0) {
      const newOTP = [...otp];
      for (let i = 0; i < digits.length; i++) {
        newOTP[i] = digits[i];
      }
      setOtp(newOTP);

      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();

      if (digits.length === 6) {
        handleVerifyOTP(newOTP.join(''));
      }
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Email</h2>
        <p className="text-gray-600 text-sm">
          We sent a 6-digit code to <br />
          <strong className="text-gray-900">{email}</strong>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div role="status" className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">OTP verified successfully! Processing...</p>
        </div>
      )}

      {/* OTP Input */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Enter Verification Code
        </label>
        <div className="flex gap-2 sm:gap-3 justify-center" role="group" aria-label="6-digit verification code">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              value={digit}
              onChange={(e) => handleOTPChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={handleFocus}
              maxLength="1"
              disabled={loading || success}
              aria-label={`Digit ${index + 1} of 6`}
              className="w-12 h-12 sm:w-14 sm:h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          You can paste the code directly
        </p>
      </div>

      {/* Verify Button */}
      <button
        onClick={() => handleVerifyOTP()}
        disabled={loading || success || otp.join('').length !== 6}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 mb-4"
      >
        {loading ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : success ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Verified!
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            Verify OTP
          </>
        )}
      </button>

      {/* Resend & Back Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Back
        </button>

        <button
          onClick={handleResendOTP}
          disabled={resendCountdown > 0 || loading}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {resendCountdown > 0 ? `Resend (${resendCountdown}s)` : 'Resend Code'}
        </button>
      </div>

      {/* Help Text */}
      <p className="text-center text-gray-600 text-xs mt-6">
        Code expires in 10 minutes
      </p>
    </div>
  );
}