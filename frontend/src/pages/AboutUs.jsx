import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Truck,
  BarChart3,
  Users,
  ArrowRight,
  Recycle,
  Leaf,
  ShieldCheck,
  Clock,
} from 'lucide-react';

/* ── Images (Unsplash) ── */
const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2070&auto=format&fit=crop',
  mission:
    'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=1200&auto=format&fit=crop',
  team: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1200&auto=format&fit=crop',
  operations:
    'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=1200&auto=format&fit=crop',
  city: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1200&auto=format&fit=crop',
  green:
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1200&auto=format&fit=crop',
};

const DEFAULT_OBSERVER_OPTIONS = {};

/* ── Viewport observer ── */
function useInView(options = DEFAULT_OBSERVER_OPTIONS) {
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
  }, [options]);
  return [ref, inView];
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-600 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
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

/* ── Data ── */

const stats = [
  { value: 500, suffix: '+', label: 'Pickups Daily' },
  { value: 98, suffix: '%', label: 'On-Time Rate' },
  { value: 40, suffix: '%', label: 'Fuel Savings' },
  { value: 12, suffix: 'K+', label: 'Users Served' },
];

const values = [
  {
    icon: Leaf,
    title: 'Sustainability First',
    description:
      'Every feature is designed to reduce environmental impact — from optimized routes that cut emissions to analytics that minimize waste overflow.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliability at Scale',
    description:
      'Built for real fleets on real roads. Our infrastructure handles thousands of daily pickups without breaking a sweat.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description:
      'We work directly with municipalities and residents to build software that solves actual problems, not hypothetical ones.',
  },
  {
    icon: Clock,
    title: 'Operational Efficiency',
    description:
      'Automate the busywork so your team can focus on what matters — clean streets and satisfied communities.',
  },
];

const tools = [
  {
    icon: MapPin,
    label: 'Routes',
    title: 'Route Planning Engine',
    description:
      'Generates optimized daily collection routes based on geography, traffic patterns, and bin fill-levels.',
  },
  {
    icon: Truck,
    label: 'Dispatch',
    title: 'Real-Time Dispatch Board',
    description:
      'Assigns and reassigns trucks to jobs as conditions change throughout the day.',
  },
  {
    icon: Recycle,
    label: 'Requests',
    title: 'Pickup Request Portal',
    description:
      'Lets residents and businesses submit waste pickups by type, volume, and preferred time window.',
  },
  {
    icon: Users,
    label: 'Fleet',
    title: 'Fleet & Driver Manager',
    description:
      'Tracks vehicle status, driver shifts, and maintenance schedules in one consolidated panel.',
  },
  {
    icon: Clock,
    label: 'Tracking',
    title: 'Collection Tracker',
    description:
      'Monitors every pickup from assignment through completion with timestamped proof.',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    title: 'Operations Dashboard',
    description:
      'Surfaces collection rates, missed pickups, and route efficiency so you act on data, not assumptions.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Request Comes In',
    description:
      'A resident or business submits a pickup through the portal or mobile app.',
  },
  {
    number: '02',
    title: 'System Assigns',
    description:
      'The platform matches the request to the best available truck and driver automatically.',
  },
  {
    number: '03',
    title: 'Driver Collects',
    description:
      'The driver follows the optimized route and confirms each pickup on-site.',
  },
  {
    number: '04',
    title: 'Data Closes the Loop',
    description:
      'Completion data feeds analytics for continuous route and schedule improvement.',
  },
];

/* ── Page ── */

