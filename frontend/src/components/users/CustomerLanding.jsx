import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CustomerLandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pageRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const container = pageRef.current;
    if (!container) return;

    const revealItems = Array.from(container.querySelectorAll('.lp-reveal'));
    if (!revealItems.length) return;

    const revealAll = () => {
      revealItems.forEach((item) => item.classList.add('lp-in-view'));
    };

    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleGetStarted = () => {
    navigate('/customer-dashboard');
  };

  const handleLearnMore = () => {
    navigate('/about-us');
  };

  const handleCustomerDashboard = () => {
    console.log('Navigate to customer dashboard');
    navigate('/customer-dashboard');
  };

  const handleRequestPickup = () => {
    navigate('/customer/request-pickup');
  };

  return (
    <div ref={pageRef} className="min-h-screen relative overflow-hidden bg-[#f7f4ec]">
      <div className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-white/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-white/70 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 sm:pb-24">
        <section className="lp-reveal lp-delay-0 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 rounded-3xl border border-[#355157]/15 bg-white/85 backdrop-blur p-6 sm:p-8 shadow-[0_24px_40px_rgba(53,81,87,0.12)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#354f52]/20 bg-white px-4 py-2 text-sm font-['Manrope',sans-serif] font-semibold text-[#2f5e61]">
              Customer Portal
            </span>

            <h1 className="mt-6 font-['Outfit',sans-serif] font-black text-4xl sm:text-5xl text-[#213a3d] leading-[1.05]">
              Manage your waste pickup requests in one place.
            </h1>

            <p className="mt-5 max-w-xl font-['Manrope',sans-serif] text-base sm:text-lg text-[#355157] leading-relaxed">
              Create requests, follow status updates, and stay organized with a simple customer dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={handleGetStarted}
                className="bg-[#213a3d] text-[#f7f4ec] px-7 py-3.5 rounded-2xl hover:bg-[#162729] transition-all active:scale-95 transform focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 shadow-[0_16px_30px_rgba(33,58,61,0.2)] font-['Manrope',sans-serif] font-semibold text-base sm:text-lg"
              >
                Open Dashboard
              </button>

              <button
                onClick={handleLearnMore}
                className="border-2 border-[#213a3d]/45 bg-white/70 backdrop-blur px-7 py-3.5 rounded-2xl hover:bg-[#213a3d] hover:text-[#f7f4ec] transition-all active:scale-95 transform focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 font-['Manrope',sans-serif] font-semibold text-base sm:text-lg"
              >
                Learn More
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#355157]/15 bg-[#f2efe7]">
            <img
              src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=900"
              alt="Green waste bin"
              className="w-full h-64 sm:h-72 lg:h-full object-cover"
              loading="lazy"
            />
          </div>
        </section>

        <section className="lp-reveal lp-delay-1 mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Easy Request Flow',
              text: 'Submit a pickup request quickly with clear details for your location.',
            },
            {
              title: 'Track Request Status',
              text: 'See each request move from pending to completed in your dashboard.',
            },
            {
              title: 'Simple History',
              text: 'Review your past pickups anytime to stay organized.',
            },
          ].map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-[#355157]/15 bg-white/80 backdrop-blur p-5 shadow-[0_12px_24px_rgba(53,81,87,0.09)]"
            >
              <h3 className="font-['Outfit',sans-serif] text-xl font-semibold text-[#1f383b]">
                {feature.title}
              </h3>
              <p className="mt-2 font-['Manrope',sans-serif] text-sm sm:text-base text-[#4d686e] leading-relaxed">
                {feature.text}
              </p>
            </article>
          ))}
        </section>
      </div>

      {/* Floating Action Menu */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50">
        {/* Menu Options - Slide up when open */}
        <div
          className={`absolute bottom-16 right-0 mb-4 flex flex-col gap-3 transition-all duration-300 transform ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
        >
          <button
            onClick={handleCustomerDashboard}
            className="bg-[#296200] text-white px-5 sm:px-6 py-3 rounded-full font-['Poppins',sans-serif] font-medium text-sm sm:text-base hover:bg-[#1f4a00] transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#296200] focus:ring-offset-2"
          >
            Customer Dashboard
          </button>

          <button
            onClick={handleRequestPickup}
            className="bg-[#296200] text-white px-5 sm:px-6 py-3 rounded-full font-['Poppins',sans-serif] font-medium text-sm sm:text-base hover:bg-[#1f4a00] transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#296200] focus:ring-offset-2"
          >
            Request For Pick Up
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleMenu}
          className={`bg-[#354f52] text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center hover:bg-[#2a3f41] transition-all shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 ${isMenuOpen ? 'rotate-45' : 'rotate-0'
            }`}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
        >
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 transition-transform duration-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default CustomerLandingPage;
