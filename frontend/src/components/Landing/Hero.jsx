import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import { useRef, useState, useEffect } from 'react';
import HERO_IMAGE from "../../assets/hero.png"

/* ── Viewport observer ── */
function useInView(options = {}) {
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
      { threshold: 0.12, ...options },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* ── Animated counter ── */
function Counter({ end, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView();

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1600;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

const stats = [
  { value: 98, suffix: '%', label: 'On-Time Pickups' },
  { value: 500, suffix: '+', label: 'Daily Routes' },
  { value: 12, suffix: 'K+', label: 'Happy Users' },
];

export function Hero() {
  const { isAuthenticated, user } = useAuthStore();

  const getStartedLink = isAuthenticated && user
    ? getDashboardRoute(user.role)
    : '/login';
  const getStartedLabel = isAuthenticated ? 'Go to Dashboard' : 'Get Started';

  return (
    <section className="relative w-full min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background Image - NO fade effect */}
      <img
        src={HERO_IMAGE}
        alt="Modern clean city"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark Overlay with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40 z-0"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-24 flex flex-col justify-center min-h-[calc(100vh-100px)] py-16">
        {/* Wrap ONLY the text block in lp-reveal for the fade effect */}
        <div className="w-full max-w-3xl text-left lp-reveal">

          <h1 className="font-bold text-white text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tight mb-6">
            Smarter waste <br className="hidden sm:block" />
            <span className="relative inline-block mt-2">
              collection
              <svg className="absolute w-full h-3 -bottom-2.5 left-0 text-white opacity-30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 15 100 5" stroke="currentColor" strokeWidth="3" fill="transparent" />
              </svg>
            </span>
          </h1>

          <p className="text-white/80 text-lg md:text-xl leading-relaxed max-w-xl mb-10">
            Safabin streamlines your entire waste management operation. Track routes, assign drivers, and respond to requests in real time with our powerful platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
            <Link to={getStartedLink} className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-full font-medium text-lg flex items-center justify-center gap-3 transition-all cursor-pointer hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/50 hover:-translate-y-0.5">
                {getStartedLabel}
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link to="/about-us" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-full font-medium text-lg flex items-center justify-center gap-3 transition-all cursor-pointer hover:bg-white/20 hover:shadow-md">
                Learn More
              </button>
            </Link>
          </div>

          {/* ── Landing Page Hero Stats ── */}
          <div className="w-full mt-16 pt-8 border-t border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-left">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl sm:text-4xl font-bold text-white">
                    <Counter end={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-white/60 text-sm mt-1 font-medium">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
