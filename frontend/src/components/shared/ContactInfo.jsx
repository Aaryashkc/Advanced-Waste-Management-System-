import { useRef, useState, useEffect } from 'react';

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

const contactDetails = [
  { label: 'Email', value: 'support@greenshift.com' },
  { label: 'Phone', value: '+977 01-1234567' },
  { label: 'Address', value: 'Kathmandu, Nepal' },
];

export default function ContactInfo() {
  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <h3 className="font-['Outfit',sans-serif] font-bold text-lg text-primary mb-5">
            Get in Touch
          </h3>
          <div className="space-y-5">
            {contactDetails.map((item) => (
              <div key={item.label}>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">
                  {item.label}
                </p>
                <p className="text-primary font-medium text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={150}>
        <div className="bg-primary rounded-2xl p-6 sm:p-8 text-white">
          <h3 className="font-['Outfit',sans-serif] font-bold text-lg mb-3">
            Working Hours
          </h3>
          <div className="space-y-2 text-white/80 text-sm">
            <div className="flex justify-between">
              <span>Sun - Fri</span>
              <span className="font-medium text-white">9:00 AM - 6:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Saturday</span>
              <span className="font-medium text-white">Closed</span>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
