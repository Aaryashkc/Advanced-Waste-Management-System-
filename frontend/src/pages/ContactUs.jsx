import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Recycle } from 'lucide-react';
import axios from 'axios';
import TruckLoader from '../components/shared/TruckLoader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.message.trim()) errs.message = 'Message is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);
    try {
      await axios.post(`${API_URL}/contact/submit`, form);
      setSubmitted(true);
      setForm({ name: '', email: '', message: '' });
      setErrors({});
    } catch (err) {
      setServerError(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && !loading) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-white">
      <div className="relative z-10 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px] border border-gray-100">
        {/* Left — Info panel */}
        <div className="relative md:w-5/12 flex flex-col justify-center px-12 py-14 md:py-20 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#354f52]/90 to-[#2f3e46]/85" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Recycle className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl text-white tracking-tight">SafaBin</span>
            </div>
            <h1 className="font-bold text-4xl md:text-5xl text-white leading-tight mb-5">
              Get in Touch
            </h1>
            <p className="text-white/70 text-base md:text-lg leading-relaxed mb-10">
              Have questions or feedback? We'd love to hear from you.
            </p>
            <div className="space-y-4">
              {[
                { icon: <Mail className="w-5 h-5 text-white/90" />, text: 'support@safabin.com' },
                { icon: <Phone className="w-5 h-5 text-white/90" />, text: '+977 01-1234567' },
                { icon: <MapPin className="w-5 h-5 text-white/90" />, text: 'Kathmandu, Nepal' },
                { icon: <Clock className="w-5 h-5 text-white/90" />, text: 'Sun - Fri, 9 AM - 6 PM' },
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
        <div className="md:w-7/12 bg-white flex flex-col justify-center px-10 sm:px-14 py-12 md:py-16">
          {submitted ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-primary mb-2">Message sent successfully</h3>
              <p className="text-primary/50 text-sm mb-6">We'll get back to you soon.</p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-primary font-medium hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-3xl text-primary mb-2">Send us a message</h2>
              <p className="text-primary/50 text-base mb-8">
                Fill in the form and we'll respond as soon as possible
              </p>

              {serverError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Name + Email row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-base font-medium text-primary/80 mb-2">
                      Full name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      onKeyDown={handleKeyPress}
                      placeholder="John Doe"
                      disabled={loading}
                      className={`w-full h-12 rounded-xl border px-4 text-base text-primary
                        bg-accent/40 placeholder:text-primary/30 transition-all
                        ${errors.name ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-base font-medium text-primary/80 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      onKeyDown={handleKeyPress}
                      placeholder="you@example.com"
                      disabled={loading}
                      className={`w-full h-12 rounded-xl border px-4 text-base text-primary
                        bg-accent/40 placeholder:text-primary/30 transition-all
                        ${errors.email ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-base font-medium text-primary/80 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="How can we help you?"
                    disabled={loading}
                    className={`w-full rounded-xl border px-4 py-3 text-base text-primary
                      bg-accent/40 placeholder:text-primary/30 transition-all resize-none
                      ${errors.message ? 'border-red-400' : 'border-primary/10 hover:border-primary/25'}
                      focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm">{errors.submit}</p>
                )}

                {loading && <TruckLoader />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 bg-primary text-white font-semibold text-base rounded-xl
                    hover:bg-[#2a3f41] active:scale-[0.98] transition-all shadow-lg shadow-primary/20
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
