import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';
import TrashBinScene from '../3d/TrashBinScene';

export function Hero() {
  const { isAuthenticated, user } = useAuthStore();

  // Resolve CTA destinations based on auth state
  const getStartedLink = isAuthenticated && user
    ? getDashboardRoute(user.role)
    : '/login';
  const getStartedLabel = isAuthenticated ? 'Dashboard' : 'Get Started';

  const learnMoreLink = isAuthenticated ? '/about-us' : '#features';

  return (
    <section className="bg-[#f5f1e8] w-full min-h-[65vh] flex items-center py-10 md:py-16 px-8 md:px-16 lg:px-24 overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
        <div className="space-y-8 z-10">
          <h2 className="font-['Outfit'] font-bold leading-[1.2]">
            <span className="text-[#354f52] text-4xl md:text-5xl lg:text-6xl block mb-2">
              Manage waste collection
            </span>
            <span
              className="text-3xl md:text-4xl lg:text-5xl bg-gradient-to-r from-[#57a521] via-[#3f7d18] to-[#213f0d] bg-clip-text"
              style={{ WebkitTextFillColor: 'transparent' }}
            >
              with precision and ease
            </span>
          </h2>
          <p className="text-[#296200] text-lg font-['Outfit'] leading-relaxed max-w-2xl">
            EcoWaste Dashboard streamlines your entire waste management operation. Track routes, assign
            drivers, and respond to requests in real time.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to={getStartedLink}>
              <button className="bg-[#354f52] text-[#f5f1e8] px-10 py-5 rounded-[20px] font-['Inter'] font-medium text-xl flex items-center gap-3 hover:bg-opacity-90 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1">
                {getStartedLabel}
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link to={learnMoreLink}>
              <button className="border-2 border-[#354f52] text-[#354f52] px-10 py-5 rounded-[20px] font-['Inter'] font-medium text-xl hover:bg-[#354f52] hover:text-white transition-all cursor-pointer">
                Learn More
              </button>
            </Link>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end relative">
          {/* 3D Trash Bin replacing the static image */}
          <div className="relative w-full max-w-lg aspect-square">
            <div className="absolute inset-0 to-transparent rounded-full blur-3xl -z-10 transform scale-300"></div>
            <div className="absolute inset-0 z-10">
              <TrashBinScene />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
