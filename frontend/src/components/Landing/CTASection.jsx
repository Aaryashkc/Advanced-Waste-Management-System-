import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="bg-[#f5f1e8] w-full py-16 md:py-24 px-8 md:px-16 lg:px-24">
      <div className="max-w-[1440px] mx-auto text-center space-y-8">
        <h2 className="font-['Outfit'] font-bold text-[#354f52] text-4xl md:text-5xl">
          Start managing waste today
        </h2>
        <p className="text-[#354f52] font-['Outfit'] text-lg max-w-2xl mx-auto">
          Log in to the dashboard and start tracking your waste collection operations in minutes
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button className="bg-[#354f52] text-[#f5f1e8] px-10 py-5 rounded-[20px] font-['Inter'] font-medium text-xl flex items-center gap-3 hover:bg-opacity-90 transition-all">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="border-2 border-[#354f52] text-[#354f52] px-10 py-5 rounded-[20px] font-['Inter'] font-medium text-xl hover:bg-[#354f52] hover:text-white transition-all">
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}
