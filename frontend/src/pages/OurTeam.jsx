import { useState, useEffect, useRef } from 'react';

function useInView() {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.unobserve(el); } },
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, inView];
}

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

const TEAM = [
    {
        name: 'Prasanna Maskey',
        role: 'CEO & Founder',
        bio: 'Passionate about sustainable cities and smart infrastructure.',
        avatar: '👨‍💼',
        color: 'bg-[#354f52]',
    },
];

export default function OurTeam() {
    return (
        <div className="bg-[#f5f1e8] min-h-screen">
            {/* Hero */}
            <section className="py-20 sm:py-28 px-4 text-center">
                <FadeIn>
                    <span className="inline-block px-4 py-1.5 bg-[#354f52]/10 text-[#354f52] rounded-full text-sm font-semibold mb-6 tracking-wide">
                        Our Team
                    </span>
                </FadeIn>
                <FadeIn delay={100}>
                    <h1 className="font-['Outfit',sans-serif] text-4xl sm:text-5xl lg:text-6xl font-bold text-[#354f52] leading-tight mb-6">
                        Meet the <span className="text-[#296200]">People</span><br />
                        Behind SafaBin
                    </h1>
                </FadeIn>
                <FadeIn delay={200}>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        A dedicated team working to make waste management smarter, more efficient, and more sustainable for everyone.
                    </p>
                </FadeIn>
            </section>

            {/* Team Grid */}
            <section className="pb-20 sm:pb-28 px-4">
                <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {TEAM.map((member, i) => (
                        <FadeIn key={member.name} delay={i * 100}>
                            <div className="group bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                {/* Avatar */}
                                <div className={`w-16 h-16 ${member.color} rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                                    {member.avatar}
                                </div>

                                <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-[#354f52] mb-1">
                                    {member.name}
                                </h3>
                                <p className="text-[#296200] font-medium text-sm mb-3">{member.role}</p>
                                <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* Join CTA */}
            <section className="pb-20 sm:pb-28 px-4">
                <FadeIn>
                    <div className="max-w-3xl mx-auto bg-[#354f52] rounded-2xl p-8 sm:p-12 text-center">
                        <h2 className="font-['Outfit',sans-serif] text-2xl sm:text-3xl font-bold text-white mb-4">
                            Want to Join Our Mission?
                        </h2>
                        <p className="text-white/70 mb-6 max-w-lg mx-auto">
                            We're always looking for passionate people who want to make a difference in their communities.
                        </p>
                        <a
                            href="mailto:careers@safabin.com"
                            className="inline-flex items-center px-6 py-3 bg-white text-[#354f52] font-semibold rounded-xl hover:bg-white/90 transition active:scale-95"
                        >
                            Get in Touch
                        </a>
                    </div>
                </FadeIn>
            </section>
        </div>
    );
}
