import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { getDashboardRoute } from '../../utils/roleRouting';

export function CTASection() {
  const { isAuthenticated, user } = useAuthStore();

  const getStartedLink = isAuthenticated && user
    ? getDashboardRoute(user.role)
    : '/login';
  const getStartedLabel = isAuthenticated ? 'Go to Dashboard' : 'Get Started';

  return (
    <section className="bg-primary w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h2 className="font-['Outfit'] font-bold text-accent text-3xl md:text-4xl">
          Start managing waste today
        </h2>
        <p className="text-accent/70 font-['Outfit'] text-lg max-w-xl mx-auto leading-relaxed">
          Log in to the dashboard and start tracking your waste collection operations in minutes.
        </p>
        <div className="pt-2">
          <Link to={getStartedLink} className="inline-block">
            <button className="bg-accent text-primary px-8 py-4 rounded-full font-['Inter'] font-medium text-base flex items-center gap-3 transition-colors cursor-pointer hover:bg-white">
              {getStartedLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
