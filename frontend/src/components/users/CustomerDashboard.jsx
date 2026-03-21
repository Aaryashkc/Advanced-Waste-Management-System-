import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const serviceCards = [
  {
    id: 1,
    title: 'Upload Waste Request',
    description: 'Send pickup details with location and waste information.',
    route: '/upload-waste',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="10" y="14" width="28" height="24" rx="4" stroke="#354f52" strokeWidth="2.2" />
        <path d="M16 14V11.5C16 9.6 17.6 8 19.5 8H28.5C30.4 8 32 9.6 32 11.5V14" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24 20V30" stroke="#296200" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 24L24 20L28 24" stroke="#296200" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Pickup Schedule',
    description: 'Check and manage your planned collection times.',
    route: '/schedule',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="8" y="10" width="32" height="30" rx="4" stroke="#354f52" strokeWidth="2.2" />
        <path d="M8 18H40" stroke="#354f52" strokeWidth="2.2" />
        <path d="M16 7V13" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M32 7V13" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="27" r="5" fill="#296200" fillOpacity="0.18" stroke="#296200" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Live Driver Search',
    description: 'Track active driver matching for your pickup request.',
    route: '/searching',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M10 30H38L35 19C34.5 17.4 33 16.3 31.3 16.3H16.7C15 16.3 13.5 17.4 13 19L10 30Z" stroke="#354f52" strokeWidth="2.2" />
        <circle cx="17" cy="32" r="3" stroke="#296200" strokeWidth="2.2" />
        <circle cx="31" cy="32" r="3" stroke="#296200" strokeWidth="2.2" />
        <path d="M24 11V4" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20.5 7.5H27.5" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 4,
    title: 'Profile & Preferences',
    description: 'Update account details and customer information.',
    route: '/profile',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="17" r="6" stroke="#354f52" strokeWidth="2.2" />
        <path d="M12 37C12 30.4 17.4 25 24 25C30.6 25 36 30.4 36 37" stroke="#354f52" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="35.5" cy="34.5" r="5.5" fill="#296200" fillOpacity="0.18" />
        <path d="M35.5 31.5V37.5" stroke="#296200" strokeWidth="2" strokeLinecap="round" />
        <path d="M32.5 34.5H38.5" stroke="#296200" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function CustomerDashboard() {
  const navigate = useNavigate();
  const pageRef = useRef(null);

  useEffect(() => {
    const container = pageRef.current;
    if (!container) return;

    const revealItems = container.querySelectorAll('.lp-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in-view');
          } else {
            entry.target.classList.remove('lp-in-view');
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

  const handleMyWastePickUp = () => {
    navigate('/upload-waste');
  };

  const handleSchedule = () => {
    navigate('/schedule');
  };

  return (
    <div ref={pageRef} className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fcf8f1_0%,#f3ebdf_45%,#ecdfcb_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
        <div className="lp-reveal lp-delay-0 bg-white/65 backdrop-blur-sm border border-[#354f52]/15 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-[0_18px_50px_rgba(53,79,82,0.12)]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase bg-[#296200]/10 text-[#296200] mb-4">
                Customer Dashboard
              </p>

              <h1 className="font-['Outfit',sans-serif] font-semibold text-3xl sm:text-4xl lg:text-5xl text-[#354f52] leading-tight">
                Manage your waste collection
                <span className="block text-[#2f473f]">with clarity and speed</span>
              </h1>

              <p className="mt-4 font-['Poppins',sans-serif] text-sm sm:text-base lg:text-lg text-[#4a5b5e] max-w-2xl">
                Plan pickups, follow schedules, and keep every collection request organized in one place.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleMyWastePickUp}
                  className="bg-[#354f52] text-[#f5f1e8] px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-['Inter',sans-serif] font-medium text-sm sm:text-base hover:bg-[#2a3f41] transition-all focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 shadow-lg"
                >
                  My Waste Pick Up
                </button>

                <div className="hidden sm:flex items-center gap-2 text-sm text-[#4a5b5e]">
                  <span className="w-2 h-2 rounded-full bg-[#296200]" />
                  Active customer services
                </div>
              </div>
            </div>

            <button
              onClick={handleSchedule}
              className="self-start md:self-center bg-[#354f52] w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center hover:bg-[#2a3f41] transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 cursor-pointer"
              aria-label="View schedule"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="#f5f1e8" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>
        </div>

        <section className="lp-reveal lp-delay-1 mt-12 sm:mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
            <div>
              <h2 className="font-['Outfit',sans-serif] font-bold text-2xl sm:text-3xl text-[#354f52]">More services</h2>
              <p className="font-['Poppins',sans-serif] text-sm sm:text-base text-[#5f6e70] mt-1">
                Available tools in your customer account
              </p>
            </div>
            <span className="text-xs sm:text-sm font-medium text-[#296200] bg-[#296200]/10 rounded-full px-3 py-1">
              Informational cards
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {serviceCards.map((service) => (
              <article
                key={service.id}
                className="bg-white/90 border border-[#354f52]/20 rounded-2xl p-5 sm:p-6 shadow-[0_8px_24px_rgba(53,79,82,0.10)]"
              >
                <div className="w-14 h-14 rounded-xl bg-[#f4f8f1] border border-[#296200]/25 flex items-center justify-center mb-4">
                  {service.icon}
                </div>

                <h3 className="font-['Outfit',sans-serif] font-semibold text-lg text-[#354f52] leading-snug">
                  {service.title}
                </h3>

                <p className="mt-2 font-['Poppins',sans-serif] text-sm text-[#5f6e70] min-h-10.5">
                  {service.description}
                </p>

                <div className="mt-4 pt-3 border-t border-[#354f52]/10">
                  <p className="font-['Poppins',sans-serif] text-xs text-[#296200]">Route: {service.route}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CustomerDashboard;
