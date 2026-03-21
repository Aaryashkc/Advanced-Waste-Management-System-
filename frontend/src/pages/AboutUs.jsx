import { useState, useEffect, useRef } from 'react';

/* ── tiny hook: animate when element enters viewport ── */
function useInView(options = {}) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.unobserve(el); } },
            { threshold: 0.15, ...options }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, inView];
}

/* ── Fade-in wrapper ── */
function FadeIn({ children, delay = 0, className = '' }) {
    const [ref, inView] = useInView();
    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export default function AboutUs() {
    return (
        <div className="bg-[#f5f1e8] min-h-screen">

            {/* Hero */}
            <section className="relative overflow-hidden py-20 sm:py-28 px-4">
                <div className="absolute inset-0 bg-gradient-to-br from-[#354f52]/5 to-[#296200]/5" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <FadeIn>
                        <span className="inline-block px-4 py-1.5 bg-[#354f52]/10 text-[#354f52] rounded-full text-sm font-semibold mb-6 tracking-wide">
                            About SafaBin
                        </span>
                    </FadeIn>
                    <FadeIn delay={100}>
                        <h1 className="font-['Outfit',sans-serif] text-4xl sm:text-5xl lg:text-6xl font-bold text-[#354f52] leading-tight mb-6">
                            Making Cities <span className="text-[#296200]">Cleaner</span>,<br />
                            One Bin at a Time
                        </h1>
                    </FadeIn>
                    <FadeIn delay={200}>
                        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                            SafaBin is a smart waste management platform that connects communities, drivers, and administrators to keep our cities clean and sustainable.
                        </p>
                    </FadeIn>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="py-16 sm:py-20 px-4">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
                    <FadeIn>
                        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
                            <div className="w-14 h-14 bg-[#354f52]/10 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-[#354f52]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-[#354f52] mb-4">Our Vision</h2>
                            <p className="text-gray-600 leading-relaxed">
                                A world where waste is managed intelligently, cities stay clean effortlessly, and every community has access to efficient, sustainable waste collection services.
                            </p>
                        </div>
                    </FadeIn>
                    <FadeIn delay={150}>
                        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
                            <div className="w-14 h-14 bg-[#296200]/10 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-[#296200]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                </svg>
                            </div>
                            <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-[#354f52] mb-4">Our Mission</h2>
                            <p className="text-gray-600 leading-relaxed">
                                To empower municipalities, waste management companies, and communities with smart technology that simplifies scheduling, tracking, and optimizing waste collection.
                            </p>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* Values */}
            <section className="py-16 sm:py-20 px-4 bg-white/50">
                <div className="max-w-6xl mx-auto">
                    <FadeIn>
                        <h2 className="font-['Outfit',sans-serif] text-3xl sm:text-4xl font-bold text-[#354f52] text-center mb-12">
                            What Drives Us
                        </h2>
                    </FadeIn>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: '🌱', title: 'Sustainability', desc: 'Every decision we make puts the environment first.' },
                            { icon: '🤝', title: 'Community', desc: 'We build tools that bring people together for a cleaner world.' },
                            { icon: '⚡', title: 'Efficiency', desc: 'Smart routes, smart schedules, zero wasted effort.' },
                            { icon: '📊', title: 'Transparency', desc: 'Real-time data so everyone knows the collection status.' },
                            { icon: '🔒', title: 'Reliability', desc: 'Dependable systems that work rain or shine, day or night.' },
                            { icon: '💡', title: 'Innovation', desc: 'Constantly improving with new technology and feedback.' },
                        ].map((v, i) => (
                            <FadeIn key={v.title} delay={i * 100}>
                                <div className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#354f52]/20 hover:shadow-md transition-all duration-300 group">
                                    <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform duration-300">{v.icon}</span>
                                    <h3 className="font-['Outfit',sans-serif] font-semibold text-lg text-[#354f52] mb-2">{v.title}</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 sm:py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-[#354f52] rounded-2xl p-8 sm:p-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { num: '10K+', label: 'Households Served' },
                            { num: '50+', label: 'Active Drivers' },
                            { num: '99.2%', label: 'On-time Pickups' },
                            { num: '200T', label: 'Waste Collected' },
                        ].map((s, i) => (
                            <FadeIn key={s.label} delay={i * 100}>
                                <div className="text-center">
                                    <p className="font-['Outfit',sans-serif] text-3xl sm:text-4xl font-bold text-white mb-1">{s.num}</p>
                                    <p className="text-white/70 text-sm">{s.label}</p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
