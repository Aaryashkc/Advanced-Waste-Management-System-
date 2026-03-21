import { ArrowRight, ChevronRight } from 'lucide-react';
export function Features() {
    const imgPlaceholderImage = 'https://images.unsplash.com/photo-1561069157-218187260215?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
    const imgPlaceholderImage1 = 'https://images.unsplash.com/photo-1561069157-218187260215?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
    const imgPlaceholderImage2 = 'https://images.unsplash.com/photo-1561069157-218187260215?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
    const imgPlaceholderImage3 = 'https://images.unsplash.com/photo-1561069157-218187260215?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
    const imgPlaceholderImage4 = 'https://images.unsplash.com/photo-1561069157-218187260215?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

  return (
    <section className="bg-white w-full py-16 md:py-24 px-8 md:px-16 lg:px-24">
      <div className="max-w-[1440px] mx-auto">
        <div className="text-center mb-12 space-y-4">
          <h2 className="font-['Outfit'] font-bold text-[#354f52] text-4xl md:text-5xl">
            Six tools built for waste
          </h2>
          <p className="text-[#296200] text-xl font-['Outfit']">
            Everything you need to run operations efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Large feature card - spans 2 rows on desktop */}
          <div className="lg:col-span-2 lg:row-span-2 border border-[#354f52] bg-[#f5f1e8] rounded-lg overflow-hidden flex flex-col">
            <div className="p-8 flex-1">
              <span className="text-[#354f52] font-['Roboto'] font-semibold text-sm mb-2 block">
                Routes
              </span>
              <h3 className="text-[#354f52] font-['Roboto'] font-bold text-3xl md:text-4xl mb-4">
                Routine waste collection
              </h3>
              <p className="text-[#354f52] font-['Roboto'] text-base mb-6">
                Automated route assignment and daily schedules
              </p>
              <div className="flex gap-4 items-center">
                <button className="border border-[#354f52] px-6 py-3 rounded-[20px] text-[#354f52] font-['Roboto'] hover:bg-[#354f52] hover:text-white transition-all">
                  View
                </button>
                <button className="flex items-center gap-2 text-[#354f52] font-['Roboto'] hover:opacity-70 transition-opacity">
                  Arrow <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="h-[360px] overflow-hidden">
              <img src={imgPlaceholderImage} alt="Routine waste collection" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Small feature cards */}
          <div className="border border-[#354f52] bg-[#f5f1e8] rounded-lg overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <span className="text-[#354f52] font-['Roboto'] font-semibold text-sm mb-2 block">
                Requests
              </span>
              <h3 className="text-[#354f52] font-['Roboto'] font-bold text-2xl mb-2">
                On-demand pickups
              </h3>
              <p className="text-[#354f52] font-['Roboto'] text-sm mb-4">
                Request trucks by waste type and volume
              </p>
              <button className="flex items-center gap-2 text-[#354f52] font-['Roboto'] hover:opacity-70 transition-opacity">
                Arrow <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[171px] overflow-hidden">
              <img src={imgPlaceholderImage1} alt="On-demand pickups" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="border border-[#354f52] bg-[#f5f1e8] rounded-lg overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <span className="text-[#354f52] font-['Roboto'] font-semibold text-sm mb-2 block">
                Manage
              </span>
              <h3 className="text-[#354f52] font-['Roboto'] font-bold text-2xl mb-2">
                Organizations panel
              </h3>
              <p className="text-[#354f52] font-['Roboto'] text-sm mb-4">
                Control drivers, trucks, and route assignments
              </p>
              <button className="flex items-center gap-2 text-[#354f52] font-['Roboto'] hover:opacity-70 transition-opacity">
                Arrow <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[171px] overflow-hidden">
              <img src={imgPlaceholderImage2} alt="Organizations panel" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="border border-[#354f52] bg-[#f5f1e8] rounded-lg overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <span className="text-[#354f52] font-['Roboto'] font-semibold text-sm mb-2 block">
                Tasks
              </span>
              <h3 className="text-[#354f52] font-['Roboto'] font-bold text-2xl mb-2">
                Driver tasks
              </h3>
              <p className="text-[#354f52] font-['Roboto'] text-sm mb-4">
                Assigned pickups with real-time status updates
              </p>
              <button className="flex items-center gap-2 text-[#354f52] font-['Roboto'] hover:opacity-70 transition-opacity">
                Arrow <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[171px] overflow-hidden">
              <img src={imgPlaceholderImage3} alt="Driver tasks" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="border border-[#354f52] bg-[#f5f1e8] rounded-lg overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <span className="text-[#354f52] font-['Roboto'] font-semibold text-sm mb-2 block">
                Submissions
              </span>
              <h3 className="text-[#354f52] font-['Roboto'] font-bold text-2xl mb-2">
                User requests
              </h3>
              <p className="text-[#354f52] font-['Roboto'] text-sm mb-4">
                Track all waste pickup requests from citizens
              </p>
              <button className="flex items-center gap-2 text-[#354f52] font-['Roboto'] hover:opacity-70 transition-opacity">
                Arrow <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[171px] overflow-hidden">
              <img src={imgPlaceholderImage4} alt="User requests" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
