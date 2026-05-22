import { useState, useEffect, useRef } from 'react';
import Our_image from "../assets/ourteam.webp"

/* ── Viewport observer ── */
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 },
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
      className={`transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Team data ── */
const TEAM = [
  {
    name: 'Prasanna Maskey',
    role: 'CEO & Founder',
    bio: 'Passionate about sustainable cities and smart infrastructure.',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
  }
];

/* ── Team member card ── */
function TeamCard({ member }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 transition-all hover:border-white/20">
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        <img
          src={member.image}
          alt={member.name}
          className="
            w-full h-full object-cover
            grayscale md:grayscale
            group-hover:grayscale-0 group-hover:scale-105
            transition-all duration-500 ease-out
          "
          loading="lazy"
        />

        {/* Hover overlay — desktop only */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t from-black/90 via-black/40 to-transparent
            opacity-0 group-hover:opacity-100
            transition-opacity duration-300 ease-out
            hidden md:flex flex-col justify-end p-6
          "
        >
          <p className="text-white font-['Outfit',sans-serif] font-semibold text-lg leading-tight">
            {member.name}
          </p>
          <p className="text-white/70 font-['Outfit',sans-serif] text-sm mt-1">
            {member.role}
          </p>
          {member.bio && (
            <p className="text-white/50 font-['Outfit',sans-serif] text-xs mt-2 leading-relaxed">
              {member.bio}
            </p>
          )}
        </div>
      </div>

      {/* Always-visible info — mobile only */}
      <div className="md:hidden px-4 py-4 backdrop-blur-sm">
        <p className="font-['Outfit',sans-serif] font-semibold text-white text-base">
          {member.name}
        </p>
        <p className="font-['Outfit',sans-serif] text-white/70 text-sm mt-0.5">
          {member.role}
        </p>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function OurTeam() {
  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      {/* Dynamic Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${Our_image})`,
        }}
      />
      <div className="fixed inset-0 z-0 bg-black/70 backdrop-blur-xs" />

      {/* Content */}
      <div className="relative z-10 pt-24">
        {/* Hero */}
        <section className="pb-12 sm:pb-16 px-6 md:px-16 lg:px-24 text-center">
          <FadeIn>
            <span className="inline-block text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
              Our Team
            </span>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="font-bold text-white text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight mb-6 drop-shadow-md">
              The people behind SafaBin
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed">
              A dedicated team working to make waste management smarter, more
              efficient, and more sustainable for everyone.
            </p>
          </FadeIn>
        </section>

        {/* Team Grid */}
        <section className="pb-20 sm:pb-28 px-6 md:px-16 lg:px-24">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM.map((member, i) => (
              <FadeIn key={member.name} delay={i * 80}>
                <TeamCard member={member} />
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Join CTA */}
        <section className="pb-20 sm:pb-28 px-6 md:px-16 lg:px-24">
          <FadeIn>
            <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
              <h2 className="font-bold text-white text-2xl sm:text-3xl mb-4">
                Want to join our mission?
              </h2>
              <p className="text-white/70 mb-8 max-w-lg mx-auto leading-relaxed">
                We're always looking for passionate people who want to make a
                difference in their communities.
              </p>
              <a
                href="mailto:careers@safabin.com"
                className="inline-flex items-center px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
              >
                Get in Touch
              </a>
            </div>
          </FadeIn>
        </section>
      </div>
    </div>
  );
}