export default function AboutUs() {
  return (
    <div className="bg-secondary min-h-screen font-['Outfit',sans-serif]">
      {/* ── 1. Hero with background image & integrated stats ── */}
      <section className="relative w-full min-h-screen flex items-center overflow-hidden pt-24 pb-12">
        <img
          src={IMAGES.hero}
          alt="Waste management operations"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/75 to-black/50" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-24 flex flex-col justify-center">
          <div className="max-w-3xl mb-16 md:mb-24 mt-10">
            <Reveal>
              <span className="inline-block text-white/60 text-sm font-semibold tracking-widest uppercase mb-4">
                About GreenShift
              </span>
              <h1 className="font-bold text-white text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight">
                Waste collection software that replaces spreadsheets, phone calls,
                and guesswork
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 text-white/70 text-lg md:text-xl leading-relaxed max-w-xl">
                GreenShift gives municipalities and private haulers a single system to
                receive pickup requests, plan routes, dispatch drivers, and track
                every collection to completion.
              </p>
            </Reveal>
          </div>

          <div className="w-full pt-8 border-t border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 100}>
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold text-white">
                      <Counter end={stat.value} suffix={stat.suffix} />
                    </p>
                    <p className="text-white/60 text-sm mt-1 font-medium">
                      {stat.label}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Mission — image + text ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <img
                src={IMAGES.mission}
                alt="Green city planning"
                className="w-full h-[350px] lg:h-[420px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                Our Mission
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3 mb-5 leading-tight">
                Cleaner cities through smarter operations
              </h2>
              <p className="text-primary/70 text-lg leading-relaxed mb-4">
                We believe waste management is critical infrastructure — not an
                afterthought. GreenShift exists to give the teams who keep cities clean
                the tools they deserve: real-time visibility, intelligent routing,
                and data that drives continuous improvement.
              </p>
              <p className="text-primary/50 text-base leading-relaxed">
                Built for teams that manage real fleets on real roads — not a demo
                that looks good but falls apart at scale.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 4. Our Values ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                What Drives Us
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3">
                Our Values
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 80}>
                <div className="bg-secondary/60 rounded-2xl p-7 text-center hover:shadow-lg transition-shadow duration-300 h-full">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <v.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-primary font-semibold text-lg mb-2">
                    {v.title}
                  </h3>
                  <p className="text-primary/55 text-sm leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Six Tools — with icons ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                Platform
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3 mb-3">
                Six tools built for waste
              </h2>
              <p className="text-primary/55 text-lg max-w-2xl">
                Each module handles one part of the collection lifecycle. They work
                independently or together as a full platform.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tools.map((tool, i) => (
              <Reveal key={tool.label} delay={i * 70}>
                <div className="bg-white rounded-xl p-7 flex flex-col min-h-[210px] hover:shadow-lg transition-shadow duration-300 border border-primary/5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <tool.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                    {tool.label}
                  </span>
                  <h3 className="text-primary font-semibold text-lg mt-2 mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-primary/55 text-sm leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Operations image band ── */}
      <section className="relative h-[40vh] min-h-[300px] overflow-hidden">
        <img
          src={IMAGES.city}
          alt="City skyline"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 flex items-center justify-center h-full px-6">
          <Reveal>
            <h2 className="text-white font-bold text-2xl sm:text-3xl md:text-4xl text-center max-w-2xl leading-snug">
              Trusted by municipalities and haulers to keep cities running smoothly
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ── 7. How It Works — with connecting line ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12 text-center">
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                Process
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3 mb-3">
                How it works
              </h2>
              <p className="text-primary/55 text-lg max-w-2xl mx-auto">
                From request to completion in four steps.
              </p>
            </div>
          </Reveal>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* connecting line (desktop) */}
            <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-primary/10" />
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 90}>
                <div className="relative text-center">
                  <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5 relative z-10">
                    {step.number}
                  </div>
                  <h3 className="text-primary font-semibold text-base mb-2">
                    {step.title}
                  </h3>
                  <p className="text-primary/55 text-sm leading-relaxed max-w-[240px] mx-auto">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Team image + text ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal delay={100}>
            <div>
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                Our Team
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3 mb-5 leading-tight">
                People who care about clean streets
              </h2>
              <p className="text-primary/70 text-lg leading-relaxed mb-4">
                GreenShift was started by engineers and urban planners who saw firsthand
                how outdated tools create operational chaos. We combine deep domain
                knowledge with modern software practices.
              </p>
              <p className="text-primary/50 text-base leading-relaxed">
                Every line of code is shaped by conversations with the people who
                actually do this work — dispatchers, drivers, and city administrators.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <img
                src={IMAGES.team}
                alt="Team collaboration"
                className="w-full h-[350px] lg:h-[420px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 9. Sustainability image band ── */}
      <section className="py-16 sm:py-24 px-6 md:px-16 lg:px-24 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <img
                src={IMAGES.green}
                alt="Sustainability and nature"
                className="w-full h-[350px] lg:h-[400px] object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <span className="text-primary/40 text-xs font-semibold tracking-widest uppercase">
                Sustainability
              </span>
              <h2 className="font-bold text-primary text-3xl sm:text-4xl mt-3 mb-5 leading-tight">
                Every optimized route is a step toward greener cities
              </h2>
              <p className="text-primary/70 text-lg leading-relaxed mb-4">
                Route optimization alone reduces fleet fuel consumption by up to 40%.
                Combine that with fill-level forecasting and you eliminate unnecessary
                trips entirely.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {['Lower Emissions', 'Less Fuel', 'Fewer Missed Pickups', 'Data-Driven'].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 10. CTA ── */}
      <section className="relative py-20 sm:py-28 px-6 md:px-16 lg:px-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="font-bold text-white text-2xl sm:text-3xl md:text-4xl mb-4 leading-snug">
              Ready to modernize your waste operations?
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              GreenShift is built to handle the complexity of real-world waste
              operations — so your team can focus on collection, not
              coordination.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <Link
              to="/contact-us"
              className="inline-flex items-center gap-2 bg-white text-primary font-medium text-sm px-8 py-4 rounded-full hover:bg-accent transition-colors duration-200"
            >
              Get in touch
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
