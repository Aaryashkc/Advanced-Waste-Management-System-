import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import { authAPI } from '../../utils/api';

function TruckLoader() {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="relative w-48 h-6 overflow-hidden">
        {/* Road line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/20" />
        {/* Truck SVG */}
        <svg
          className="absolute bottom-0.5 animate-[truckMove_2s_ease-in-out_infinite] w-8 h-5"
          viewBox="0 0 32 20"
          fill="none"
        >
          {/* Truck body */}
          <rect x="8" y="4" width="16" height="10" rx="2" fill="#354f52" />
          {/* Cabin */}
          <rect x="24" y="6" width="7" height="8" rx="1.5" fill="#354f52" />
          {/* Window */}
          <rect x="25.5" y="7.5" width="4" height="3.5" rx="0.75" fill="#f5f1e8" />
          {/* Wheels */}
          <circle cx="13" cy="16" r="2.5" fill="#354f52" />
          <circle cx="13" cy="16" r="1" fill="#f5f1e8" />
          <circle cx="27" cy="16" r="2.5" fill="#354f52" />
          <circle cx="27" cy="16" r="1" fill="#f5f1e8" />
        </svg>
      </div>
    </div>
  );
}

export default function OTPModal({ isOpen, onClose, email, onSuccess }) {
  const navigate = useNavigate();
  const { loginWithOTP } = useAuthStore();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef([]);

  // Focus first input on open
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setError('');
      setResendTimer(60);
      setCanResend(false);
      setResendSuccess(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  // Resend timer
  useEffect(() => {
    if (!isOpen) return;
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer, isOpen]);

  const handleChange = useCallback((index, value) => {
    if (value && !/^\d$/.test(value)) return;
    setOtp(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError('');
    setResendSuccess(false);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerify();
    }
  }, [otp]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(next);
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();
  }, []);

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await loginWithOTP(code, email);
      if (result.success) {
        sessionStorage.removeItem('otpEmail');
        const dashboardRoute = getDashboardRoute(result.user.role);
        if (onSuccess) onSuccess(result);
        navigate(dashboardRoute, { replace: true });
      } else {
        setError(result.error || 'Invalid code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setError('');
    setResendSuccess(false);

    try {
      await authAPI.requestOTP(email);
      setResendSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
      setCanResend(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={!isLoading ? onClose : undefined} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8 animate-[modalIn_200ms_ease-out]">
        {/* Close button */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-primary/40 hover:text-primary transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="mb-6">
          <h2 className="font-['Outfit',sans-serif] font-semibold text-xl sm:text-2xl text-primary">
            Verify your email
          </h2>
          <p className="font-['Poppins',sans-serif] text-sm text-primary/60 mt-1">
            We sent a 6-digit code to <span className="font-medium text-primary/80">{email}</span>
          </p>
        </div>

        {/* OTP Inputs */}
        <div className="flex gap-2.5 sm:gap-3 justify-center mb-5">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={isLoading}
              className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-['Poppins',sans-serif] font-semibold rounded-xl border-2 transition-all
                ${error ? 'border-red-400 bg-red-50/50' : digit ? 'border-primary bg-white' : 'border-primary/20 bg-accent/30'}
                focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30
                disabled:opacity-50 disabled:cursor-not-allowed text-primary`}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4 font-['Poppins',sans-serif]" role="alert">
            {error}
          </p>
        )}

        {/* Resend success */}
        {resendSuccess && !error && (
          <p className="text-[#296200] text-sm text-center mb-4 font-['Poppins',sans-serif]">
            New code sent successfully
          </p>
        )}

        {/* Truck loader — only during verification */}
        {isLoading && <TruckLoader />}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length !== 6}
          className="w-full h-12 bg-primary text-accent font-['Inter',sans-serif] font-medium text-base rounded-xl
            hover:bg-[#2a3f41] active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        {/* Resend */}
        <p className="text-center mt-4 font-['Poppins',sans-serif] text-sm text-primary/60">
          Didn't receive the code?{' '}
          {canResend ? (
            <button
              onClick={handleResend}
              className="font-medium text-primary hover:text-[#296200] underline underline-offset-2 transition-colors"
            >
              Resend
            </button>
          ) : (
            <span className="font-medium text-primary/40">
              Resend in {resendTimer}s
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
