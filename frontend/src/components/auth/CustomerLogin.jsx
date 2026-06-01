import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, CalendarDays, Recycle } from 'lucide-react';
import { authAPI } from '../../utils/api';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import OTPModal from './OTPModal';
import TruckLoader from '../shared/TruckLoader';

function CustomerLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getDashboardRoute(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    if (requestInFlightRef.current || isLoading) return;
    setError('');
    if (!email.trim()) { setError('Please enter your email address'); return; }
    if (!validateEmail(email)) { setError('Please enter a valid email address'); return; }

    requestInFlightRef.current = true;
    setIsLoading(true);
    try {
      await authAPI.requestOTP(email);
      sessionStorage.setItem('otpEmail', email);
      setShowOTP(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) handleLogin();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      {/* Page Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80')`,
        }}
      />
      <div className="absolute inset-0 z-0 bg-black/70 backdrop-blur-xs" />

      {/* Split card */}
      <div className="relative z-10 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-135 border border-white/10">
        {/* Left — Welcome panel */}
        <div className="relative md:w-1/2 hidden md:flex flex-col justify-center px-12 py-14 md:py-20 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-linear-to-br from-primary/90 to-brand-primary-deep/85" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Recycle className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl text-white tracking-tight">GreenShift</span>
            </div>
            <h1 className="font-bold text-4xl md:text-5xl text-white leading-tight mb-5">
              Welcome back
            </h1>
            <p className="text-white/70 text-base md:text-lg leading-relaxed mb-10">
              Sign in to manage your waste pickups, track schedules, and keep your community clean.
            </p>
            <div className="space-y-4">
              {[
                { icon: <MapPin className="w-5 h-5 text-white/90" />, text: 'Real-time pickup tracking' },
                { icon: <CalendarDays className="w-5 h-5 text-white/90" />, text: 'Smart scheduling' },
                { icon: <Recycle className="w-5 h-5 text-white/90" />, text: 'Eco-friendly waste management' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  {icon}
                  <span className="text-white/80 text-base">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Form panel */}
        <div className="md:w-1/2 bg-white flex flex-col justify-center px-10 sm:px-14 py-14 md:py-20">
          <h2 className="font-bold text-3xl text-primary mb-2">Sign in</h2>
          <p className="text-primary/50 text-base mb-10">
            Enter your email to receive a verification code
          </p>

          <div className="space-y-6">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-base font-medium text-primary/80 mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={handleKeyPress}
                placeholder="you@example.com"
                disabled={isLoading}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
                className={`w-full h-13 rounded-xl border px-4 text-base text-primary
                  bg-accent/40 placeholder:text-primary/30 transition-all
                  ${error ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                  focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {error && (
                <p id="login-error" className="text-red-500 text-sm mt-1.5" role="alert">
                  {error}
                </p>
              )}
            </div>

            {isLoading && <TruckLoader />}

            {/* Submit */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-13 bg-primary text-white font-semibold text-base rounded-xl
                hover:bg-brand-primary-hover active:scale-[0.98] transition-all shadow-lg shadow-primary/20
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {isLoading ? 'Sending code...' : 'Continue with email'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-primary/10" />
              <span className="text-sm text-primary/40">or</span>
              <div className="flex-1 h-px bg-primary/10" />
            </div>

            {/* Sign up link */}
            <p className="text-center text-base text-primary/60">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-semibold text-primary hover:text-brand-primary-hover transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={showOTP}
        onClose={() => setShowOTP(false)}
        email={email}
      />
    </div>
  );
}

export default CustomerLoginPage;
