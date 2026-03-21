import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../utils/api';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';

function CustomerLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const dashboardRoute = getDashboardRoute(user.role);
      navigate(dashboardRoute, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Request OTP from backend
      await authAPI.requestOTP(email);

      // Store email in sessionStorage for OTP verification page
      sessionStorage.setItem('otpEmail', email);

      // Navigate to OTP verification page
      navigate('/otp-verification');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleDriverSignUp = () => {
    console.log('Navigate to driver sign up page');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="bg-[#f5f1e8] min-h-screen flex flex-col">

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left Side - Form */}
            <div className="w-full max-w-xl mx-auto lg:mx-0">
              {/* Welcome Heading */}
              <h2 className="font-['Outfit',sans-serif] font-bold text-4xl sm:text-5xl lg:text-6xl text-[#354f52] mb-8 sm:mb-12">
                <span className="block leading-tight mb-2">
                  Hello <span className="text-[#296200]">User</span>
                </span>
                <span className="block leading-tight">
                  Welcome <span className="text-[#296200]">Back</span>
                </span>
              </h2>

              {/* Login Form */}
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block font-['Poppins',sans-serif] text-lg sm:text-xl text-[#354f52] mb-3"
                  >
                    Enter your email to continue
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your email here....."
                    disabled={isLoading}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? 'email-error' : undefined}
                    className={`w-full sm:w-80 border ${error ? 'border-red-500' : 'border-black'} border-solid h-12 sm:h-14 rounded-xl px-4 sm:px-5 font-['Poppins',sans-serif] text-sm sm:text-base text-[#354f52] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                  />

                  {error && (
                    <p id="email-error" className="text-red-500 text-sm mt-2 font-['Poppins',sans-serif]" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                {/* Login Button */}
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="bg-[#354f52] flex gap-3 h-12 sm:h-14 items-center justify-center px-8 sm:px-10 rounded-2xl hover:bg-[#2a3f41] transition-all active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 shadow-md"
                  aria-label="Log in to your account"
                >
                  <span className="font-['Inter',sans-serif] font-medium text-[#f5f1e8] text-lg sm:text-xl">
                    {isLoading ? 'Logging in...' : 'Log In'}
                  </span>
                  {!isLoading && (
                    <svg className="rotate-90 w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 22 22" aria-hidden="true">
                      <path
                        d="M11 16.5V5.5M11 5.5L5.5 11M11 5.5L16.5 11"
                        stroke="#F5F1E8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </button>

                {/* Sign Up Links */}
                <div className="space-y-3 pt-4">
                  <p className="font-['Poppins',sans-serif] text-sm sm:text-base text-black-100">
                    Don't have an account?{' '}
                    <button
                      onClick={handleSignUp}
                      className="font-['Poppins',sans-serif] font-semibold text-[#007300] hover:text-[#005500] underline focus:outline-none focus:ring-2 focus:ring-[#007300] rounded-sm"
                    >
                      Sign up
                    </button>
                  </p>


                </div>
              </div>
            </div>

            {/* Right Side - Hero Image */}
            <div className="hidden lg:block">
              <div
                className="relative w-full aspect-[4/5] max-w-md xl:max-w-lg mx-auto"
                role="img"
                aria-label="Waste management worker in orange uniform"
              >
                <img
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl"
                  src="https://images.unsplash.com/photo-1581087098160-aa099753eed1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXN0ZSUyMG1hbmFnZW1lbnQlMjB3b3JrZXIlMjBvcmFuZ2UlMjB1bmlmb3JtfGVufDF8fHx8MTc2OTg3NjA1OXww&ixlib=rb-4.1.0&q=80&w=1080"
                  loading="lazy"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 border-[#84a98c] border-8 sm:border-[12px] lg:border-[16px] rounded-2xl pointer-events-none"
                />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default CustomerLoginPage;