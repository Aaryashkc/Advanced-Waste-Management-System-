import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import { authAPI } from '../../utils/api';

function CustomerSignUpPage() {
  const navigate = useNavigate();
  const { signup, isAuthenticated, user, loading } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [errors, setErrors] = useState({});
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

  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10,15}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter your name';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter your email address';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Please enter your phone number';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Please enter your address';
    } else if (formData.address.trim().length < 10) {
      newErrors.address = 'Please enter a complete address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const signupData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        role: 'customer_admin' // Default role for customer signup
      };

      const result = await signup(signupData);

      if (result.success) {
        if (result.requireOtp) {
          // Store email for OTP verification
          sessionStorage.setItem('otpEmail', formData.email);
          navigate('/otp-verification');
        } else {
          // Should not happen with new flow, but fallback just in case
          const dashboardRoute = getDashboardRoute(result.user.role);
          navigate(dashboardRoute, { replace: true });
        }
      } else {
        setErrors({ submit: result.error || 'Sign up failed. Please try again.' });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Sign up failed. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="bg-[#f5f1e8] min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="w-full max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

          {/* Left Side - Form */}
          <div className="w-full max-w-xl mx-auto lg:mx-0">
            {/* Welcome Heading */}
            <h1 className="font-['Outfit',sans-serif] font-bold text-4xl sm:text-5xl lg:text-6xl text-[#354f52] mb-4 sm:mb-6">
              <span className="block leading-tight mb-2">
                Join <span className="text-[#296200]">SafaBin</span>
              </span>
              <span className="block leading-tight">
                Create Your <span className="text-[#296200]">Account</span>
              </span>
            </h1>

            <p className="font-['Poppins',sans-serif] text-base sm:text-lg text-[#354f52] mb-8 sm:mb-10">
              Fill in your details to get started
            </p>

            {/* Sign Up Form */}
            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="name"
                  className="block font-['Poppins',sans-serif] text-base sm:text-lg text-[#354f52] mb-2"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  className={`w-full border ${errors.name ? 'border-red-500' : 'border-black'} border-solid h-12 sm:h-14 rounded-xl px-4 sm:px-5 font-['Poppins',sans-serif] text-sm sm:text-base text-[#354f52] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                />
                {errors.name && (
                  <p id="name-error" className="text-red-500 text-sm mt-1 font-['Poppins',sans-serif]" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block font-['Poppins',sans-serif] text-base sm:text-lg text-[#354f52] mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`w-full border ${errors.email ? 'border-red-500' : 'border-black'} border-solid h-12 sm:h-14 rounded-xl px-4 sm:px-5 font-['Poppins',sans-serif] text-sm sm:text-base text-[#354f52] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                />
                {errors.email && (
                  <p id="email-error" className="text-red-500 text-sm mt-1 font-['Poppins',sans-serif]" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Phone Field */}
              <div>
                <label
                  htmlFor="phone"
                  className="block font-['Poppins',sans-serif] text-base sm:text-lg text-[#354f52] mb-2"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your phone number"
                  disabled={isLoading}
                  aria-invalid={errors.phone ? 'true' : 'false'}
                  aria-describedby={errors.phone ? 'phone-error' : undefined}
                  className={`w-full border ${errors.phone ? 'border-red-500' : 'border-black'} border-solid h-12 sm:h-14 rounded-xl px-4 sm:px-5 font-['Poppins',sans-serif] text-sm sm:text-base text-[#354f52] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-red-500 text-sm mt-1 font-['Poppins',sans-serif]" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Address Field */}
              <div>
                <label
                  htmlFor="address"
                  className="block font-['Poppins',sans-serif] text-base sm:text-lg text-[#354f52] mb-2"
                >
                  Address
                </label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter your complete address"
                  disabled={isLoading}
                  rows="3"
                  aria-invalid={errors.address ? 'true' : 'false'}
                  aria-describedby={errors.address ? 'address-error' : undefined}
                  className={`w-full border ${errors.address ? 'border-red-500' : 'border-black'} border-solid rounded-xl px-4 sm:px-5 py-3 font-['Poppins',sans-serif] text-sm sm:text-base text-[#354f52] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none`}
                />
                {errors.address && (
                  <p id="address-error" className="text-red-500 text-sm mt-1 font-['Poppins',sans-serif]" role="alert">
                    {errors.address}
                  </p>
                )}
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <p className="text-red-500 text-sm font-['Poppins',sans-serif]" role="alert">
                  {errors.submit}
                </p>
              )}

              {/* Sign Up Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-[#354f52] flex gap-3 h-12 sm:h-14 items-center justify-center px-8 rounded-2xl hover:bg-[#2a3f41] transition-all active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 shadow-md"
                aria-label="Create your account"
              >
                <span className="font-['Inter',sans-serif] font-medium text-[#f5f1e8] text-lg sm:text-xl">
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
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

              {/* Login Links */}
              <div className="space-y-3 pt-4">
                <p className="font-['Poppins',sans-serif] text-sm sm:text-base text-[rgba(0,0,0,0.87)] text-center">
                  Already have an account?{' '}
                  <button
                    onClick={handleLogin}
                    className="font-['Poppins',sans-serif] font-semibold text-[#007300] hover:text-[#005500] underline focus:outline-none focus:ring-2 focus:ring-[#007300] rounded-sm"
                  >
                    Sign in
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
                src="https://images.unsplash.com/photo-1581087098160-aa099753eed1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXN0ZSUyMG1hbmFnZW1lbnQlMjB3b3JrZXIlMjB1bmlmb3JtfGVufDF8fHx8MTc2OTg3NjA1OXww&ixlib=rb-4.1.0&q=80&w=1080"
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
    </div>
  );
}

export default CustomerSignUpPage;