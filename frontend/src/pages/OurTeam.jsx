import { useState, useEffect, useRef } from 'react';

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
      className={`transition-all duration-700 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
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
  },
  {
    name: 'Sita Sharma',
    role: 'CTO',
    bio: 'Building scalable systems for real-world logistics.',
    image:
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Arjun Thapa',
    role: 'Lead Engineer',
    bio: 'Turning route optimization theory into working software.',
    image:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Priya Karki',
    role: 'Product Designer',
    bio: 'Designing tools that dispatchers and drivers actually want to use.',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Bikash Rai',
    role: 'Operations Lead',
    bio: 'Bridging the gap between field operations and software.',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=600&auto=format&fit=crop',
  },
  {
    name: 'Anjali Basnet',
    role: 'Data Scientist',
    bio: 'Using data to make collection routes smarter every day.',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=600&auto=format&fit=crop',
  },
];

/* ── Team member card ── */
function TeamCard({ member }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-primary/5">
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={member.image}
          alt={member.name}
          className="
            w-full h-full object-cover
            grayscale md:grayscale
            group-hover:grayscale-0
            transition-[filter] duration-300 ease-out
          "
          loading="lazy"
        />

        {/* Hover overlay — desktop only */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t from-primary/80 via-primary/30 to-transparent
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
      <div className="md:hidden px-4 py-4">
        <p className="font-['Outfit',sans-serif] font-semibold text-primary text-base">
          {member.name}
        </p>
        <p className="font-['Outfit',sans-serif] text-primary/55 text-sm mt-0.5">
          {member.role}
        </p>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function OurTeam() {
  return (
    <div className="bg-secondary min-h-screen font-['Outfit',sans-serif]">
      {/* Hero */}
      <section className="py-20 sm:py-28 px-6 md:px-16 lg:px-24 text-center">
        <FadeIn>
          <span className="inline-block text-primary/40 text-xs font-semibold tracking-widest uppercase mb-4">
            Our Team
          </span>
        </FadeIn>
        <FadeIn delay={100}>
          <h1 className="font-bold text-primary text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight mb-6">
            The people behind SafaBin
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="text-primary/55 text-lg max-w-2xl mx-auto leading-relaxed">
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
          <div className="max-w-3xl mx-auto bg-primary rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="font-bold text-white text-2xl sm:text-3xl mb-4">
              Want to join our mission?
            </h2>
            <p className="text-white/60 mb-6 max-w-lg mx-auto leading-relaxed">
              We're always looking for passionate people who want to make a
              difference in their communities.
            </p>
            <a
              href="mailto:careers@safabin.com"
              className="inline-flex items-center px-6 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-accent transition-colors duration-200"
            >
              Get in Touch
            </a>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
