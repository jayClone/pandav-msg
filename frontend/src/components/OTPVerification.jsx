import { useState, useRef, useEffect } from 'react';
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
  const [, setOtpSent] = useState(false); // ✅ Track if OTP already sent
  const inputRefs = useRef([]);
  const otpSentRef = useRef(false); // ✅ Prevent race conditions

  // ✅ SEND OTP ONLY ONCE - On component mount
  useEffect(() => {
    // ✅ CRITICAL: Only send if NOT already sent
    if (otpSentRef.current) return;
    
    const sendOTPOnMount = async () => {
      setLoading(true);
      setError('');

      try {
        console.log('📧 [OTP-MOUNT] Auto-sending OTP to:', email);
        
        const response = await otpAPI.sendOTP(email, name, purpose);

        if (response.success) {
          console.log('✅ [OTP-MOUNT] OTP sent successfully');
          setOtpSent(true);
          otpSentRef.current = true; // ✅ MARK AS SENT
          setResendCountdown(60); // 60 second wait
        } else {
          setError(response.message || 'Failed to send OTP');
        }
      } catch (err) {
        console.error('❌ [OTP-MOUNT] Error:', err);
        setError(err.message || 'Failed to send OTP');
      } finally {
        setLoading(false);
      }
    };

    sendOTPOnMount();
  }, []); // ✅ EMPTY dependency array = runs ONLY ONCE on mount

  // ✅ Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ✅ Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setInterval(() => {
      setResendCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  // ✅ Handle OTP input - only allow numbers
  const handleOTPChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last digit if pasted
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ✅ Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);

      // Auto-focus previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }

    // Allow arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ✅ Verify OTP - CALLED BY USER CLICKING BUTTON
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔍 [OTP-VERIFY] Verifying OTP:', otpCode);
      
      const response = await otpAPI.verifyOTP(email, otpCode, purpose);

      if (response.success) {
        console.log('✅ [OTP-VERIFY] OTP verified successfully');
        setSuccess(true);
        
        // ✅ Pass OTP code to parent
        if (onSuccess) {
          onSuccess(otpCode);
        }
      } else {
        setError(response.message || 'Invalid OTP');
      }
    } catch (err) {
      console.error('❌ [OTP-VERIFY] Error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Resend OTP - CALLED BY USER CLICKING BUTTON
  const handleResendOTP = async () => {
    if (resendCountdown > 0) {
      setError(`Wait ${resendCountdown} seconds before resending`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setOtp(['', '', '', '', '', '']); // Clear OTP input

    try {
      console.log('🔄 [OTP-RESEND] Requesting new OTP');
      
      const response = await otpAPI.resendOTP(email, name, purpose);

      if (response.success) {
        console.log('✅ [OTP-RESEND] New OTP sent');
        setResendCountdown(60); // Reset timer
        inputRefs.current[0]?.focus();
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error('❌ [OTP-RESEND] Error:', err);
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle paste event
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pastedData.split('');
    
    while (newOtp.length < 6) {
      newOtp.push('');
    }
    
    setOtp(newOtp);
    
    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Verify Your Email
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 sm:p-4 bg-green-100 border-l-4 border-green-500 text-green-700 text-sm rounded">
            ✅ OTP verified! Proceeding...
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-4 p-3 sm:p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 text-sm rounded">
            ⏳ Processing...
          </div>
        )}

        {/* OTP Input Fields */}
        <div className="flex gap-2 sm:gap-3 justify-center mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleOTPChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={loading}
              className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-all disabled:bg-gray-100"
              placeholder="0"
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerifyOTP}
          disabled={loading || otp.join('').length !== 6}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all mb-3"
        >
          {loading ? '⏳ Verifying...' : '✅ Verify OTP'}
        </button>

        {/* Resend Button */}
        <button
          onClick={handleResendOTP}
          disabled={loading || resendCountdown > 0}
          className="w-full py-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium border border-blue-600 disabled:border-gray-400 rounded-lg transition-all"
        >
          {resendCountdown > 0
            ? `Resend in ${resendCountdown}s`
            : '🔄 Resend OTP'}
        </button>

        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            disabled={loading}
            className="w-full mt-3 py-2 text-gray-600 hover:text-gray-700 font-medium border border-gray-300 rounded-lg transition-all"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}