import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import OTPModal from './OTPModal';

function TruckLoader() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="relative w-40 h-6 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
        <svg
          className="absolute bottom-0.5 animate-[truckMove_2s_ease-in-out_infinite] w-7 h-4"
          viewBox="0 0 32 20"
          fill="none"
        >
          <rect x="8" y="4" width="16" height="10" rx="2" fill="#354f52" />
          <rect x="24" y="6" width="7" height="8" rx="1.5" fill="#354f52" />
          <rect x="25.5" y="7.5" width="4" height="3.5" rx="0.75" fill="#f5f1e8" />
          <circle cx="13" cy="16" r="2.5" fill="#354f52" />
          <circle cx="13" cy="16" r="1" fill="#f5f1e8" />
          <circle cx="27" cy="16" r="2.5" fill="#354f52" />
          <circle cx="27" cy="16" r="1" fill="#f5f1e8" />
        </svg>
      </div>
    </div>
  );
}

function CustomerSignUpPage() {
  const navigate = useNavigate();
  const { signup, isAuthenticated, user } = useAuthStore();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getDashboardRoute(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    else if (formData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Enter a valid email';

    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    else if (!/^[0-9]{10,15}$/.test(formData.phone.replace(/[\s-]/g, ''))) errs.phone = 'Enter a valid phone number';

    if (!formData.address.trim()) errs.address = 'Address is required';
    else if (formData.address.trim().length < 10) errs.address = 'Enter a complete address';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await signup({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        role: 'customer_admin',
      });

      if (result.success) {
        if (result.requireOtp) {
          sessionStorage.setItem('otpEmail', formData.email);
          setShowOTP(true);
        } else {
          navigate(getDashboardRoute(result.user.role), { replace: true });
        }
      } else {
        setErrors({ submit: result.error || 'Sign up failed. Please try again.' });
      }
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Sign up failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) handleSubmit();
  };

  const fields = [
    { id: 'name', label: 'Full name', type: 'text', placeholder: 'John Doe' },
    { id: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
    { id: 'phone', label: 'Phone number', type: 'tel', placeholder: '9800000000' },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      {/* Greenery background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80')`,
        }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Split card */}
      <div className="relative z-10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[560px]">
        {/* Left — Welcome panel */}
        <div className="relative md:w-5/12 flex flex-col justify-center px-10 py-12 md:py-16 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#354f52]/90 to-[#2f3e46]/85" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span className="font-['Outfit',sans-serif] font-bold text-xl text-white tracking-tight">SafaBin</span>
            </div>
            <h1 className="font-['Outfit',sans-serif] font-bold text-3xl md:text-4xl text-white leading-tight mb-4">
              Join SafaBin
            </h1>
            <p className="font-['Poppins',sans-serif] text-white/70 text-sm md:text-base leading-relaxed mb-8">
              Create your account and start managing waste pickups the smart way.
            </p>
            <div className="space-y-3">
              {[
                { icon: '🚀', text: 'Get started in minutes' },
                { icon: '🗓️', text: 'Schedule pickups instantly' },
                { icon: '🌱', text: 'Make a greener impact' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-lg">{icon}</span>
                  <span className="font-['Poppins',sans-serif] text-white/80 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Form panel */}
        <div className="md:w-7/12 bg-white flex flex-col justify-center px-8 sm:px-12 py-10 md:py-14">
          <h2 className="font-['Outfit',sans-serif] font-bold text-2xl text-primary mb-1">Create your account</h2>
          <p className="font-['Poppins',sans-serif] text-primary/50 text-sm mb-6">
            Fill in your details to get started
          </p>

          <div className="space-y-4">
            {/* Name + Email row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.slice(0, 2).map(({ id, label, type, placeholder }) => (
                <div key={id}>
                  <label
                    htmlFor={id}
                    className="block font-['Poppins',sans-serif] text-sm font-medium text-primary/80 mb-1.5"
                  >
                    {label}
                  </label>
                  <input
                    id={id}
                    type={type}
                    value={formData[id]}
                    onChange={(e) => handleChange(id, e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={placeholder}
                    disabled={isLoading}
                    aria-invalid={errors[id] ? 'true' : 'false'}
                    aria-describedby={errors[id] ? `${id}-error` : undefined}
                    className={`w-full h-11 rounded-xl border px-4 font-['Poppins',sans-serif] text-sm text-primary
                      bg-accent/40 placeholder:text-primary/30 transition-all
                      ${errors[id] ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                      focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors[id] && (
                    <p id={`${id}-error`} className="text-red-500 text-xs mt-1 font-['Poppins',sans-serif]" role="alert">
                      {errors[id]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block font-['Poppins',sans-serif] text-sm font-medium text-primary/80 mb-1.5"
              >
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="9800000000"
                disabled={isLoading}
                aria-invalid={errors.phone ? 'true' : 'false'}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
                className={`w-full h-11 rounded-xl border px-4 font-['Poppins',sans-serif] text-sm text-primary
                  bg-accent/40 placeholder:text-primary/30 transition-all
                  ${errors.phone ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                  focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {errors.phone && (
                <p id="phone-error" className="text-red-500 text-xs mt-1 font-['Poppins',sans-serif]" role="alert">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label
                htmlFor="address"
                className="block font-['Poppins',sans-serif] text-sm font-medium text-primary/80 mb-1.5"
              >
                Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Enter your complete address"
                disabled={isLoading}
                rows="2"
                aria-invalid={errors.address ? 'true' : 'false'}
                aria-describedby={errors.address ? 'address-error' : undefined}
                className={`w-full rounded-xl border px-4 py-3 font-['Poppins',sans-serif] text-sm text-primary
                  bg-accent/40 placeholder:text-primary/30 transition-all resize-none
                  ${errors.address ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                  focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {errors.address && (
                <p id="address-error" className="text-red-500 text-xs mt-1 font-['Poppins',sans-serif]" role="alert">
                  {errors.address}
                </p>
              )}
            </div>

            {/* Submit error */}
            {errors.submit && (
              <p className="text-red-500 text-xs font-['Poppins',sans-serif]" role="alert">
                {errors.submit}
              </p>
            )}

            {isLoading && <TruckLoader />}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full h-12 bg-primary text-white font-['Inter',sans-serif] font-semibold text-sm rounded-xl
                hover:bg-[#2a3f41] active:scale-[0.98] transition-all shadow-lg shadow-primary/20
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-primary/10" />
              <span className="font-['Poppins',sans-serif] text-xs text-primary/40">or</span>
              <div className="flex-1 h-px bg-primary/10" />
            </div>

            {/* Login link */}
            <p className="text-center font-['Poppins',sans-serif] text-sm text-primary/60">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary hover:text-[#2a3f41] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={showOTP}
        onClose={() => setShowOTP(false)}
        email={formData.email}
      />
    </div>
  );
}

export default CustomerSignUpPage;
