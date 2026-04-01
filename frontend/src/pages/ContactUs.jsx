import { useState, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const HERO_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop';
const CTA_IMG = 'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=2070&auto=format&fit=crop';

const RATE_LIMIT_MS = 30000;

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ContactUs() {
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [serverError, setServerError] = useState('');
    const lastSubmitRef = useRef(0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = 'Full name is required.';
        if (!form.email.trim()) {
            errs.email = 'Email is required.';
        } else if (!validateEmail(form.email)) {
            errs.email = 'Enter a valid email address.';
        }
        if (!form.message.trim()) errs.message = 'Message is required.';
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');

        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        const now = Date.now();
        if (now - lastSubmitRef.current < RATE_LIMIT_MS) {
            setServerError('Please wait before submitting again.');
            return;
        }

        setStatus('loading');
        setErrors({});

        try {
            await axios.post(`${API_URL}/contact/submit`, {
                name: form.name.trim(),
                email: form.email.trim(),
                subject: form.subject.trim(),
                message: form.message.trim(),
            });
            lastSubmitRef.current = Date.now();
            setStatus('success');
            setForm({ name: '', email: '', subject: '', message: '' });
        } catch (err) {
            setStatus('error');
            setServerError(
                err.response?.data?.message || 'Something went wrong. Please try again later.'
            );
        }
    };

    const resetForm = () => {
        setStatus('idle');
        setServerError('');
        setErrors({});
    };

    const inputClass = (field) =>
        `w-full border rounded-lg px-4 py-3 text-sm bg-white transition-colors duration-150 outline-none ${
            errors[field]
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-[#354f52]'
        }`;

    return (
        <div className="bg-[#f5f1e8] min-h-screen">
            {/* Hero with background image */}
            <section className="relative w-full min-h-[50vh] flex items-center justify-center overflow-hidden">
                <img
                    src={HERO_IMG}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/65" />
                <div className="relative z-10 text-center px-6 py-24 sm:py-32">
                    <h1 className="font-['Outfit',sans-serif] text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                        Contact Us
                    </h1>
                    <p className="text-base text-white/70 max-w-xl mx-auto leading-relaxed">
                        Have a question or need help? Fill out the form and our team will respond
                        within one business day.
                    </p>
                </div>
            </section>

            {/* Content */}
            <section className="py-16 sm:py-24 px-6">
                <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-10">
                    {/* Form */}
                    <div className="lg:col-span-3 order-1">
                        <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-200">
                            <h2 className="font-['Outfit',sans-serif] font-semibold text-lg text-[#354f52] mb-6">
                                Send a Message
                            </h2>

                            {status === 'success' ? (
                                <div>
                                    <div className="bg-green-50 border border-green-200 text-green-800 px-5 py-4 rounded-lg text-sm mb-4">
                                        <p className="font-medium mb-1">Message sent successfully.</p>
                                        <p className="text-green-700">
                                            Thank you for reaching out. We will get back to you at{' '}
                                            <span className="font-medium">{form.email || 'your email'}</span>{' '}
                                            within one business day.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="text-sm text-[#354f52] font-medium underline underline-offset-2 hover:text-[#2a3f41] transition-colors"
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                                    {serverError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                            {serverError}
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="name"
                                            name="name"
                                            type="text"
                                            value={form.name}
                                            onChange={handleChange}
                                            className={inputClass('name')}
                                            aria-invalid={!!errors.name}
                                            aria-describedby={errors.name ? 'name-error' : undefined}
                                        />
                                        {errors.name && (
                                            <p id="name-error" className="mt-1.5 text-sm text-red-600">{errors.name}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={form.email}
                                            onChange={handleChange}
                                            className={inputClass('email')}
                                            aria-invalid={!!errors.email}
                                            aria-describedby={errors.email ? 'email-error' : undefined}
                                        />
                                        {errors.email && (
                                            <p id="email-error" className="mt-1.5 text-sm text-red-600">{errors.email}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Subject
                                        </label>
                                        <input
                                            id="subject"
                                            name="subject"
                                            type="text"
                                            value={form.subject}
                                            onChange={handleChange}
                                            className={inputClass('subject')}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Message <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            rows={5}
                                            value={form.message}
                                            onChange={handleChange}
                                            className={`${inputClass('message')} resize-none`}
                                            aria-invalid={!!errors.message}
                                            aria-describedby={errors.message ? 'message-error' : undefined}
                                        />
                                        {errors.message && (
                                            <p id="message-error" className="mt-1.5 text-sm text-red-600">{errors.message}</p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="w-full bg-[#354f52] text-white font-medium py-3 rounded-lg hover:bg-[#2a3f41] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                    >
                                        {status === 'loading' ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Message'
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:col-span-2 order-2 space-y-6">
                        <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-200">
                            <h2 className="font-['Outfit',sans-serif] font-semibold text-lg text-[#354f52] mb-5">
                                Contact Information
                            </h2>
                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
                                    <a href="mailto:support@safabin.com" className="text-[#354f52] font-medium text-sm hover:underline">
                                        support@safabin.com
                                    </a>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                                    <a href="tel:+97711234567" className="text-[#354f52] font-medium text-sm hover:underline">
                                        +977 01-1234567
                                    </a>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Office</p>
                                    <p className="text-[#354f52] font-medium text-sm">Kathmandu, Nepal</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#354f52] rounded-xl p-6 sm:p-8 text-white">
                            <h2 className="font-['Outfit',sans-serif] font-semibold text-lg mb-4">
                                Working Hours
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-white/70">Sunday - Friday</span>
                                    <span className="font-medium">9:00 AM - 6:00 PM</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/70">Saturday</span>
                                    <span className="font-medium">Closed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA band with background image */}
            <section className="relative w-full min-h-[280px] flex items-center justify-center overflow-hidden">
                <img
                    src={CTA_IMG}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[#354f52]/80" />
                <div className="relative z-10 text-center px-6 py-16 sm:py-20 max-w-2xl mx-auto">
                    <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl md:text-3xl font-bold text-white leading-snug mb-3">
                        We are here to help your community stay clean
                    </h2>
                    <p className="text-white/60 text-sm sm:text-base leading-relaxed">
                        Whether you are a municipality, a business, or a resident — reach out
                        and we will find the right solution for you.
                    </p>
                </div>
            </section>
        </div>
    );
}
