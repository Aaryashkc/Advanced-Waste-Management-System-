import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2070&auto=format&fit=crop';

export function Hero() {
  const { isAuthenticated, user } = useAuthStore();

  const getStartedLink = isAuthenticated && user
    ? getDashboardRoute(user.role)
    : '/login';
  const getStartedLabel = isAuthenticated ? 'Dashboard' : 'Get Started';

  return (
    <section className="relative w-full h-screen min-h-150 flex items-center overflow-hidden">
      {/* Background image */}
      <img
        src={HERO_IMAGE}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-24 pt-20">
        <div className="max-w-3xl">
          <h1 className="font-bold text-white text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tight">
            Manage waste collection with precision and ease
          </h1>
          <p className="mt-6 text-white/70 text-xl md:text-2xl leading-relaxed max-w-xl">
            Safabin streamlines your entire waste management operation. Track routes, assign drivers, and respond to requests in real time.
          </p>
          <div className="mt-10">
            <Link to={getStartedLink}>
              <button className="bg-white text-primary px-8 py-4 rounded-full font-medium text-lg flex items-center gap-3 transition-colors cursor-pointer hover:bg-accent">
                {getStartedLabel}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
